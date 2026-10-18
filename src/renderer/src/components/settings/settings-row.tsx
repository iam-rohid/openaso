import { cn } from "@/lib/utils";

/**
 * Segmented-control items whose chosen option stands out against the outline. Keyed off
 * aria-checked, since a tooltip trigger around an item replaces its data-state.
 */
export const SEGMENT_ITEM =
  "text-muted-foreground aria-checked:bg-foreground/10 aria-checked:text-foreground dark:aria-checked:bg-foreground/15";

/** A titled group of rows in a settings page. */
export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 last:mb-0">
      <h2 className="mb-1 text-base font-semibold">{title}</h2>
      <div className="divide-y">{children}</div>
    </section>
  );
}

/** One setting: label and description on the left, its control on the right, extra content below. */
export function SettingsRow({
  label,
  htmlFor,
  description,
  control,
  children,
  className,
}: {
  label: string;
  /** The control's id, so clicking the label toggles it. */
  htmlFor?: string;
  description?: React.ReactNode;
  control?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-4", className)}>
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0 space-y-1">
          <label htmlFor={htmlFor} className="block text-sm font-medium">
            {label}
          </label>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>
      {children}
    </div>
  );
}
