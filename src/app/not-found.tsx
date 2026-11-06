import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col justify-center items-center px-4 text-center">
      <div className="mb-6">
        <BrandLogo size="lg" />
      </div>
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full space-y-4">
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#293381] text-white">
          404 — Not Found
        </span>
        <h1 className="text-xl font-bold text-[#293381] dark:text-white">
          Page Not Found
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The requested payroll or workforce page does not exist or has been moved.
        </p>
        <Link
          href="/login"
          style={{ color: "#ffffff" }}
          className="inline-flex justify-center items-center w-full py-2.5 px-4 bg-[#293381] hover:bg-[#1F2664] !text-white font-semibold rounded-xl text-xs sm:text-sm transition shadow-md shadow-[#293381]/20"
        >
          Return to Portal
        </Link>
      </div>
    </div>
  );
}
