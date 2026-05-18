import type { CSSProperties } from "react";

interface AvatarProps {
  size?: number;
  ring?: boolean;
  useImage?: boolean;
  className?: string;
}

export function Avatar({ size = 48, ring = true, useImage = false, className = "" }: AvatarProps) {
  const ringPx = Math.max(1.5, size / 28);
  const style: CSSProperties = {
    width: size,
    height: size,
    background: "radial-gradient(circle at 35% 30%, #3d6f48, var(--color-forest-deep) 75%)",
    border: ring ? `${ringPx}px solid var(--color-gold)` : "none",
    color: "var(--color-cream)",
    fontFamily: "var(--font-serif)",
    fontStyle: "italic",
    fontSize: size * 0.55,
    fontWeight: 500,
    lineHeight: 1,
    boxShadow:
      size > 60
        ? "0 1px 0 rgba(255,255,255,0.15) inset, 0 8px 24px rgba(24,51,33,0.25)"
        : undefined,
  };

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${className}`}
      style={style}
    aria-label="Farmer Acharya"
  >
      <span style={{ transform: "translateY(-2%)" }}>{useImage ? "F" : "F"}</span>
    </div>
  );
}
