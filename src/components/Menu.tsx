"use client";

import { useEffect, useRef, useState } from "react";

export const menuItemClass =
  "flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none disabled:opacity-50";

/**
 * A button that opens a small list of actions. Closes on pick, outside click,
 * Escape or Tab; Up/Down move between items.
 */
export function Menu({
  label,
  ariaLabel,
  align = "left",
  className = "",
  buttonClassName = "btn",
  testId,
  children,
}: {
  label: React.ReactNode;
  ariaLabel?: string;
  align?: "left" | "right";
  className?: string;
  buttonClassName?: string;
  testId?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = () => [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    items()[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      } else if (e.key === "Tab") {
        setOpen(false);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = items();
        const at = list.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
        list[next]?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={`relative ${className}`}>
      <button ref={button} type="button" className={buttonClassName} aria-haspopup="menu" aria-expanded={open} aria-label={ariaLabel} data-testid={testId} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-40 mt-1 min-w-[12rem] overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
          // Close after the click finishes, so a form inside (Log out) is still mounted when it submits.
          onClick={() => setTimeout(() => setOpen(false))}
        >
          {children}
        </div>
      )}
    </div>
  );
}
