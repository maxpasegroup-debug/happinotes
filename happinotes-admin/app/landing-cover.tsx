"use client";

import Image from "next/image";

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
    <Image
      width={300}
      height={400}
      sizes="(max-width: 640px) 50vw, 300px"
      unoptimized={imageSrc !== "/happinotes-logo.png"}
      src={imageSrc}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setImageSrc("/happinotes-logo.png")}
    />
  );
}
