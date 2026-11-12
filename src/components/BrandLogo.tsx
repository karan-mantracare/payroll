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
          src="/payroll/favicon.png"
          alt="MantraCare"
          className={`${boxSize} object-contain rounded-lg shadow-sm`}
        />
      </div>
    );
  }

  const heightClass = size === "sm" ? "h-6" : size === "lg" ? "h-9" : "h-7 sm:h-8";
  const pixelHeight = size === "sm" ? 24 : size === "lg" ? 36 : 30;

  return (
    <div className={`flex items-center shrink-0 ${className}`}>
      <img
        src="/payroll/mantracare-logo.png"
        alt="MantraCare"
        width={pixelHeight * 3.1}
        height={pixelHeight}
        className={`${heightClass} w-auto object-contain max-w-[150px]`}
        style={{ aspectRatio: "906 / 292", maxWidth: "150px", maxHeight: `${pixelHeight}px` }}
      />
    </div>
  );
}
