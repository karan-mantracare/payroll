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
      <head>
        {/* Automatic chunk load error recovery during deployment rollouts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                var isChunkError = /loading chunk|loading css chunk/i.test(e.message || '');
                var isScriptMimeError = e.target && e.target.tagName === 'SCRIPT' && /_next\\/static/i.test(e.target.src || '');
                if (isChunkError || isScriptMimeError) {
                  var lastReload = sessionStorage.getItem('mc_last_chunk_reload');
                  var now = Date.now();
                  if (!lastReload || (now - parseInt(lastReload, 10)) > 15000) {
                    sessionStorage.setItem('mc_last_chunk_reload', now.toString());
                    window.location.reload();
                  }
                }
              }, true);
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased font-sans">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
