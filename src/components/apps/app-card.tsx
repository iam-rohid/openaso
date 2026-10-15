import { KeyRoundIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { AppIcon } from "@/components/shared/app-icon";
import { Card, CardContent } from "@/components/ui/card";
import { compactNumber } from "@/lib/format";

/** Grid card for a tracked app, used on the home and folder pages. */
export function AppCard({
  app,
  href,
}: {
  app: {
    name: string;
    developer: string;
    iconUrl: string | null;
    keywordCount: number;
    rating: number | null;
    ratingCount: number | null;
  };
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/40 hover:bg-muted/30 h-full transition-colors">
        <CardContent className="flex items-center gap-4">
          <AppIcon src={app.iconUrl} name={app.name} size={56} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-semibold">{app.name}</p>
            <p className="text-muted-foreground truncate text-xs">{app.developer}</p>
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1">
                <KeyRoundIcon className="size-3" /> {app.keywordCount} keywords
              </span>
              {app.rating != null && (
                <span className="inline-flex items-center gap-1">
                  <StarIcon className="size-3 fill-current" /> {app.rating.toFixed(1)} (
                  {compactNumber(app.ratingCount ?? 0)})
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
