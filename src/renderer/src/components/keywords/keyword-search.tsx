import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

/**
 * Keyword filter for the page header. Starts as an icon; clicking it (or ⌘F) opens a
 * focused input. Esc clears and closes it, and an empty input closes on blur.
 */
export function KeywordSearch({
  value,
  onChange,
  onOpenChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const open = expanded || value.length > 0;

  useEffect(() => onOpenChange?.(open), [open, onOpenChange]);

  const focus = () => {
    setExpanded(true);
    // Wait a frame so the input is mounted before focusing it.
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

  if (!open) {
    return (
      <Button variant="outline" size="icon" onClick={focus}>
        <SearchIcon />
        <span className="sr-only">Filter keywords</span>
      </Button>
    );
  }

  return (
    <InputGroup className="w-52">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        autoFocus
        placeholder="Filter keywords…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onChange("");
            setExpanded(false);
          }
        }}
        onBlur={() => setExpanded(false)}
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            // Keep focus in the input so the user can type a new filter straight away.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              focus();
            }}
          >
            <XIcon />
            <span className="sr-only">Clear filter</span>
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
