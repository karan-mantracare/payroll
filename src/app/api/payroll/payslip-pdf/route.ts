import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";

export const runtime = "nodejs";

function escapeHtml(value: string | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getLogoDataUri(): string {
  try {
    const logoPath = path.join(process.cwd(), "public", "mantracare-logo.png");
    const buffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

interface PayslipPdfRequestBody {
  kind?: "employee" | "admin";
  fileName?: string;
  title?: string;
  subtitle?: string;
  documentTag?: string;
  // Employee payslip fields
  employeeName?: string;
  employeeCode?: string;
  disbursedDate?: string;
  status?: string;
  basic?: string;
  hra?: string;
  specialAllowance?: string;
  conveyance?: string;
  gross?: string;
  pf?: string;
  tax?: string;
  profTax?: string;
  deductions?: string;
  net?: string;
  // Admin payroll cycle fields
  payrollCycle?: string;
  headcount?: number;
  totalGross?: string;
  totalDeductions?: string;
  totalNet?: string;
}

function buildLetterheadHtml(data: PayslipPdfRequestBody, logoDataUri: string): string {
  const isAdmin = data.kind === "admin";
  const documentTag = escapeHtml(
    data.documentTag ||
      (isAdmin ? "CORPORATE PAYROLL STATEMENT" : "MONTHLY SALARY STATEMENT")
  );
  const title = escapeHtml(data.title || "Payslip Statement");
  const subtitle = escapeHtml(data.subtitle || "");

  const bodySection = isAdmin
    ? `
      <div class="meta-grid-2">
        <div>
          <span class="meta-label">Payroll Cycle</span>
          <span class="meta-value">${escapeHtml(data.payrollCycle)}</span>
        </div>
        <div>
          <span class="meta-label">Eligible Headcount</span>
          <span class="meta-value">${escapeHtml(String(data.headcount ?? 0))} Employees</span>
        </div>
        <div>
          <span class="meta-label">Disbursed Date</span>
          <span class="meta-value">${escapeHtml(data.disbursedDate)}</span>
        </div>
        <div>
          <span class="meta-label">Disbursement Status</span>
          <span class="meta-value status-ok">${escapeHtml(data.status || "Completed")}</span>
        </div>
      </div>

      <div class="summary-card">
        <div class="row">
          <span class="row-label">Total Gross Pay</span>
          <span class="row-val">${escapeHtml(data.totalGross)}</span>
        </div>
        <div class="row">
          <span class="row-label">Total Statutory Deductions (PF, TDS, PT)</span>
          <span class="row-val text-rose">${escapeHtml(data.totalDeductions)}</span>
        </div>
        <div class="row row-total">
          <span class="row-label-bold">Total Net Disbursed</span>
          <span class="row-val text-emerald">${escapeHtml(data.totalNet)}</span>
        </div>
      </div>
    `
    : `
      <div class="meta-grid-4">
        <div>
          <span class="meta-label">Employee</span>
          <span class="meta-value">${escapeHtml(data.employeeName || "Employee")}</span>
        </div>
        <div>
          <span class="meta-label">Employee ID</span>
          <span class="meta-value mono">${escapeHtml(data.employeeCode || "EMP-001")}</span>
        </div>
        <div>
          <span class="meta-label">Disbursed Date</span>
          <span class="meta-value">${escapeHtml(data.disbursedDate)}</span>
        </div>
        <div>
          <span class="meta-label">Status</span>
          <span class="meta-value status-ok">&#10003; ${escapeHtml(data.status || "Paid")}</span>
        </div>
      </div>

      <div class="two-col">
        <div class="table-card">
          <div class="table-head">
            <span class="table-head-title">&#8593; Earnings</span>
            <span class="table-head-sub">Amount</span>
          </div>
          <div class="row">
            <span class="row-label">Basic Salary</span>
            <span class="row-val">${escapeHtml(data.basic)}</span>
          </div>
          <div class="row">
            <span class="row-label">House Rent Allowance (HRA)</span>
            <span class="row-val">${escapeHtml(data.hra)}</span>
          </div>
          <div class="row">
            <span class="row-label">Special Allowance</span>
            <span class="row-val">${escapeHtml(data.specialAllowance)}</span>
          </div>
          <div class="row">
            <span class="row-label">Conveyance Allowance</span>
            <span class="row-val">${escapeHtml(data.conveyance)}</span>
          </div>
          <div class="row row-total">
            <span class="row-label-bold">Total Gross</span>
            <span class="row-val text-emerald">${escapeHtml(data.gross)}</span>
          </div>
        </div>

        <div class="table-card">
          <div class="table-head">
            <span class="table-head-title">&#8595; Deductions</span>
            <span class="table-head-sub">Amount</span>
          </div>
          <div class="row">
            <span class="row-label">Provident Fund (PF)</span>
            <span class="row-val">${escapeHtml(data.pf)}</span>
          </div>
          <div class="row">
            <span class="row-label">Income Tax (TDS)</span>
            <span class="row-val">${escapeHtml(data.tax)}</span>
          </div>
          <div class="row">
            <span class="row-label">Professional Tax (PT)</span>
            <span class="row-val">${escapeHtml(data.profTax)}</span>
          </div>
          <div class="row row-spacer">
            <span>&nbsp;</span>
            <span>&nbsp;</span>
          </div>
          <div class="row row-total">
            <span class="row-label-bold">Total Deductions</span>
            <span class="row-val text-rose">${escapeHtml(data.deductions)}</span>
          </div>
        </div>
      </div>

      <div class="net-box">
        <div>
          <div class="net-label">Net Take-Home Salary</div>
          <div class="net-sub">Disbursed to HDFC Bank A/C ending in 4892</div>
        </div>
        <div class="net-right">
          <div class="net-amount">${escapeHtml(data.net)}</div>
          <div class="net-words">Seventy-Five Thousand Only</div>
        </div>
      </div>
    `;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #0f172a;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .sheet {
        width: 100%;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        overflow: hidden;
      }
      .top-ribbon {
        position: relative;
        height: 12px;
        background: #cfe5f7;
        overflow: hidden;
      }
      .top-ribbon-accent {
        position: absolute;
        right: 0;
        top: 0;
        height: 100%;
        width: 200px;
        background: linear-gradient(90deg, #293381 0%, #293381 60%, #36B4FF 100%);
        clip-path: polygon(12% 0, 100% 0, 100% 100%, 0% 100%);
      }
      .masthead {
        padding: 20px 24px 16px 24px;
        border-bottom: 1px solid #e2e8f0;
        background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }
      .logo-img {
        height: 38px;
        width: auto;
        object-fit: contain;
        display: block;
      }
      .company-name {
        margin: 6px 0 2px 0;
        font-size: 11px;
        font-weight: 700;
        color: #293381;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .company-reg {
        margin: 0;
        font-size: 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #64748b;
      }
      .masthead-right {
        text-align: right;
      }
      .doc-tag {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 9999px;
        background: #293381;
        color: #ffffff;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .doc-title {
        margin: 6px 0 2px 0;
        font-size: 14px;
        font-weight: 700;
        color: #293381;
      }
      .doc-sub {
        margin: 0;
        font-size: 11px;
        color: #64748b;
        font-weight: 500;
      }
      .content {
        padding: 22px 24px;
      }
      .meta-grid-4 {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        padding: 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        margin-bottom: 18px;
      }
      .meta-grid-2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        padding: 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        margin-bottom: 18px;
      }
      .meta-label {
        display: block;
        font-size: 10px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        margin-bottom: 2px;
      }
      .meta-value {
        font-size: 12px;
        font-weight: 600;
        color: #1e293b;
      }
      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      .status-ok {
        color: #059669;
      }
      .two-col {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        margin-bottom: 18px;
      }
      .table-card, .summary-card {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
      }
      .table-head {
        background: #f1f5f9;
        padding: 9px 14px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .table-head-title {
        font-size: 12px;
        font-weight: 600;
        color: #1e293b;
      }
      .table-head-sub {
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
      }
      .row {
        padding: 10px 14px;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        justify-content: space-between;
        font-size: 12px;
      }
      .row:last-child {
        border-bottom: none;
      }
      .row-spacer {
        color: transparent;
      }
      .row-label {
        color: #475569;
      }
      .row-label-bold {
        color: #1e293b;
        font-weight: 600;
      }
      .row-val {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-weight: 500;
        color: #0f172a;
      }
      .row-total {
        background: #f8fafc;
        font-weight: 600;
      }
      .text-emerald {
        color: #059669 !important;
        font-weight: 600;
      }
      .text-rose {
        color: #e11d48 !important;
        font-weight: 600;
      }
      .net-box {
        padding: 16px;
        border-radius: 10px;
        border: 1px solid rgba(16, 185, 129, 0.35);
        background: linear-gradient(90deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.03) 65%, #ffffff 100%);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .net-label {
        font-size: 12px;
        font-weight: 600;
        color: #065f46;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .net-sub {
        font-size: 11px;
        color: #64748b;
        margin-top: 2px;
      }
      .net-right {
        text-align: right;
      }
      .net-amount {
        font-size: 24px;
        font-weight: 700;
        color: #059669;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      .net-words {
        font-size: 10px;
        color: #64748b;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      .signatory-strip {
        padding: 4px 24px 16px 24px;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
      }
      .verified-note {
        font-size: 10px;
        color: #64748b;
      }
      .sig-block {
        text-align: right;
      }
      .sig-company {
        font-size: 11px;
        font-weight: 700;
        color: #293381;
      }
      .sig-label {
        margin-top: 4px;
        padding-top: 4px;
        border-top: 1px solid #cbd5e1;
        font-size: 10px;
        font-weight: 600;
        color: #64748b;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .footer {
        position: relative;
        background: #eef6fc;
        border-top: 1px solid #e2e8f0;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 10px;
        color: #475569;
      }
      .footer-left {
        display: flex;
        gap: 16px;
        font-weight: 500;
        color: #293381;
      }
      .footer-accent {
        position: absolute;
        left: 0;
        bottom: 0;
        height: 6px;
        width: 145px;
        background: linear-gradient(90deg, #36B4FF 0%, #293381 100%);
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="top-ribbon">
        <div class="top-ribbon-accent"></div>
      </div>

      <div class="masthead">
        <div>
          ${logoDataUri ? `<img class="logo-img" src="${logoDataUri}" alt="MantraCare" />` : ""}
          <p class="company-name">Mantra Care Health Pvt. Ltd.</p>
          <p class="company-reg">CIN: U85110DL2021PTC386439 &nbsp;|&nbsp; PAN: AAOCM9569M</p>
        </div>
        <div class="masthead-right">
          <span class="doc-tag">${documentTag}</span>
          <h2 class="doc-title">${title}</h2>
          <p class="doc-sub">${subtitle}</p>
        </div>
      </div>

      <div class="content">
        ${bodySection}
      </div>

      <div class="signatory-strip">
        <div class="verified-note">
          &#10003; Computer-generated salary statement verified via MantraCare HRMS.
        </div>
        <div class="sig-block">
          <div class="sig-company">Mantra Care Health Pvt. Ltd.</div>
          <div class="sig-label">Authorized Signatory</div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-left">
          <span>mantracare.org</span>
          <span>hr@mantracare.org</span>
        </div>
        <div>A1/10, 3rd Floor, Paschim Vihar, Delhi - 110063</div>
        <div class="footer-accent"></div>
      </div>
    </div>
  </body>
</html>`;
}

export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let browser: import("puppeteer").Browser | null = null;
  try {
    const body = (await req.json()) as PayslipPdfRequestBody;
    const logoDataUri = getLogoDataUri();
    const html = buildLetterheadHtml(
      {
        ...body,
        employeeName: body.employeeName || session.name,
        employeeCode: body.employeeCode || session.employeeId || "EMP-008",
      },
      logoDataUri
    );

    const puppeteer = (await import("puppeteer")).default;
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      ["/usr/bin/chromium-browser", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
    browser = await puppeteer.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });

    const rawFileName = (body.fileName || "Payslip-Statement")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${rawFileName || "Payslip"}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Failed to generate payslip PDF:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate PDF payslip" },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

