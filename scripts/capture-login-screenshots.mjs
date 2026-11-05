import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const targetDir = "/home/karan/.gemini/antigravity/brain/4ca20f71-7888-49a2-8075-49fdd6efd825/screenshots";
fs.mkdirSync(targetDir, { recursive: true });

async function run() {
  console.log("Launching Puppeteer browser for Login & OTP screens...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Visit /payrol/login
  console.log("Navigating to http://127.0.0.1:3007/payrol/login...");
  await page.goto("http://127.0.0.1:3007/payrol/login", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));

  // Screenshot: Login Credentials Form (Initial state)
  const loginPath = path.join(targetDir, "login-credentials-form.png");
  await page.screenshot({ path: loginPath, fullPage: true });
  console.log(`Saved screenshot: ${loginPath}`);

  // 2. Open "Forgot Password" modal
  const forgotBtn = await page.$("button::-p-text(Forgot Password?)");
  if (forgotBtn) {
    await forgotBtn.click();
    await new Promise((r) => setTimeout(r, 500));
    const forgotPath = path.join(targetDir, "login-forgot-password-modal.png");
    await page.screenshot({ path: forgotPath, fullPage: true });
    console.log(`Saved screenshot: ${forgotPath}`);

    // Close modal
    const closeBtn = await page.$("button::-p-text(Close)");
    if (closeBtn) await closeBtn.click();
    await new Promise((r) => setTimeout(r, 500));
  }

  // 3. Fill in valid email and password to transition to OTP screen
  console.log("Submitting credentials to reach OTP verification screen...");
  await page.type("input[type=email]", "admin@mantracare.com");
  await page.type("input[type=password]", "MantraCare@2026!");

  const signInBtn = await page.$("button[type=submit]");
  if (signInBtn) {
    await signInBtn.click();
  }

  // Wait for OTP screen to appear
  await page.waitForSelector("input[placeholder='••••••']", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1000));

  // Screenshot: Two-Factor OTP Screen
  const otpPath = path.join(targetDir, "login-otp-verification-screen.png");
  await page.screenshot({ path: otpPath, fullPage: true });
  console.log(`Saved screenshot: ${otpPath}`);

  // 4. Fill in partial OTP (e.g. "123") to show active input state
  await page.type("input[placeholder='••••••']", "123456");
  await new Promise((r) => setTimeout(r, 500));

  const otpFilledPath = path.join(targetDir, "login-otp-filled-screen.png");
  await page.screenshot({ path: otpFilledPath, fullPage: true });
  console.log(`Saved screenshot: ${otpFilledPath}`);

  await browser.close();
  console.log("All login screenshots captured successfully!");
}

run().catch((err) => {
  console.error("Puppeteer capture failed:", err);
  process.exit(1);
});

