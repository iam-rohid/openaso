import { CopyIcon, LineChartIcon, MoreHorizontalIcon, StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** External links for an app: copy its App Store link, or open it in the App Store or Sensor Tower. */
export function AppLinksMenu({
  appId,
  country,
  storeUrl,
  size = "icon-sm",
  variant = "ghost",
}: {
  appId: string;
  country: string;
  storeUrl?: string | null;
  size?: "icon" | "icon-sm";
  variant?: "ghost" | "outline";
}) {
  const appStoreUrl = storeUrl ?? `https://apps.apple.com/${country.toLowerCase()}/app/id${appId}`;
  const sensorTowerUrl = `https://app.sensortower.com/overview/${appId}?country=${country.toUpperCase()}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <MoreHorizontalIcon />
          <span className="sr-only">App links</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem
          onClick={() => {
            void navigator.clipboard.writeText(appStoreUrl);
            toast.success("App link copied");
          }}
        >
          <CopyIcon /> Copy app link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={appStoreUrl} target="_blank" rel="noreferrer">
            <StoreIcon /> Open in App Store
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={sensorTowerUrl} target="_blank" rel="noreferrer">
            <LineChartIcon /> Open in Sensor Tower
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
