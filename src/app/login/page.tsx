"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/components/AuthGate";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Clock,
  ArrowLeft,
  Loader2,
  KeyRound,
  Info,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  // State
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [emailMasked, setEmailMasked] = useState("");
  const [isDevStaticEnabled, setIsDevStaticEnabled] = useState(false);
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // 5-minute Countdown Timer (300 seconds)
  const [timeLeft, setTimeLeft] = useState(300);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // If user is already authenticated, redirect immediately
  useEffect(() => {
    if (user) {
      const perms = Array.isArray(user.permissions) ? user.permissions : [];
      const canAdmin = Boolean(user.isSuperAdmin) || perms.includes("portal.admin.access");
      window.location.href = canAdmin ? "/payrol/admin" : "/payrol/dash";
    }
  }, [user]);

  // Start countdown when entering OTP step
  useEffect(() => {
    if (step === "otp") {
      setTimeLeft(300);
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  // Format timer seconds into MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Step 1: Submit Credentials
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter both your work email and password.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/payrol/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Authentication failed. Please check your credentials.");
        setLoading(false);
        return;
      }

      setChallengeToken(data.challengeToken);
      setEmailMasked(data.emailMasked || email);
      setIsDevStaticEnabled(!!data.isDevStaticEnabled);
      setStep("otp");
      setError(null);
    } catch (err: any) {
      setError("Network or server connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit OTP
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/payrol/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken,
          otp: cleanOtp,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Verification failed. Please try again.");
        setLoading(false);
        return;
      }

      // Success: Route directly to assigned portal
      const targetUrl = data.redirectUrl || "/payrol/dash";
      window.location.href = targetUrl;
    } catch (err: any) {
      setError("Verification failed due to a network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-[#36B4FF]/20 selection:text-[#293381]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-4">
          <BrandLogo size="lg" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#293381]/5 dark:bg-white/5 text-[#293381] dark:text-[#36B4FF] text-xs font-semibold tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5 text-[#36B4FF]" /> Enterprise HRMS & Payroll
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-[440px] px-4">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-xl shadow-slate-200/50 dark:shadow-none rounded-2xl border border-slate-200 dark:border-slate-800">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {step === "credentials" ? (
            /* STEP 1: WORK EMAIL & PASSWORD */
            <form onSubmit={handleCredentialsSubmit} className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-[#293381] dark:text-white">Sign In</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enter your official MantraCare work credentials to continue
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Work Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@mantracare.com"
                    autoComplete="username"
                    className="block w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#36B4FF] focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs font-semibold text-[#293381] dark:text-[#36B4FF] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="block w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#36B4FF] focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                data-text-white="true"
                style={{ color: "#ffffff" }}
                className="w-full py-2.5 px-4 bg-[#293381] hover:bg-[#1F2664] !text-white font-semibold rounded-xl text-xs sm:text-sm transition shadow-md shadow-[#293381]/20 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#36B4FF] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span style={{ color: "#ffffff" }}>Validating credentials...</span>
                  </>
                ) : (
                  <span style={{ color: "#ffffff" }} className="!text-white font-semibold">Sign In</span>
                )}
              </button>

              <div className="pt-2 text-center text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                Protected by MantraCare Encryption
              </div>
            </form>
          ) : (
            /* STEP 2: TWO-FACTOR OTP VERIFICATION */
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setError(null);
                    setOtp("");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#293381] dark:text-[#36B4FF] hover:underline mb-2 font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </button>
                <h1 className="text-xl font-bold text-[#293381] dark:text-white">Verify Your Login</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enter the 6-digit verification code sent to{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                    {emailMasked}
                  </span>
                </p>
              </div>

              {isDevStaticEnabled && (
                <div className="p-3 bg-[#EBF7FF] dark:bg-slate-800/80 border border-[#36B4FF]/30 rounded-xl text-xs text-[#293381] dark:text-[#36B4FF] flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Development Mode Active:</span> Static verification
                    code is <code className="font-mono font-bold bg-white dark:bg-slate-900 px-1 py-0.5 rounded">123456</code>.
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="••••••"
                    className="block w-full text-center py-3 text-2xl font-mono tracking-[0.5em] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#36B4FF] focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Countdown Timer & Expiration */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Expires in:</span>
                  <span
                    className={`font-mono font-bold ${
                      timeLeft < 60 ? "text-rose-500" : "text-[#293381] dark:text-[#36B4FF]"
                    }`}
                  >
                    {formatTime(timeLeft)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled
                  title="Production email delivery service is currently being configured. In local development, use 123456."
                  className="text-slate-400 dark:text-slate-600 font-semibold cursor-not-allowed text-[11px]"
                >
                  Resend Code
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6 || timeLeft === 0}
                data-text-white="true"
                style={{ color: "#ffffff" }}
                className="w-full py-2.5 px-4 bg-[#293381] hover:bg-[#1F2664] !text-white font-semibold rounded-xl text-xs sm:text-sm transition shadow-md shadow-[#293381]/20 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#36B4FF] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span style={{ color: "#ffffff" }}>Verifying code...</span>
                  </>
                ) : (
                  <span style={{ color: "#ffffff" }} className="!text-white font-semibold">Verify OTP</span>
                )}
              </button>

              <div className="pt-2 text-center text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                Protected by MantraCare Encryption
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-[#293381]/10 text-[#293381] dark:text-[#36B4FF] rounded-xl flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#293381] dark:text-white text-center">
              Password Assistance
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 text-center leading-relaxed">
              To maintain strict enterprise security, account passwords and two-factor configurations
              are provisioned by HR Administration.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="font-semibold text-slate-700 dark:text-slate-200">
                Contact People Operations:
              </div>
              <div className="text-slate-500 font-mono text-[11px]">hr@mantracare.com</div>
              <div className="text-slate-500 text-[11px]">Internal Ext: 4001 / HR Helpdesk</div>
            </div>
            <button
              onClick={() => setShowForgotModal(false)}
              data-text-white="true"
              style={{ color: "#ffffff" }}
              className="w-full py-2 bg-[#293381] hover:bg-[#1F2664] !text-white rounded-xl text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

