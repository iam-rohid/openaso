import { AppWindowIcon } from "lucide-react";
import temporaryAppIcon from "@/assets/temporary-app-icon.png";
import { cn } from "@/lib/utils";

/** App Store icon with the iOS squircle-ish rounding and a graceful fallback. */
export function AppIcon({
  src,
  name,
  size = 32,
  temporary = false,
  className,
}: {
  src: string | null | undefined;
  name: string;
  /** Temporary (pre-launch) apps have no store artwork, so they get a placeholder icon. */
  temporary?: boolean;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, borderRadius: size * 0.225 };
  src ||= temporary ? temporaryAppIcon : null;
  if (!src) {
    return (
      <div
        style={style}
        className={cn("bg-muted text-muted-foreground flex shrink-0 items-center justify-center", className)}
        aria-label={name}
      >
        <AppWindowIcon style={{ width: size * 0.55, height: size * 0.55 }} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      style={style}
      className={cn("bg-muted ring-border shrink-0 object-cover ring-1", className)}
    />
  );
}
