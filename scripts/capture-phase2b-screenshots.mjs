import puppeteer from "puppeteer";
import fs from "fs";

async function main() {
  console.log("Starting Puppeteer screenshot capture for Phase 2B on port 3006...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  const clearSession = async () => {
    const client = await page.target().createCDPSession();
    await client.send("Network.clearBrowserCookies");
  };

  // 1. Authenticate as Admin
  console.log("1. Authenticating as Admin...");
  await page.setViewport({ width: 1440, height: 960 });
  await clearSession();
  await page.goto("http://127.0.0.1:3006/payrol?token=test-token-admin-review-phase2b-1", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1200));

  // 2. Navigate to Employee Detail for EMP-002 and switch to Reporting Hierarchy Tab
  console.log("2. Capturing Admin Reporting Hierarchy Tab & Org Subtree for EMP-002...");
  await page.goto("http://127.0.0.1:3006/payrol/admin/employees/EMP-002", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Click on "Reporting Hierarchy & Tree" tab
  const tabs = await page.$$("button");
  for (const tab of tabs) {
    const text = await page.evaluate((el) => el.innerText, tab);
    if (text.includes("Reporting Hierarchy")) {
      await tab.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: "docs/screenshots/admin-hierarchy-tree.png" });

  // 3. Open Change Reporting Manager Modal
  console.log("3. Capturing Change Reporting Manager Modal...");
  const buttons = await page.$$("button");
  for (const btn of buttons) {
    const text = await page.evaluate((el) => el.innerText, btn);
    if (text.includes("Change Manager") || text.includes("Edit Manager")) {
      await btn.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: "docs/screenshots/admin-change-manager-modal.png" });

  // 4. Authenticate as Multi-Role / Team Manager and view Employee Portal /dash/team
  console.log("4. Capturing Employee Portal My Team & Reporting Line...");
  await clearSession();
  await page.goto("http://127.0.0.1:3006/payrol?token=test-token-multirole-review-phase2b-1", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1200));

  await page.goto("http://127.0.0.1:3006/payrol/dash/team", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: "docs/screenshots/employee-team-page.png" });

  // Copy screenshots to brain artifact directory
  const brainDir = "/home/karan/.gemini/antigravity/brain/4ca20f71-7888-49a2-8075-49fdd6efd825/screenshots";
  if (!fs.existsSync(brainDir)) {
    fs.mkdirSync(brainDir, { recursive: true });
  }

  for (const file of [
    "admin-hierarchy-tree.png",
    "admin-change-manager-modal.png",
    "employee-team-page.png",
  ]) {
    if (fs.existsSync(`docs/screenshots/${file}`)) {
      fs.copyFileSync(`docs/screenshots/${file}`, `${brainDir}/${file}`);
    }
  }

  console.log("Screenshots captured successfully!");
  await browser.close();
}

main().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});
