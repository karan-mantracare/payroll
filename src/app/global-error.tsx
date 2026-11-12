"use client";

import React from "react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAFC] text-slate-900 flex items-center justify-center p-4 font-sans antialiased">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-4">
          <h2 className="text-lg font-bold text-[#293381]">
            Application Refresh Required
          </h2>
          <p className="text-xs text-slate-500">
            The portal encountered a critical error or stale build chunk. Please reload to continue.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2 rounded-xl bg-[#293381] text-white text-xs font-semibold hover:bg-[#1F2664] transition"
            >
              Reload App
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
            >
              Hard Refresh
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

