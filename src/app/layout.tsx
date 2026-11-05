import "./globals.css";
import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "MantraCare HRMS & Payroll",
  description: "Enterprise HRMS & Payroll inside the MantraCare Programs Ecosystem",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}

