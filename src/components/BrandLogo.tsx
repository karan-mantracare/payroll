import React from "react";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  compact?: boolean;
}

export function BrandLogo({ className = "", size = "md", compact = false }: BrandLogoProps) {
  if (compact) {
    const boxSize = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-11 h-11" : "w-9 h-9";

    return (
      <div className={`flex items-center justify-center shrink-0 ${className}`} title="MantraCare">
        <img
          src="/payrol/favicon.png"
          alt="MantraCare"
          className={`${boxSize} object-contain rounded-lg shadow-sm`}
        />
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
