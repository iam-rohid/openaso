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
import { useCountry } from "@/hooks/use-country";
import { COUNTRIES, countryFlag } from "@shared/countries";
import { cn } from "@/lib/utils";

/** `compact` shows just the flag, for headers short on space. */
export function CountrySelect({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [country, setCountry] = useCountry();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-between gap-2", !compact && "min-w-24", className)}>
          <span className="flex items-center gap-2">
            <span className="text-base leading-none">{countryFlag(country)}</span>
            <span className={cn(compact && "sr-only")}>{country}</span>
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
