import puppeteer from "puppeteer";
import fs from "fs";

async function main() {
  console.log("Starting Puppeteer screenshot capture on port 3006...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Helper to clear cookies
  const clearSession = async () => {
    const client = await page.target().createCDPSession();
    await client.send("Network.clearBrowserCookies");
  };

  // 1. Admin Desktop Dark Mode
  console.log("1. Capturing Admin Desktop Dark Mode...");
  await page.setViewport({ width: 1440, height: 960 });
  await clearSession();
  await page.goto("http://127.0.0.1:3006/payrol?token=test-token-admin-review-1", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "docs/screenshots/admin-desktop-dark.png" });

  // 2. Admin Desktop Light Mode
  console.log("2. Capturing Admin Desktop Light Mode...");
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: "docs/screenshots/admin-desktop-light.png" });

  // 3. Module 12: Access & Audit Log (Dark Mode)
  console.log("3. Capturing Module 12 Access & Audit Log...");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.goto("http://127.0.0.1:3006/payrol/admin/access", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "docs/screenshots/admin-access-audit.png" });

  // 4. Employee Desktop Dark Mode (Showing Team Manager with 11 modules & switcher)
  console.log("4. Capturing Employee Desktop Dark Mode...");
  await clearSession();
  await page.goto("http://127.0.0.1:3006/payrol?token=test-token-multirole-review-1", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "docs/screenshots/employee-desktop-dark.png" });

  // 5. Employee Desktop Light Mode
  console.log("5. Capturing Employee Desktop Light Mode...");
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: "docs/screenshots/employee-desktop-light.png" });

  // 6. Mobile Admin Layout (390x844)
  console.log("6. Capturing Mobile Admin Layout...");
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.setViewport({ width: 390, height: 844 });
  await clearSession();
  await page.goto("http://127.0.0.1:3006/payrol?token=test-token-admin-review-mobile", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "docs/screenshots/admin-mobile-dark.png" });

  // 7. Mobile Employee Layout (390x844)
  console.log("7. Capturing Mobile Employee Layout...");
  await clearSession();
  await page.goto("http://127.0.0.1:3006/payrol?token=test-token-employee-review-mobile", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "docs/screenshots/employee-mobile-dark.png" });

  await browser.close();
  console.log("All review screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Screenshot capture error:", err);
  process.exit(1);
});
