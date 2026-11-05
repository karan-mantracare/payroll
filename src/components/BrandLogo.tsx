import React from "react";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  compact?: boolean;
}

export function BrandLogo({ className = "", size = "md", compact = false }: BrandLogoProps) {
  if (compact) {
    const boxSize = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-11 h-11" : "w-9 h-9";
    const iconSize = size === "sm" ? "w-5 h-5" : size === "lg" ? "w-7 h-7" : "w-6 h-6";

    return (
      <div
        className={`flex items-center justify-center shrink-0 rounded-xl bg-[#293381] text-white shadow-sm border border-[#293381]/20 ${boxSize} ${className}`}
        title="MantraCare"
      >
        {/* Compact MantraCare Monogram Logo */}
        <svg
          viewBox="0 0 36 36"
          className={`${iconSize} fill-none`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 26V11L14 20L18 15L22 20L28 11V26"
            stroke="#FFFFFF"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="9.5" r="2" fill="#36B4FF" />
        </svg>
      </div>
    );
  }

  const heightClass = size === "sm" ? "h-6" : size === "lg" ? "h-9" : "h-7 sm:h-8";

  return (
    <div className={`flex items-center shrink-0 ${className}`}>
      <img
        src="/payrol/mantracare-logo.png"
        alt="MantraCare"
        className={`${heightClass} w-auto object-contain max-w-[150px]`}
        style={{ aspectRatio: "906 / 292" }}
      />
    </div>
  );
}
