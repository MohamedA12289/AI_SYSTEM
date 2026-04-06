import bearLogo from "@/assets/bear-logo.png";

interface Props {
  size?: number;
  className?: string;
}

export function CubOSBear({ size = 40, className = "" }: Props) {
  return (
    <img
      src={bearLogo}
      alt="CubOS Bear"
      width={size}
      height={size}
      className={`dark:invert mix-blend-multiply dark:mix-blend-screen ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function CubOSLogo({ size = 24, showText = true, className = "" }: Props & { showText?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <CubOSBear size={size} />
      {showText && (
        <span className="font-semibold text-foreground tracking-tight text-sm">
          CubOS
        </span>
      )}
    </div>
  );
}
