"use client";

import { useState } from "react";

type LandingCoverProps = {
  src?: string;
  alt: string;
  className?: string;
  priority?: boolean;
};

export function LandingCover({ src, alt, className = "", priority = false }: LandingCoverProps) {
  const [imageSrc, setImageSrc] = useState(src || "/happinotes-logo.png");

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      onError={() => setImageSrc("/happinotes-logo.png")}
    />
  );
}
