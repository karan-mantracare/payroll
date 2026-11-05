import "./globals.css";
import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "MantraCare HRMS & Payroll",
  description: "Enterprise HRMS & Payroll inside the MantraCare Programs Ecosystem",
  icons: {
    icon: "/payrol/favicon.ico",
    shortcut: "/payrol/favicon.png",
    apple: "/payrol/favicon.png",
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
