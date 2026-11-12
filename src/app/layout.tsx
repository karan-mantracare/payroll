import "./globals.css";
import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "MantraCare HRMS & Payroll",
  description: "Enterprise HRMS & Payroll inside the MantraCare Programs Ecosystem",
  icons: {
    icon: "/payroll/favicon.ico",
    shortcut: "/payroll/favicon.png",
    apple: "/payroll/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased font-sans">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
