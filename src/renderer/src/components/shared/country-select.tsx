import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES, countryFlag, type CountryCode } from "@shared/countries";
import { cn } from "@/lib/utils";

/**
 * Storefront picker. `compact` shows just the flag, for headers short on space;
 * `"below-xl"` does so only under 1280px.
 */
export function CountrySelect({
  value: country,
  onChange: setCountry,
  className,
  compact = false,
  variant = "outline",
}: {
  value: CountryCode;
  onChange: (country: CountryCode) => void;
  className?: string;
  compact?: boolean | "below-xl";
  variant?: "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} className={cn("justify-between gap-2", !compact && "min-w-24", compact === "below-xl" && "xl:min-w-24", className)}>
          <span className="flex items-center gap-2">
            <span className="text-base leading-none">{countryFlag(country)}</span>
            <span className={cn(compact === true && "sr-only", compact === "below-xl" && "max-xl:sr-only")}>{country}</span>
          </span>
          <ChevronDownIcon className="text-muted-foreground size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search storefront…" />
          <CommandList>
            <CommandEmpty>No storefront found.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.code}
                  value={`${c.code} ${c.name}`}
                  onSelect={() => {
                    setCountry(c.code);
                    setOpen(false);
                  }}
                >
                  <span className="text-base leading-none">{countryFlag(c.code)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground text-xs">{c.code}</span>
                  <CheckIcon className={cn("size-4", c.code === country ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
