import puppeteer from "puppeteer";

async function capture() {
  console.log("Launching headless browser for screenshots...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Capture Admin Portal (/payrol/admin) via admin test token
  console.log("Navigating to Admin Portal...");
  await page.goto("http://127.0.0.1:3005/payrol?token=test-token-admin", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({
    path: "docs/screenshots/admin-portal.png",
    fullPage: false,
  });
  console.log("Captured docs/screenshots/admin-portal.png");

  // 2. Clear cookies to simulate fresh session
  const client = await page.target().createCDPSession();
  await client.send("Network.clearBrowserCookies");

  // 3. Capture Employee Portal (/payrol/dash) via employee test token
  console.log("Navigating to Employee Portal...");
  await page.goto("http://127.0.0.1:3005/payrol?token=test-token-employee", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({
    path: "docs/screenshots/employee-portal.png",
    fullPage: false,
  });
  console.log("Captured docs/screenshots/employee-portal.png");

  await browser.close();
  console.log("Screenshots captured successfully!");
}

capture().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
