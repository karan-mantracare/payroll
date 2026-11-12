"use client";

import React, { useState, useEffect, useRef } from "react";
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
  RefreshCw,
} from "lucide-react";
import { sanitizeUserFacingError } from "@/lib/security/safe-logger";

export type LoginState =
  | "unauthenticated"
  | "submitting_credentials"
  | "awaiting_otp"
  | "verifying_otp"
  | "authenticated"
  | "forbidden"
  | "recoverable_error";

const REQUEST_TIMEOUT_MS = 6000;

export default function LoginPage() {
  const { user } = useAuth();

  // State Machine
  const [loginState, setLoginState] = useState<LoginState>("unauthenticated");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [emailMasked, setEmailMasked] = useState("");
  const [isDevStaticEnabled, setIsDevStaticEnabled] = useState(false);
  const [otp, setOtp] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Self-Service Password Reset
  const [resetStep, setResetStep] = useState<"request" | "confirm">("request");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // 5-minute Countdown Timer (300 seconds)
  const [timeLeft, setTimeLeft] = useState(300);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cancel any pending fetch on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // If user is already authenticated, redirect immediately
  useEffect(() => {
    if (user) {
      const perms = Array.isArray(user.permissions) ? user.permissions : [];
      const canAdmin = Boolean(user.isSuperAdmin) || perms.includes("portal.admin.access");
      window.location.replace(canAdmin ? "/payroll/admin" : "/payroll/dash");
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

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const res = await fetch("/payroll/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email: resetEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to request password reset.");
      }

      setResetSuccess(data.message);
      if (data.devResetToken) {
        setResetToken(data.devResetToken);
      }
      setResetStep("confirm");
    } catch (err: any) {
      setResetError(err.message || "Unable to request password reset.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }
    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const res = await fetch("/payroll/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          token: resetToken.trim(),
          newPassword: resetNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to reset password.");
      }

      setResetSuccess("Password successfully updated. You may now sign in.");
      setTimeout(() => {
        setShowForgotModal(false);
        setResetStep("request");
        setResetSuccess(null);
        setResetToken("");
        setResetNewPassword("");
        setResetConfirmPassword("");
      }, 2500);
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  // Step 1: Submit Credentials
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginState === "submitting_credentials" || loginState === "verifying_otp") return;

    setError(null);
    setCorrelationId(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Please enter both your work email and password.");
      setLoginState("recoverable_error");
      return;
    }

    setLoginState("submitting_credentials");

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("/payroll/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        const safeMsg = sanitizeUserFacingError(
          data?.error,
          "Unable to complete sign-in right now. Please try again."
        );
        setError(safeMsg);
        setCorrelationId(data?.correlationId || null);

        if (res.status === 403 || data?.code === "ACCOUNT_INACTIVE" || data?.code === "EMPLOYEE_INACTIVE") {
          setLoginState("forbidden");
        } else {
          // Clear sensitive password on error, preserve email
          setPassword("");
          setLoginState("recoverable_error");
        }
        return;
      }

      setChallengeToken(data.challengeToken);
      setEmailMasked(data.emailMasked || cleanEmail);
      setIsDevStaticEnabled(Boolean(data.isDevStaticEnabled));
      setPassword(""); // Clear password from memory once challenge received
      setStep("otp");
      setLoginState("awaiting_otp");
      setError(null);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        setError("Sign-in request timed out. Please check your connection and retry.");
      } else {
        setError("Unable to connect to the authentication service. Please retry.");
      }
      setPassword("");
      setLoginState("recoverable_error");
    }
  };

  // Step 2: Submit OTP
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginState === "verifying_otp") return;

    setError(null);
    setCorrelationId(null);

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      setLoginState("recoverable_error");
      return;
    }

    setLoginState("verifying_otp");

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("/payroll/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken,
          otp: cleanOtp,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        const safeMsg = sanitizeUserFacingError(
          data?.error,
          "Unable to complete verification at this time. Please try again."
        );
        setError(safeMsg);
        setCorrelationId(data?.correlationId || null);
        setOtp(""); // Clear OTP on failure

        if (res.status === 403 || data?.code === "PORTAL_ACCESS_DENIED") {
          setLoginState("forbidden");
        } else {
          setLoginState("recoverable_error");
        }
        return;
      }

      // Success: Route directly to assigned portal
      setLoginState("authenticated");
      const targetUrl = data.redirectUrl || "/payroll/dash";
      window.location.replace(targetUrl);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        setError("Verification request timed out. Please retry.");
      } else {
        setError("Unable to connect to the verification service. Please retry.");
      }
      setOtp("");
      setLoginState("recoverable_error");
    }
  };

  // Retry Action
  const handleRetry = () => {
    setError(null);
    setCorrelationId(null);
    if (step === "otp") {
      setLoginState("awaiting_otp");
    } else {
      setLoginState("unauthenticated");
    }
  };

  // Back to Credentials
  const handleBackToCredentials = () => {
    setStep("credentials");
    setLoginState("unauthenticated");
    setError(null);
    setCorrelationId(null);
    setOtp("");
    setPassword("");
  };

  const isSubmitting = loginState === "submitting_credentials" || loginState === "verifying_otp";

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
          
          {/* Safe, Viewport-Bounded Error Alert */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex flex-col gap-2 text-xs text-rose-700 dark:text-rose-300 break-words overflow-hidden animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <div className="flex-1 font-medium leading-relaxed">{error}</div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-rose-200/60 dark:border-rose-900/60">
                {correlationId && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    Ref: {correlationId}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 dark:text-rose-200 hover:underline ml-auto"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            </div>
          )}

          {/* Forbidden Portal Access State */}
          {loginState === "forbidden" ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Access Restricted
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Your account does not have permission to access the Payroll portals, or your employee profile is inactive. Please contact People Operations for assistance.
              </p>
              <button
                type="button"
                onClick={handleBackToCredentials}
                style={{ color: "#ffffff" }}
                className="w-full py-2.5 px-4 bg-[#293381] hover:bg-[#1F2664] !text-white font-semibold rounded-xl text-xs sm:text-sm transition shadow-md shadow-[#293381]/20 flex items-center justify-center gap-2"
              >
                Back to Sign In
              </button>
            </div>
          ) : step === "credentials" ? (
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
                    disabled={isSubmitting}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@mantracare.com"
                    autoComplete="username"
                    className="block w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#36B4FF] focus:border-transparent transition disabled:opacity-60"
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
                    disabled={isSubmitting}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="block w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#36B4FF] focus:border-transparent transition disabled:opacity-60"
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
                disabled={isSubmitting}
                data-text-white="true"
                style={{ color: "#ffffff" }}
                className="w-full py-2.5 px-4 bg-[#293381] hover:bg-[#1F2664] !text-white font-semibold rounded-xl text-xs sm:text-sm transition shadow-md shadow-[#293381]/20 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#36B4FF] disabled:opacity-60"
              >
                {isSubmitting ? (
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
                  onClick={handleBackToCredentials}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#293381] dark:text-[#36B4FF] hover:underline mb-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </button>
                <h1 className="text-xl font-bold text-[#293381] dark:text-white">Verify Identity</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enter the 6-digit verification code dispatched to:{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {emailMasked}
                  </span>
                </p>
              </div>

              {/* Dev-Only Static OTP Callout */}
              {isDevStaticEnabled && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                  <div className="font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Local Development Mode
                  </div>
                  <div className="mt-1 text-[11px]">
                    Static OTP enabled for local test accounts:{" "}
                    <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded font-mono font-bold text-amber-950 dark:text-amber-100">
                      123456
                    </code>
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
                    disabled={isSubmitting}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="••••••"
                    className="block w-full text-center py-3 text-2xl font-mono tracking-[0.5em] bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#36B4FF] focus:border-transparent transition disabled:opacity-60"
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
                  title="In local development, use 123456."
                  className="text-slate-400 dark:text-slate-600 font-semibold cursor-not-allowed text-[11px]"
                >
                  Resend Code
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otp.length !== 6 || timeLeft === 0}
                data-text-white="true"
                style={{ color: "#ffffff" }}
                className="w-full py-2.5 px-4 bg-[#293381] hover:bg-[#1F2664] !text-white font-semibold rounded-xl text-xs sm:text-sm transition shadow-md shadow-[#293381]/20 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#36B4FF] disabled:opacity-60"
              >
                {isSubmitting ? (
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

      {/* Forgot Password / Self-Service Reset Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-[#293381]/10 text-[#293381] dark:text-[#36B4FF] rounded-xl flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-[#293381] dark:text-white">
                {resetStep === "request" ? "Reset Your Password" : "Enter Reset Token & New Password"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {resetStep === "request"
                  ? "Enter your work email address to receive a secure password reset token."
                  : "Enter the reset token along with your new secure password."}
              </p>
            </div>

            {resetError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            {resetSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{resetSuccess}</span>
              </div>
            )}

            {resetStep === "request" ? (
              <form onSubmit={handleRequestReset} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Work Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@mantra.care"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setResetError(null);
                      setResetSuccess(null);
                    }}
                    className="flex-1 py-2 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || !resetEmail.trim()}
                    style={{ color: "#ffffff" }}
                    className="flex-1 py-2 px-3 bg-[#293381] hover:bg-[#1F2664] !text-white font-semibold rounded-xl text-xs transition inline-flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {resetLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                    Request Token
                  </button>
                </div>

                <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setResetStep("confirm")}
                    className="text-[11px] text-[#293381] dark:text-[#36B4FF] hover:underline"
                  >
                    Already have a reset token? Enter it here →
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reset Token
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Paste your 64-char reset token"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full font-mono text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 8 chars, uppercase, lowercase, digit, symbol"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Re-type new password"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetStep("request")}
                    className="flex-1 py-2 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-50 transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || !resetToken.trim() || !resetNewPassword}
                    style={{ color: "#ffffff" }}
                    className="flex-1 py-2 px-3 bg-[#293381] hover:bg-[#1F2664] !text-white font-semibold rounded-xl text-xs transition inline-flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {resetLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                    Update Password
                  </button>
                </div>
              </form>
            )}

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                Need HR Support?
              </div>
              <div className="text-slate-500 font-mono">
                support@mantra.care • +91 11 4000 0000
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
