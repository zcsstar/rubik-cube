interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Isometric three-coloured cube mark. Uses currentColor for the outline so
 * it adapts to dark / light mode automatically.
 */
export function Logo({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 3 L29 10 L29 22 L16 29 L3 22 L3 10 Z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M16 3 L29 10 L16 17 L3 10 Z" fill="#FFD500" />
      <path d="M3 10 L16 17 L16 29 L3 22 Z" fill="#00B04B" />
      <path d="M29 10 L16 17 L16 29 L29 22 Z" fill="#1A66FF" />
    </svg>
  );
}
