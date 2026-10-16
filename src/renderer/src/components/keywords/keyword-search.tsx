import { SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

/**
 * Keyword filter for the page header. ⌘F focuses it, Esc clears it. On narrow
 * windows it collapses to an icon until opened.
 */
export function KeywordSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);

  const focus = () => {
    setExpanded(true);
    // Wait a frame so a collapsed input is visible before focusing it.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button variant="ghost" size="icon" className={cn("md:hidden", expanded && "hidden")} onClick={focus}>
        <SearchIcon />
        <span className="sr-only">Filter keywords</span>
      </Button>
      <InputGroup className={cn("w-52", !expanded && "max-md:hidden")}>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          placeholder="Filter keywords…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onChange("");
              setExpanded(false);
              e.currentTarget.blur();
            }
          }}
          onBlur={() => !value && setExpanded(false)}
        />
      </InputGroup>
    </>
  );
}
