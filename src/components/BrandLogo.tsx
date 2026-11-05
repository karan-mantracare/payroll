import React from "react";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function BrandLogo({ className = "", size = "md" }: BrandLogoProps) {
  const heightClass = size === "sm" ? "h-6" : size === "lg" ? "h-10" : "h-8";

  return (
    <div className={`flex items-center shrink-0 ${className}`}>
      <img
        src="/payrol/mantracare-logo.png"
        alt="MantraCare"
        className={`${heightClass} w-auto object-contain max-w-[160px]`}
        style={{ aspectRatio: "906 / 292" }}
      />
    </div>
  );
}

