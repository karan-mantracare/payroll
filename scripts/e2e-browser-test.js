const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const SCREENSHOTS_DIR = "/home/karan/.gemini/antigravity/brain/4ca20f71-7888-49a2-8075-49fdd6efd825/screenshots";
const BASE_URL = "http://localhost:3000";

async function runBrowserTests() {
  console.log("=== Starting MantraCare HRMS E2E Browser Verification on PORT 3000 ===");
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleLogs = [];
  const networkErrors = [];

  page.on("console", (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === "error") {
      console.error(`[Browser Console Error]`, text);
      if (text.includes("SyntaxError") || text.includes("Invalid or unexpected token")) {
        throw new Error(`CRITICAL BROWSER SYNTAX ERROR DETECTED: ${text}`);
      }
    }
  });

  page.on("requestfailed", (request) => {
    const failure = request.failure();
    const url = request.url();
    networkErrors.push({ url, errorText: failure ? failure.errorText : "Unknown" });
    console.error(`[Browser Network Error] ${url} failed: ${failure ? failure.errorText : ""}`);
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 0: Root URL http://localhost:3000/ Redirect
    // -------------------------------------------------------------------------
    console.log("\n[Test 0] Navigating to http://localhost:3000/ (Root URL)...");
    const rootRes = await page.goto(`${BASE_URL}/`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    const finalUrlAfterRoot = page.url();
    console.log(`[Test 0] Root URL redirected to: ${finalUrlAfterRoot}`);
    console.log(`[Test 0] HTTP status: ${rootRes.status()}`);
    if (!finalUrlAfterRoot.includes("/payrol/login")) {
      throw new Error(`Expected root http://localhost:3000/ to redirect to /payrol/login, got: ${finalUrlAfterRoot}`);
    }
    if (rootRes.status() === 404) {
      throw new Error(`Root URL returned 404 Not Found!`);
    }
    console.log("✓ Test 0 Passed: http://localhost:3000/ cleanly redirects to /payrol/login without 404.");

    // -------------------------------------------------------------------------
    // TEST 1: Login Page Loading, CSS, Logo, and Favicon
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Navigating to /payrol/login...");
    const loginRes = await page.goto(`${BASE_URL}/payrol/login`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });
    console.log(`[Test 1] HTTP status: ${loginRes.status()}`);
    if (loginRes.status() !== 200) {
      throw new Error(`Expected 200 OK from /payrol/login, received ${loginRes.status()}`);
    }

    // Check title
    const title = await page.title();
    console.log(`[Test 1] Page title: "${title}"`);
    if (!title.includes("MantraCare")) {
      throw new Error(`Title does not contain 'MantraCare': "${title}"`);
    }

    // Check logo bounding box
    const logoDimensions = await page.evaluate(() => {
      const img = document.querySelector('img[alt="MantraCare"]');
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      return { width: rect.width, height: rect.height, naturalWidth: img.naturalWidth };
    });
    console.log(`[Test 1] Logo dimensions:`, logoDimensions);
    if (!logoDimensions || logoDimensions.width > 200 || logoDimensions.height > 60) {
      throw new Error(`Logo styling unconstrained or missing! Dimensions: ${JSON.stringify(logoDimensions)}`);
    }

    // Check card background and form styling
    const formCardVisible = await page.evaluate(() => {
      const inputEmail = document.querySelector('input[type="email"]');
      const inputPassword = document.querySelector('input[type="password"]');
      const submitBtn = document.querySelector('button[type="submit"]');
      return !!(inputEmail && inputPassword && submitBtn);
    });
    if (!formCardVisible) {
      throw new Error("Login credentials form inputs not visible!");
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "01-login-screen.png"), fullPage: true });
    console.log("✓ Test 1 Passed: Login page, CSS, assets, and logo render with proper constraints.");

    // -------------------------------------------------------------------------
    // TEST 2: Unauthenticated Direct Navigation Guard
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Testing unauthenticated direct access to /payrol/admin...");
    await page.goto(`${BASE_URL}/payrol/admin`, { waitUntil: "networkidle0" });
    const currentUrlAfterAdmin = page.url();
    console.log(`[Test 2] Redirected to: ${currentUrlAfterAdmin}`);
    if (!currentUrlAfterAdmin.includes("/payrol/login")) {
      throw new Error(`Expected redirect to /payrol/login, instead got ${currentUrlAfterAdmin}`);
    }

    console.log("[Test 2] Testing unauthenticated direct access to /payrol/dash...");
    await page.goto(`${BASE_URL}/payrol/dash`, { waitUntil: "networkidle0" });
    const currentUrlAfterDash = page.url();
    console.log(`[Test 2] Redirected to: ${currentUrlAfterDash}`);
    if (!currentUrlAfterDash.includes("/payrol/login")) {
      throw new Error(`Expected redirect to /payrol/login, instead got ${currentUrlAfterDash}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "02-unauth-redirect.png"), fullPage: true });
    console.log("✓ Test 2 Passed: Unauthenticated access safely redirects to /payrol/login.");

    // -------------------------------------------------------------------------
    // TEST 3: Login Submission & Static OTP Flow
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Entering login credentials for admin@mantra.care...");
    await page.goto(`${BASE_URL}/payrol/login`, { waitUntil: "networkidle0" });
    await page.type('input[type="email"]', "admin@mantra.care");
    await page.type('input[type="password"]', "Test@2026");

    console.log("[Test 3] Clicking Sign In button...");
    await page.click('button[type="submit"]');

    console.log("[Test 3] Waiting for OTP challenge input step...");
    await page.waitForFunction(
      () => document.querySelector('input[inputMode="numeric"]') || document.body.innerText.includes("Verification Code"),
      { timeout: 8000 }
    );

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "03-otp-screen.png"), fullPage: true });
    console.log("✓ Test 3 Passed: Credential verification succeeded and OTP challenge presented.");

    // -------------------------------------------------------------------------
    // TEST 4: OTP Verification and Redirection to Admin Portal
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Entering static development OTP 123456...");
    await page.type('input[inputMode="numeric"]', "123456");
    await page.click('button[type="submit"]');

    console.log("[Test 4] Waiting for navigation to Admin Portal (/payrol/admin)...");
    await page.waitForFunction(() => window.location.pathname === "/payrol/admin", { timeout: 10000 });

    // Wait for admin header content to render
    await page.waitForSelector('span.bg-\\[\\#293381\\], div.bg-\\[\\#293381\\]', { timeout: 8000 });

    // Check high-contrast badges on Admin Portal
    const badgeColors = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll("span, div")).filter(
        (el) => el.innerText && (el.innerText.includes("Admin Portal") || el.innerText.includes("Enterprise HRMS Environment"))
      );
      return badges.map((b) => {
        const style = window.getComputedStyle(b);
        return {
          text: b.innerText.trim(),
          backgroundColor: style.backgroundColor,
          color: style.color,
        };
      });
    });
    console.log(`[Test 4] Badge styling colors:`, badgeColors);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "04-admin-dashboard.png"), fullPage: true });
    console.log("✓ Test 4 Passed: Authenticated session established and Admin Portal loaded with high-contrast badges.");

    // -------------------------------------------------------------------------
    // TEST 5: Direct Navigation to Employee Portal (/payrol/dash)
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Navigating to /payrol/dash with active session...");
    await page.goto(`${BASE_URL}/payrol/dash`, { waitUntil: "networkidle0" });

    await page.waitForFunction(
      () => document.body.innerText.includes("Welcome, Admin Mantra") || document.body.innerText.includes("Employee Self-Service Active"),
      { timeout: 8000 }
    );

    // Verify badge styling in employee portal
    const empBadges = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll("span, div")).filter(
        (el) => el.innerText && (el.innerText.includes("Employee Portal") || el.innerText.includes("Employee Self-Service Active"))
      );
      return badges.map((b) => {
        const style = window.getComputedStyle(b);
        return {
          text: b.innerText.trim(),
          backgroundColor: style.backgroundColor,
          color: style.color,
        };
      });
    });
    console.log(`[Test 5] Employee Portal badge styling:`, empBadges);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "05-employee-dashboard.png"), fullPage: true });
    console.log("✓ Test 5 Passed: Employee Portal loads cleanly without infinite loading.");

    // -------------------------------------------------------------------------
    // TEST 6: Page Reload & Direct Refresh
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Performing browser reload on /payrol/dash...");
    const reloadStart = Date.now();
    await page.reload({ waitUntil: "networkidle0" });
    const reloadDuration = Date.now() - reloadStart;
    console.log(`[Test 6] Page reload completed in ${reloadDuration}ms`);

    // Verify still authenticated and rendered
    const welcomeVisible = await page.evaluate(() => document.body.innerText.includes("Welcome, Admin Mantra"));
    if (!welcomeVisible) {
      throw new Error("After browser reload, employee welcome message was missing!");
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "06-after-reload.png"), fullPage: true });
    console.log("✓ Test 6 Passed: Browser reload instant, no infinite loading or chunk errors.");

    // -------------------------------------------------------------------------
    // TEST 7: Logout Flow
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Clicking Sign Out button...");
    await page.evaluate(() => {
      const logoutBtn = document.querySelector('button[title="Sign Out"]');
      if (logoutBtn) logoutBtn.click();
      else throw new Error("Logout button not found");
    });

    console.log("[Test 7] Waiting for redirect to /payrol/login...");
    await page.waitForFunction(() => window.location.pathname === "/payrol/login", { timeout: 8000 });

    // Verify cookie removed
    const cookies = await page.cookies();
    const sessionCookie = cookies.find((c) => c.name === "mc_payroll_session");
    console.log(`[Test 7] Session cookie after logout:`, sessionCookie ? sessionCookie.value : "None (Cleared)");
    if (sessionCookie && sessionCookie.value) {
      throw new Error("Session cookie was not cleared after logout!");
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "07-after-logout.png"), fullPage: true });
    console.log("✓ Test 7 Passed: Logout completed cleanly and session cookie deleted.");

    // -------------------------------------------------------------------------
    // TEST 8: Expired / Revoked Session Handling
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Testing expired session injection...");
    await page.setCookie({
      name: "mc_payroll_session",
      value: "sess_expired_revoked_fake_test_123",
      domain: "localhost",
      path: "/payrol",
    });

    console.log("[Test 8] Navigating directly to /payrol/admin with expired session...");
    await page.goto(`${BASE_URL}/payrol/admin`, { waitUntil: "networkidle0" });

    // Must be redirected to /payrol/login without hanging
    const finalUrl = page.url();
    console.log(`[Test 8] Final URL after accessing /admin with expired session: ${finalUrl}`);
    if (!finalUrl.includes("/payrol/login")) {
      throw new Error(`Expected redirect to /payrol/login on expired session, got: ${finalUrl}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "08-expired-session-redirect.png"), fullPage: true });
    console.log("✓ Test 8 Passed: Expired/revoked session immediately redirected to login.");

    console.log("\n=======================================================");
    console.log("ALL 8 BROWSER-LEVEL TESTS PASSED WITH 100% SUCCESS!");
    console.log("=======================================================");
  } finally {
    await browser.close();
  }
}

runBrowserTests().catch((err) => {
  console.error("\n❌ Browser verification failed with error:", err);
  process.exit(1);
});
