"use client";

import { useState } from "react";
import { IconClose, IconSearch } from "@/components/icons";
import { useI18n } from "@/lib/i18n/client";

const IconFilter = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path d="M3 5h18v2H3zm3 6h12v2H6zm4 6h4v2h-4z" />
  </svg>
);

/**
 * Holodex keeps its filters behind an icon at the right end of the tab row. `children` are the
 * server-rendered filter chips; this only shows and hides them. `active` marks the icon when a
 * non-default filter is applied so the hidden state is never a mystery.
 */
export function BoardFilters({ active, children }: { active: boolean; children: React.ReactNode }) {
  const { m } = useI18n();
  const [open, setOpen] = useState(active);
  const focusSearch = () => {
    const el = document.getElementById("site-search") as HTMLInputElement | null;
    if (el) {
      el.focus();
      el.select();
    }
  };
  return (
    <>
      <span className="ml-auto flex shrink-0 items-center gap-1 pl-2">
        <button type="button" onClick={focusSearch} className="hidden rounded-full p-2 text-muted hover:bg-fg/5 hover:text-fg sm:block" aria-label={m.board.search} title={m.board.search}>
          <IconSearch className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`relative rounded-full p-2 hover:bg-fg/5 ${open || active ? "text-accent" : "text-muted hover:text-fg"}`}
          aria-expanded={open}
          aria-label={m.board.filters}
          title={m.board.filters}
        >
          {open ? <IconClose className="h-5 w-5" /> : <IconFilter className="h-5 w-5" />}
          {active && !open ? <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> : null}
        </button>
      </span>
      {open ? <div className="w-full basis-full border-t border-line px-4 py-3">{children}</div> : null}
    </>
  );
}
