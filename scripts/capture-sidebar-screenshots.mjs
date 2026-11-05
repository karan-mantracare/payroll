import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const ARTIFACT_SCREENSHOTS_DIR = "/home/karan/.gemini/antigravity/brain/4ca20f71-7888-49a2-8075-49fdd6efd825/screenshots";
const DOCS_SCREENSHOTS_DIR = "docs/screenshots";

async function main() {
  console.log("Preparing standalone static assets...");
  try {
    fs.cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
    fs.cpSync("public", ".next/standalone/public", { recursive: true });
  } catch (e) {
    console.warn("Asset sync warning:", e.message);
  }

  console.log("Starting Next.js server on port 3007...");
  const dbPath = path.resolve(process.cwd(), "local.db");
  const server = spawn("node", [".next/standalone/server.js"], {
    env: {
      ...process.env,
      PORT: "3007",
      HOSTNAME: "127.0.0.1",
      MOCK_PROGRAMS_API: "true",
      TURSO_DATABASE_URL: "file:" + dbPath,
    },
    stdio: "inherit",
  });

  // Wait for server to start
  await new Promise((r) => setTimeout(r, 2000));

  console.log("Starting Puppeteer browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  const clearSession = async () => {
    const client = await page.target().createCDPSession();
    await client.send("Network.clearBrowserCookies");
  };

  const saveScreenshot = async (name) => {
    const docsPath = path.join(DOCS_SCREENSHOTS_DIR, name);
    const artifactPath = path.join(ARTIFACT_SCREENSHOTS_DIR, name);
    fs.mkdirSync(path.dirname(docsPath), { recursive: true });
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    await page.screenshot({ path: docsPath });
    fs.copyFileSync(docsPath, artifactPath);
    console.log(`Saved screenshot: ${name}`);
  };

  try {
    // 1. Authenticate as Admin & capture Admin Dashboard (Expanded)
    console.log("1. Authenticating as Admin directly on /payrol/admin...");
    await page.setViewport({ width: 1440, height: 960 });
    await clearSession();
    const adminToken = `test-token-admin-${Date.now()}`;
    await page.goto(`http://127.0.0.1:3007/payrol/admin?token=${adminToken}`, {
      waitUntil: "networkidle0",
    });
    await page.waitForSelector('button[aria-label="Collapse sidebar"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));
    await saveScreenshot("admin-sidebar-expanded.png");
    await saveScreenshot("admin-portal.png");
    await saveScreenshot("admin-desktop-light.png");

    // 2. Collapse Sidebar by clicking the collapse toggle button
    console.log("2. Collapsing Admin Sidebar...");
    const collapseBtn = await page.waitForSelector('button[aria-label="Collapse sidebar"]', { timeout: 6000 }).catch(() => null);
    if (collapseBtn) {
      await collapseBtn.click();
      await new Promise((r) => setTimeout(r, 600)); // wait for 200ms transition
      await saveScreenshot("admin-sidebar-collapsed.png");

      // 3. Hover over an item to capture floating tooltip
      console.log("3. Hovering over a collapsed item for tooltip...");
      const icons = await page.$$('aside nav a');
      if (icons.length > 1) {
        await icons[1].hover();
        await new Promise((r) => setTimeout(r, 400));
        await saveScreenshot("admin-sidebar-tooltip.png");
      }

      // Re-expand for next steps
      const expandBtn = await page.waitForSelector('button[aria-label="Expand sidebar"]', { timeout: 4000 }).catch(() => null);
      if (expandBtn) {
        await expandBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    } else {
      console.error("Could not find collapse sidebar button!");
    }

    // 4. Capture Mobile Layout with Drawer
    console.log("4. Testing Mobile Viewport & Drawer Overlay...");
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await new Promise((r) => setTimeout(r, 500));
    const mobileMenuBtn = await page.$('button[aria-label="Toggle Navigation Menu"]');
    if (mobileMenuBtn) {
      await mobileMenuBtn.click();
      await new Promise((r) => setTimeout(r, 600));
      await saveScreenshot("admin-sidebar-mobile.png");
    }

    // 5. Authenticate as Employee & capture Employee Dashboard
    console.log("5. Authenticating as Employee directly on /payrol/dash...");
    await page.setViewport({ width: 1440, height: 960 });
    await clearSession();
    const empToken = `test-token-employee-${Date.now()}`;
    await page.goto(`http://127.0.0.1:3007/payrol/dash?token=${empToken}`, {
      waitUntil: "networkidle0",
    });
    await page.waitForSelector('button[aria-label="Collapse sidebar"]', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));
    await saveScreenshot("employee-sidebar-expanded.png");
    await saveScreenshot("employee-portal.png");
    await saveScreenshot("employee-desktop-light.png");

    // 6. Collapse Employee Sidebar
    console.log("6. Collapsing Employee Sidebar...");
    const empCollapseBtn = await page.waitForSelector('button[aria-label="Collapse sidebar"]', { timeout: 6000 }).catch(() => null);
    if (empCollapseBtn) {
      await empCollapseBtn.click();
      await new Promise((r) => setTimeout(r, 600));
      await saveScreenshot("employee-sidebar-collapsed.png");
    } else {
      console.error("Could not find employee collapse button!");
    }

    console.log("All screenshots captured successfully!");
  } catch (err) {
    console.error("Screenshot capture failed:", err);
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch(console.error);
