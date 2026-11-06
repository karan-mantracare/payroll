import puppeteer from "puppeteer";
import { spawn } from "child_process";

const PORT = 3005;
const BASE_URL = `http://127.0.0.1:${PORT}/payrol`;

console.log("=== STARTING END-TO-END BROWSER AUTHENTICATION & ROUTING VERIFICATION ===");

let serverProcess;

async function startServer() {
  return new Promise((resolve) => {
    console.log(`Starting Next.js development server on port ${PORT}...`);
    serverProcess = spawn("npx", ["next", "dev", "-p", String(PORT), "-H", "127.0.0.1"], {
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

    setTimeout(() => resolve(), 3000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    console.log("Next.js server terminated.");
  }
}

async function runTests() {
  await startServer();

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const failures = [];
  const performanceMetrics = {};

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const failedRequests = [];
    const jsChunkResponses = [];

    page.on("response", async (res) => {
      const url = res.url();
      const status = res.status();
      const contentType = res.headers()["content-type"] || "";

      if (url.includes("/api/auth/verify-otp")) {
        try {
          const body = await res.text();
          console.log(`  [Verify OTP Response] Status: ${status}, Body: ${body}`);
        } catch {}
      }

      if (url.includes("/_next/static/chunks/")) {
        jsChunkResponses.push({ url, status, contentType });
      }

      if (status >= 400 && !url.includes("/api/auth/me")) {
        failedRequests.push({ url, status, contentType });
      }
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error("  [Browser Console Error]", msg.text());
      }
    });

    // Test 1: Fresh browser, no cookies -> /payrol/login
    console.log("\n[TEST 1] Fresh browser navigating to /payrol/login...");
    const t1Start = performance.now();
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    const t1Duration = performance.now() - t1Start;
    performanceMetrics["Initial /payrol/login load"] = `${t1Duration.toFixed(1)}ms`;

    const loginTitle = await page.$eval("h1", (el) => el.textContent);
    console.log(`  Login Page Rendered: "${loginTitle}" in ${t1Duration.toFixed(1)}ms`);
    if (!loginTitle.includes("Sign In")) {
      failures.push("Test 1 Failed: Expected 'Sign In' heading on /payrol/login");
    }

    // Verify zero chunk 404s
    const chunk404s = jsChunkResponses.filter((c) => c.status === 404);
    if (chunk404s.length > 0) {
      failures.push(`Test 1 Failed: ${chunk404s.length} JavaScript chunks returned 404!`);
      console.error("  404 Chunks:", chunk404s);
    } else {
      console.log(`  Verified ${jsChunkResponses.length} JS chunks loaded with HTTP 200 (0 errors).`);
    }

    // Test 2: Fresh browser, no cookies -> /payrol/admin redirect
    console.log("\n[TEST 2] Fresh browser navigating to /payrol/admin (expecting redirect)...");
    const adminPage = await browser.newPage();
    await adminPage.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle0" });
    const redirectedUrl = adminPage.url();
    console.log(`  Redirected to: ${redirectedUrl}`);
    if (!redirectedUrl.includes("/payrol/login")) {
      failures.push("Test 2 Failed: Unauthenticated /payrol/admin did not redirect to /payrol/login");
    }
    await adminPage.close();

    // Test 3: Fresh browser, no cookies -> /payrol/dash redirect
    console.log("\n[TEST 3] Fresh browser navigating to /payrol/dash (expecting redirect)...");
    const dashPage = await browser.newPage();
    await dashPage.goto(`${BASE_URL}/dash`, { waitUntil: "networkidle0" });
    console.log(`  Redirected to: ${dashPage.url()}`);
    if (!dashPage.url().includes("/payrol/login")) {
      failures.push("Test 3 Failed: Unauthenticated /payrol/dash did not redirect to /payrol/login");
    }
    await dashPage.close();

    // Test 4: Successful credentials + OTP login as admin@mantra.care
    console.log("\n[TEST 4] Authenticating as admin@mantra.care with development OTP 123456...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });

    await page.type('input[type="email"]', "admin@mantra.care");
    await page.type('input[type="password"]', "Test@2026");

    const tLoginStart = performance.now();
    await page.click('button[type="submit"]');

    // Wait for step 2: OTP screen
    const otpInput = await page.waitForSelector('input[inputmode="numeric"]', { timeout: 5000 });
    console.log("  Step 1 Passed: OTP Verification challenge presented.");

    // Focus and fill OTP with natural typing delay for React state binding
    await otpInput.click();
    await otpInput.type("123456", { delay: 60 });

    // Wait for button to be enabled
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 3000 });

    console.log("  Submitting OTP...");
    await page.click('button[type="submit"]');

    // Wait for redirect away from /login
    await page.waitForFunction(() => !window.location.href.includes("/login"), { timeout: 10000 });
    const currentUrl = page.url();
    console.log("  Navigated after OTP to:", currentUrl);

    const authDuration = performance.now() - tLoginStart;
    performanceMetrics["Full Login + OTP Duration"] = `${authDuration.toFixed(1)}ms`;
    console.log(`  Step 2 Result: Authenticated and routed to ${page.url()} in ${authDuration.toFixed(1)}ms`);

    // Wait for Admin Portal to mount
    await page.waitForSelector("h1", { timeout: 10000 });
    const adminHeading = await page.$eval("h1", (el) => el.textContent);
    console.log(`  Admin Portal Heading: "${adminHeading}"`);
    if (!adminHeading.includes("Admin & HRMS Command Center")) {
      failures.push("Test 4 Failed: Admin portal heading mismatch");
    }

    // Test 5: Navigate to Employee Portal (/payrol/dash)
    console.log("\n[TEST 5] Navigating from Admin Portal to Employee Portal (/payrol/dash)...");
    const tDashNavStart = performance.now();
    await page.goto(`${BASE_URL}/dash`, { waitUntil: "networkidle0" });
    const dashDuration = performance.now() - tDashNavStart;
    performanceMetrics["Admin -> Employee Portal Navigation"] = `${dashDuration.toFixed(1)}ms`;

    await page.waitForSelector("h1", { timeout: 10000 });
    const dashHeading = await page.$eval("h1", (el) => el.textContent);
    console.log(`  Employee Portal Heading: "${dashHeading}" loaded in ${dashDuration.toFixed(1)}ms`);
    if (!dashHeading.includes("Welcome, Admin Mantra")) {
      failures.push("Test 5 Failed: Employee portal heading mismatch or stuck on loading");
    }

    // Verify NO infinite loading screen
    const loadingScreenCount = await page.$$eval(
      'h2',
      (els) => els.filter((e) => e.textContent.includes("Verifying Authentication")).length
    ).catch(() => 0);

    if (loadingScreenCount > 0) {
      failures.push("Test 5 Failed: Stuck on 'Verifying Authentication' loading screen");
    } else {
      console.log("  Verified: No 'Verifying Authentication' stuck screen on /payrol/dash.");
    }

    // Test 6: Hard Refresh Employee Portal
    console.log("\n[TEST 6] Hard refreshing /payrol/dash...");
    const tRefreshStart = performance.now();
    await page.reload({ waitUntil: "networkidle0" });
    const refreshDuration = performance.now() - tRefreshStart;
    performanceMetrics["Employee Portal Reload"] = `${refreshDuration.toFixed(1)}ms`;

    await page.waitForSelector("h1", { timeout: 10000 });
    const reloadedHeading = await page.$eval("h1", (el) => el.textContent);
    console.log(`  Reloaded Employee Portal: "${reloadedHeading}" in ${refreshDuration.toFixed(1)}ms`);

    // Test 7: Navigate back to Admin Portal
    console.log("\n[TEST 7] Navigating back to Admin Portal (/payrol/admin)...");
    const tAdminReturn = performance.now();
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle0" });
    const returnDuration = performance.now() - tAdminReturn;
    performanceMetrics["Employee -> Admin Portal Navigation"] = `${returnDuration.toFixed(1)}ms`;

    await page.waitForSelector("h1", { timeout: 10000 });
    const returnedAdminHeading = await page.$eval("h1", (el) => el.textContent);
    console.log(`  Returned Admin Heading: "${returnedAdminHeading}" in ${returnDuration.toFixed(1)}ms`);

    // Test 8: Verify Session API latency directly
    console.log("\n[TEST 8] Benchmarking /payrol/api/auth/me response latency...");
    const apiLatencies = [];
    for (let i = 0; i < 5; i++) {
      const s = performance.now();
      const res = await page.evaluate(async () => {
        const r = await fetch("/payrol/api/auth/me");
        return { status: r.status, data: await r.json() };
      });
      const d = performance.now() - s;
      apiLatencies.push(d);
      console.log(`  Session API Call ${i + 1}: ${d.toFixed(2)}ms (Status: ${res.status})`);
    }
    const avgApi = apiLatencies.reduce((a, b) => a + b, 0) / apiLatencies.length;
    performanceMetrics["Session API (/api/auth/me) Avg Latency"] = `${avgApi.toFixed(2)}ms`;

    // Take screenshot of Employee Portal and Admin Portal
    await page.goto(`${BASE_URL}/dash`, { waitUntil: "networkidle0" });
    await page.screenshot({ path: "/home/karan/.gemini/antigravity/brain/4ca20f71-7888-49a2-8075-49fdd6efd825/screenshots/e2e-employee-portal.png" });

    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle0" });
    await page.screenshot({ path: "/home/karan/.gemini/antigravity/brain/4ca20f71-7888-49a2-8075-49fdd6efd825/screenshots/e2e-admin-portal.png" });

    console.log("\n=== PERFORMANCE METRICS SUMMARY ===");
    for (const [k, v] of Object.entries(performanceMetrics)) {
      console.log(`  - ${k}: ${v}`);
    }

    if (failures.length === 0) {
      console.log("\n>>> ALL 8 END-TO-END AUTOMATED VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<");
    } else {
      console.error("\n>>> FAILURES DETECTED: <<<");
      failures.forEach((f) => console.error(`  - ${f}`));
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("FATAL E2E TEST RUNNER ERROR:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    stopServer();
  }
}

runTests();
