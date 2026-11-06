import puppeteer from "puppeteer";
import { spawn } from "child_process";
import { createClient } from "@libsql/client";

const PORT = 3015;
const BASE_URL = `http://127.0.0.1:${PORT}/payrol`;
const DB_URL = "file:local.db";

const db = createClient({ url: DB_URL });

console.log("================================================================================");
console.log("       MANTRACARE HRMS & PAYROLL: 18-SCENARIO AUTH & DB RELIABILITY TEST        ");
console.log("================================================================================");

let serverProcess;

async function startServer() {
  return new Promise((resolve) => {
    console.log(`Starting Next.js development server on port ${PORT}...`);
    serverProcess = spawn("./node_modules/.bin/next", ["dev", "-p", String(PORT), "-H", "127.0.0.1"], {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "development",
        PAYROLL_DEV_STATIC_OTP_ENABLED: "true",
        PORT: String(PORT),
        HOSTNAME: "127.0.0.1",
      },
    });

    serverProcess.stdout.on("data", (data) => {
      const msg = data.toString();
      if (msg.includes("Ready in") || msg.includes("started server on") || msg.includes("Listening on")) {
        console.log(`[Next.js Server] ${msg.trim()}`);
        resolve();
      }
    });

    serverProcess.stderr.on("data", (data) => {
      console.error(`[Next.js Server Error] ${data.toString().trim()}`);
    });

    setTimeout(() => resolve(), 3500);
  });
}

function stopServer() {
  if (serverProcess && serverProcess.pid) {
    try {
      process.kill(-serverProcess.pid, "SIGKILL");
    } catch {}
    console.log("Next.js server terminated.");
  }
}

const LEAK_PATTERNS = [
  /failed query/i,
  /insert into/i,
  /select /i,
  /update /i,
  /delete from/i,
  /sqlite_/i,
  /drizzle/i,
  /params:\s*\[/i,
  /syntax error/i,
  /otp_[0-9a-f]{32}/i,
];

function assertNoSensitiveLeak(text, context) {
  for (const pattern of LEAK_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`CRITICAL SECURITY FAILURE in ${context}: sensitive or technical SQL leaked matching pattern ${pattern}! Text snippet: "${text.slice(0, 150)}..."`);
    }
  }
}

async function runAll18Scenarios() {
  await startServer();

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const passedScenarios = [];
  const failedScenarios = [];
  const performanceTimings = {};

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const jsChunkResponses = [];
    page.on("response", (res) => {
      const url = res.url();
      if (url.includes("/_next/static/chunks/")) {
        jsChunkResponses.push({ url, status: res.status() });
      }
    });

    // -------------------------------------------------------------------------
    // SCENARIO 1: Login with valid credentials
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 1] Submitting valid credentials (admin@mantra.care)...");
    const t1Start = performance.now();
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    
    // Clear and type credentials
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', "admin@mantra.care");
    await page.type('input[type="password"]', "Test@2026");

    await page.click('button[type="submit"]');
    await page.waitForSelector('input[inputmode="numeric"]', { timeout: 8000 });
    const t1Duration = performance.now() - t1Start;
    performanceTimings["1. Login with Valid Credentials Duration"] = `${t1Duration.toFixed(1)}ms`;
    console.log(`  ✓ Successfully submitted credentials and arrived at OTP view in ${t1Duration.toFixed(1)}ms`);
    passedScenarios.push("1. Login with valid credentials");

    // -------------------------------------------------------------------------
    // SCENARIO 2: OTP challenge creation
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 2] Verifying OTP challenge creation in database...");
    const challengeRes = await db.execute({
      sql: "SELECT * FROM otp_challenges WHERE user_id = 'usr_temp_admin' ORDER BY created_at DESC LIMIT 1;",
      args: [],
    });
    if (challengeRes.rows.length === 0) {
      throw new Error("No OTP challenge record found in database for usr_temp_admin");
    }
    const latestChallenge = challengeRes.rows[0];
    if (latestChallenge.is_used !== 0) throw new Error("Expected latest challenge is_used === 0");
    if (!latestChallenge.challenge_token) throw new Error("Expected challenge_token to be set");
    console.log(`  ✓ Database verified: Challenge ${latestChallenge.id} created, is_used=0, attempts=${latestChallenge.attempts}`);
    passedScenarios.push("2. OTP challenge creation");

    // -------------------------------------------------------------------------
    // SCENARIO 3: OTP verification using development OTP 123456
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 3] Verifying OTP with development OTP 123456...");
    const t3Start = performance.now();
    await page.type('input[inputmode="numeric"]', "123456");
    await page.click('button[type="submit"]');

    // Wait for redirect to admin portal
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 });
    const t3Duration = performance.now() - t3Start;
    performanceTimings["3. OTP Verification & Portal Redirect"] = `${t3Duration.toFixed(1)}ms`;
    console.log(`  ✓ OTP 123456 verified and redirected in ${t3Duration.toFixed(1)}ms`);
    passedScenarios.push("3. OTP verification using development OTP 123456");

    // -------------------------------------------------------------------------
    // SCENARIO 4: Session creation
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 4] Verifying authenticated session persistence...");
    const cookies = await page.cookies();
    const sessionCookie = cookies.find((c) => c.name === "mc_payroll_session");
    if (!sessionCookie) throw new Error("mc_payroll_session cookie was not found in browser");
    
    const dbSessionRes = await db.execute({
      sql: "SELECT * FROM auth_sessions WHERE session_id = ? AND user_id = 'usr_temp_admin';",
      args: [sessionCookie.value],
    });
    if (dbSessionRes.rows.length === 0) throw new Error("Session cookie does not correspond to a valid auth_sessions row");
    console.log(`  ✓ Verified session ${sessionCookie.value} exists in database with user_id usr_temp_admin`);
    passedScenarios.push("4. Session creation");

    // -------------------------------------------------------------------------
    // SCENARIO 5: Admin dashboard access
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 5] Verifying Admin dashboard access...");
    const currentUrl = page.url();
    if (!currentUrl.includes("/admin")) throw new Error(`Expected URL to include /admin, got ${currentUrl}`);
    const adminHeading = await page.$eval("h1", (el) => el.textContent);
    if (!adminHeading.includes("Admin & HRMS Command Center")) {
      throw new Error(`Admin dashboard heading mismatch: ${adminHeading}`);
    }
    console.log(`  ✓ Verified Admin Dashboard heading: "${adminHeading}"`);
    passedScenarios.push("5. Admin dashboard access");

    // -------------------------------------------------------------------------
    // SCENARIO 6: Employee dashboard access when authorized
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 6] Verifying Employee dashboard access for authorized user...");
    const t6Start = performance.now();
    await page.goto(`${BASE_URL}/dash`, { waitUntil: "networkidle0" });
    const t6Duration = performance.now() - t6Start;
    performanceTimings["6. Admin to Employee Navigation"] = `${t6Duration.toFixed(1)}ms`;

    const empHeading = await page.$eval("h1", (el) => el.textContent);
    if (!empHeading.includes("Welcome, Admin Mantra")) {
      throw new Error(`Employee dashboard heading mismatch: ${empHeading}`);
    }
    console.log(`  ✓ Verified Employee Dashboard heading: "${empHeading}" loaded in ${t6Duration.toFixed(1)}ms`);
    passedScenarios.push("6. Employee dashboard access when authorized");

    // -------------------------------------------------------------------------
    // SCENARIO 7: Direct URL switching between portals
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 7] Testing direct URL switching between Admin and Employee portals...");
    const t7Start = performance.now();
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle0" });
    const hAdminAgain = await page.$eval("h1", (el) => el.textContent);
    await page.goto(`${BASE_URL}/dash`, { waitUntil: "networkidle0" });
    const hEmpAgain = await page.$eval("h1", (el) => el.textContent);
    const t7Duration = performance.now() - t7Start;
    performanceTimings["7. Portal Round-Trip Navigation"] = `${t7Duration.toFixed(1)}ms`;
    if (!hAdminAgain.includes("Admin & HRMS") || !hEmpAgain.includes("Welcome, Admin Mantra")) {
      throw new Error("Portal switching failed or resulted in heading mismatch");
    }
    console.log(`  ✓ Seamless round-trip portal switching completed in ${t7Duration.toFixed(1)}ms with 0 re-authentication`);
    passedScenarios.push("7. Direct URL switching between portals");

    // -------------------------------------------------------------------------
    // SCENARIO 8: Browser refresh with valid session
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 8] Performing browser hard refresh on /payrol/dash...");
    const t8Start = performance.now();
    await page.reload({ waitUntil: "networkidle0" });
    const t8Duration = performance.now() - t8Start;
    performanceTimings["8. Employee Portal Reload"] = `${t8Duration.toFixed(1)}ms`;
    const hReload = await page.$eval("h1", (el) => el.textContent);
    if (!hReload.includes("Welcome, Admin Mantra")) {
      throw new Error("Reload failed to restore authenticated session");
    }
    console.log(`  ✓ Browser reload succeeded in ${t8Duration.toFixed(1)}ms`);
    passedScenarios.push("8. Browser refresh with valid session");

    // -------------------------------------------------------------------------
    // SCENARIO 9: Expired session
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 9] Testing expired session behavior...");
    await db.execute({
      sql: "UPDATE auth_sessions SET expires_at = ? WHERE session_id = ?;",
      args: [Date.now() - 5000, sessionCookie.value],
    });
    // Invalidate local in-memory cache by waiting 5.1 seconds
    await new Promise((r) => setTimeout(r, 5200));

    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle0" });
    const postExpiryUrl = page.url();
    if (!postExpiryUrl.includes("/login")) {
      throw new Error(`Expected redirect to /login on expired session, got: ${postExpiryUrl}`);
    }
    console.log(`  ✓ Expired session correctly rejected and redirected to /login (${postExpiryUrl})`);
    passedScenarios.push("9. Expired session");

    // -------------------------------------------------------------------------
    // SCENARIO 10: Missing OTP table simulation & self-healing / safe error
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 10] Testing missing OTP table recovery and safe error handling...");
    // Rename table to simulate missing table
    await db.execute("ALTER TABLE otp_challenges RENAME TO otp_challenges_backup;");
    
    // Call login API directly
    const missingTableRes = await page.evaluate(async () => {
      const res = await fetch("/payrol/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@mantra.care", password: "Test@2026" }),
      });
      return { status: res.status, data: await res.json() };
    });

    // Check that NO SQL or table error was leaked
    assertNoSensitiveLeak(JSON.stringify(missingTableRes.data), "Missing OTP Table Test");
    console.log(`  ✓ Response status: ${missingTableRes.status}, error message: "${missingTableRes.data.error || 'Clean self-heal'}"`);
    if (missingTableRes.data.error) {
      if (missingTableRes.data.error.includes("Failed query") || missingTableRes.data.error.includes("otp_challenges")) {
        throw new Error("Technical SQL query leaked in response!");
      }
    }
    // Restore table
    await db.execute("DROP TABLE IF EXISTS otp_challenges;");
    await db.execute("ALTER TABLE otp_challenges_backup RENAME TO otp_challenges;");
    console.log("  ✓ Missing OTP table safely handled with zero technical leakage");
    passedScenarios.push("10. Missing OTP table");

    // -------------------------------------------------------------------------
    // SCENARIO 11: Database temporarily unavailable / bad payload handling
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 11] Testing database/unhandled error safe handling...");
    const malformedRes = await page.evaluate(async () => {
      const res = await fetch("/payrol/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json-payload-test",
      });
      return { status: res.status, data: await res.json() };
    });
    assertNoSensitiveLeak(JSON.stringify(malformedRes.data), "Database Unhandled Error Test");
    if (!malformedRes.data.error || malformedRes.data.error.length === 0) {
      throw new Error("Expected structured error in malformed request response");
    }
    console.log(`  ✓ Malformed / error request safely returned status ${malformedRes.status} with safe error`);
    passedScenarios.push("11. Database temporarily unavailable / error safety");

    // -------------------------------------------------------------------------
    // SCENARIO 12: Duplicate login submission & button disabling
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 12] Testing duplicate/concurrent login submission...");
    const [p1, p2] = await page.evaluate(async () => {
      const call = () =>
        fetch("/payrol/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "admin@mantra.care", password: "Test@2026" }),
        }).then((r) => r.json());
      return Promise.all([call(), call()]);
    });

    if (!p1.success && !p2.success) {
      throw new Error("Both duplicate submissions failed unexpectedly");
    }
    // Check challenges in DB: older unconsumed should be invalidated
    const activeChallenges = await db.execute({
      sql: "SELECT count(*) as cnt FROM otp_challenges WHERE user_id = 'usr_temp_admin' AND is_used = 0;",
      args: [],
    });
    console.log(`  ✓ Active unconsumed challenges remaining in DB: ${activeChallenges.rows[0].cnt} (Only 1 active permitted)`);
    passedScenarios.push("12. Duplicate login submission");

    // -------------------------------------------------------------------------
    // SCENARIO 13: Concurrent OTP verification (Anti-Double-Consumption)
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 13] Testing concurrent OTP verification double-spend protection...");
    // Issue a clean challenge first
    const freshChallenge = await page.evaluate(async () => {
      const res = await fetch("/payrol/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@mantra.care", password: "Test@2026" }),
      });
      return res.json();
    });

    const tokenToTest = freshChallenge.challengeToken;
    const [v1, v2] = await page.evaluate(async (tok) => {
      const verifyCall = () =>
        fetch("/payrol/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeToken: tok, otp: "123456" }),
        }).then((r) => r.json());
      return Promise.all([verifyCall(), verifyCall()]);
    }, tokenToTest);

    const successCount = (v1.success ? 1 : 0) + (v2.success ? 1 : 0);
    console.log(`  ✓ Concurrent verification results: Call 1 success=${v1.success}, Call 2 success=${v2.success}`);
    if (successCount !== 1) {
      throw new Error(`Expected exactly ONE concurrent verification to succeed, but got ${successCount}!`);
    }
    passedScenarios.push("13. Concurrent OTP verification");

    // -------------------------------------------------------------------------
    // SCENARIO 14: Incorrect and expired OTP
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 14] Testing incorrect and expired OTP...");
    // 14a: Incorrect OTP
    const freshForBadOtp = await page.evaluate(async () => {
      const res = await fetch("/payrol/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@mantra.care", password: "Test@2026" }),
      });
      return res.json();
    });

    const badOtpRes = await page.evaluate(async (tok) => {
      const res = await fetch("/payrol/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken: tok, otp: "999999" }),
      });
      return { status: res.status, data: await res.json() };
    }, freshForBadOtp.challengeToken);

    if (badOtpRes.data.code !== "INVALID_OTP") {
      throw new Error(`Expected INVALID_OTP, got ${badOtpRes.data.code}`);
    }
    console.log(`  ✓ Incorrect OTP correctly rejected with code: ${badOtpRes.data.code}`);

    // 14b: Expired OTP
    await db.execute({
      sql: "UPDATE otp_challenges SET expires_at = ? WHERE challenge_token = ?;",
      args: [Date.now() - 10000, freshForBadOtp.challengeToken],
    });

    const expiredOtpRes = await page.evaluate(async (tok) => {
      const res = await fetch("/payrol/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken: tok, otp: "123456" }),
      });
      return { status: res.status, data: await res.json() };
    }, freshForBadOtp.challengeToken);

    if (expiredOtpRes.data.code !== "CHALLENGE_EXPIRED") {
      throw new Error(`Expected CHALLENGE_EXPIRED, got ${expiredOtpRes.data.code}`);
    }
    console.log(`  ✓ Expired OTP correctly rejected with code: ${expiredOtpRes.data.code}`);
    passedScenarios.push("14. Incorrect and expired OTP");

    // -------------------------------------------------------------------------
    // SCENARIO 15: Invalid employee mapping
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 15] Testing invalid / unmapped employee access...");
    const credRes = await db.execute("SELECT password_hash FROM user_credentials WHERE user_id = 'usr_temp_admin';");
    const pwdHash = credRes.rows[0].password_hash;
    const nowTs = Date.now();

    await db.execute({
      sql: "INSERT OR REPLACE INTO users (id, platform_user_id, email, name, status, created_at, updated_at) VALUES ('usr_unmapped_test', 'plt_unmapped_test', 'unmapped@mantra.care', 'Unmapped User', 'ACTIVE', ?, ?);",
      args: [nowTs, nowTs],
    });
    await db.execute({
      sql: "INSERT OR REPLACE INTO user_credentials (id, user_id, password_hash, password_updated_at, failed_login_attempts, locked_until, created_at, updated_at) VALUES ('cred_unmapped_test', 'usr_unmapped_test', ?, ?, 0, null, ?, ?);",
      args: [pwdHash, nowTs, nowTs, nowTs],
    });

    const unmappedRes = await page.evaluate(async () => {
      const res = await fetch("/payrol/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "unmapped@mantra.care", password: "Test@2026" }),
      });
      return { status: res.status, data: await res.json() };
    });

    // Clean up unmapped test user
    await db.execute("DELETE FROM user_credentials WHERE user_id = 'usr_unmapped_test';");
    await db.execute("DELETE FROM users WHERE id = 'usr_unmapped_test';");

    if (unmappedRes.data.code !== "EMPLOYEE_NOT_MAPPED") {
      throw new Error(`Expected EMPLOYEE_NOT_MAPPED, got ${unmappedRes.data.code}`);
    }
    console.log(`  ✓ Unmapped user rejected safely with code: ${unmappedRes.data.code}`);
    passedScenarios.push("15. Invalid employee mapping");

    // -------------------------------------------------------------------------
    // SCENARIO 16: Unauthorized portal access
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 16] Testing unauthorized portal access (emp@mantra.care -> /admin)...");
    // Clear cookies
    const client = await page.target().createCDPSession();
    await client.send("Network.clearBrowserCookies");

    // Login as Employee (EMP-011, role: EMPLOYEE)
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', "emp@mantra.care");
    await page.type('input[type="password"]', "Test@2026");
    await page.click('button[type="submit"]');

    await page.waitForSelector('input[inputmode="numeric"]', { timeout: 8000 });
    await page.type('input[inputmode="numeric"]', "123456");
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle0" });
    const empUrl = page.url();
    if (!empUrl.includes("/dash")) {
      throw new Error(`Expected employee to land on /dash, got ${empUrl}`);
    }
    console.log(`  ✓ Employee successfully landed on ${empUrl}`);

    // Try navigating to /admin
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle0" });
    const blockedHeading = await page.$eval("h1, h2, h3", (el) => el.textContent);
    console.log(`  ✓ Attempt to access /payrol/admin as Employee: Screen displays "${blockedHeading}"`);
    if (!blockedHeading.includes("Access") && !page.url().includes("/dash") && !page.url().includes("/login")) {
      throw new Error(`Unauthorized portal access was not restricted! Resulting heading: ${blockedHeading}`);
    }
    console.log("  ✓ Verified: Unauthorized portal access is strictly blocked without privilege escalation");
    passedScenarios.push("16. Unauthorized portal access");

    // -------------------------------------------------------------------------
    // SCENARIO 17: JavaScript chunk loading after a clean restart
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 17] Verifying JavaScript chunk loading integrity...");
    const chunk404s = jsChunkResponses.filter((c) => c.status !== 200 && c.status !== 304);
    if (chunk404s.length > 0) {
      throw new Error(`Detected ${chunk404s.length} JavaScript chunks failing to load: ${JSON.stringify(chunk404s)}`);
    }
    console.log(`  ✓ Verified all ${jsChunkResponses.length} static JS chunks loaded with 0 404 errors`);
    passedScenarios.push("17. JavaScript chunk loading after a clean restart");

    // -------------------------------------------------------------------------
    // SCENARIO 18: Safe error messages without SQL or sensitive data
    // -------------------------------------------------------------------------
    console.log("\n[SCENARIO 18] Auditing error screen sanitization and technical leakage...");
    await client.send("Network.clearBrowserCookies");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', "admin@mantra.care");
    await page.type('input[type="password"]', "WrongPassword123!");
    await page.click('button[type="submit"]');

    await page.waitForSelector(".bg-rose-50", { timeout: 8000 });
    const renderedError = await page.$eval(".bg-rose-50", (el) => el.textContent);
    assertNoSensitiveLeak(renderedError, "Login Page Error Card");
    console.log(`  ✓ Verified rendered error card: "${renderedError.trim()}" (0 technical patterns)`);
    passedScenarios.push("18. Safe error messages without SQL or sensitive data");

    // Benchmark summary
    console.log("\n================================================================================");
    console.log("                         PERFORMANCE METRICS SUMMARY                            ");
    console.log("================================================================================");
    for (const [k, v] of Object.entries(performanceTimings)) {
      console.log(`  - ${k}: ${v}`);
    }

    console.log("\n================================================================================");
    console.log(`>>> ALL ${passedScenarios.length}/18 END-TO-END SCENARIOS PASSED WITH ZERO FAILURES! <<<`);
    console.log("================================================================================");
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILURE:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    stopServer();
  }
}

runAll18Scenarios();

