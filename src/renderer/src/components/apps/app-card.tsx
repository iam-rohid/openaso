import { KeyRoundIcon, StarIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AppIcon } from "@/components/shared/app-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { compactNumber } from "@/lib/format";
import { countryFlag } from "@shared/countries";

/** Grid card for a tracked app, used on the home and folder pages. */
export function AppCard({
  app,
}: {
  app: {
    id: string;
    name: string;
    developer: string;
    iconUrl: string | null;
    keywordCount: number;
    rating: number | null;
    ratingCount: number | null;
    isTemporary: boolean;
    country: string;
  };
}) {
  return (
    <Link to="/apps/$appId" params={{ appId: app.id }}>
      <Card className="hover:border-primary/40 hover:bg-muted/30 h-full transition-colors">
        <CardContent className="flex items-center gap-4">
          <AppIcon src={app.iconUrl} name={app.name} size={56} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-semibold">{app.name}</p>
            {app.isTemporary ? (
              <Badge variant="outline" className="text-muted-foreground h-4 px-1.5 text-[10px]">
                Temporary
              </Badge>
            ) : (
              <p className="text-muted-foreground truncate text-xs">{app.developer}</p>
            )}
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs whitespace-nowrap">
              <span className="inline-flex items-center gap-1">
                <KeyRoundIcon className="size-3" /> {app.keywordCount} keywords
              </span>
              <span title={`${app.country} storefront`}>
                {countryFlag(app.country)} {app.country}
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
