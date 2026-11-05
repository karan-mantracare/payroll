import puppeteer from "puppeteer";
import fs from "fs";

async function main() {
  console.log("Starting Puppeteer screenshot capture for MantraCare Brand Theme on port 3006...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  const clearSession = async () => {
    const client = await page.target().createCDPSession();
    await client.send("Network.clearBrowserCookies");
  };

  // 1. Authenticate as Admin & capture Admin Dashboard (Light Mode)
  console.log("1. Authenticating as Admin & capturing Admin Dashboard...");
  await page.setViewport({ width: 1440, height: 960 });
  await clearSession();
  const adminToken = `test-token-admin-${Date.now()}`;
  await page.goto(`http://127.0.0.1:3006/payrol?token=${adminToken}`, {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1500));

  await page.goto("http://127.0.0.1:3006/payrol/admin", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: "docs/screenshots/admin-portal.png" });
  await page.screenshot({ path: "docs/screenshots/admin-desktop-light.png" });

  // 2. Capture Admin Employee Directory
  console.log("2. Capturing Admin Employee Directory...");
  await page.goto("http://127.0.0.1:3006/payrol/admin/employees", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: "docs/screenshots/admin-employees-directory.png" });

  // 3. Navigate to Employee Detail for EMP-002 and switch to Reporting Hierarchy Tab
  console.log("3. Capturing Admin Reporting Hierarchy Tab & Org Subtree for EMP-002...");
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

  // 4. Open Change Reporting Manager Modal
  console.log("4. Capturing Change Reporting Manager Modal...");
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

  // 5. Authenticate as Multi-Role / Team Manager and view Employee Dashboard
  console.log("5. Capturing Employee Portal Dashboard...");
  await clearSession();
  const multiroleToken = `test-token-multirole-${Date.now()}`;
  await page.goto(`http://127.0.0.1:3006/payrol?token=${multiroleToken}`, {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1500));

  await page.goto("http://127.0.0.1:3006/payrol/dash", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: "docs/screenshots/employee-portal.png" });
  await page.screenshot({ path: "docs/screenshots/employee-desktop-light.png" });

  // 6. Capture Employee Profile
  console.log("6. Capturing Employee Profile...");
  await page.goto("http://127.0.0.1:3006/payrol/dash/profile", {
    waitUntil: "networkidle0",
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: "docs/screenshots/employee-profile.png" });

  // 7. Capture Employee Team Page
  console.log("7. Capturing Employee Portal My Team & Reporting Line...");
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

  const screenshots = [
    "admin-portal.png",
    "admin-desktop-light.png",
    "admin-employees-directory.png",
    "admin-hierarchy-tree.png",
    "admin-change-manager-modal.png",
    "employee-portal.png",
    "employee-desktop-light.png",
    "employee-profile.png",
    "employee-team-page.png",
  ];

  for (const file of screenshots) {
    if (fs.existsSync(`docs/screenshots/${file}`)) {
      fs.copyFileSync(`docs/screenshots/${file}`, `${brainDir}/${file}`);
    }
  }

  console.log("All screenshots captured successfully!");
  await browser.close();
}

main().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});


