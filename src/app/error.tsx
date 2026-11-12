"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-bold text-[#293381] dark:text-white">
          Something went wrong
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          A temporary rendering error occurred. Click Retry to reload the view cleanly.
        </p>
        <div className="flex items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#293381] hover:bg-[#1F2664] text-white text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
          <a
            href="/payrol/login"
            className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition"
          >
            Go to Login
          </a>
        </div>
      </div>
    </div>
  );
}

