import { SearchIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

/**
 * Keyword filter for the page header. Starts as an icon; clicking it (or ⌘F) opens a
 * focused input. Esc clears and closes it, and an empty input closes on blur.
 */
export function KeywordSearch({
  value,
  onChange,
  expanded,
  onExpandedChange: setExpanded,
}: {
  value: string;
  onChange: (value: string) => void;
  /**
   * Controlled by the page so it can restyle the header in the same render the
   * input opens; the input is shown while expanded or holding text.
   */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const open = expanded || value.length > 0;

  const focus = useCallback(() => {
    setExpanded(true);
    // Wait a frame so the input is mounted before focusing it.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [setExpanded]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focus]);

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
