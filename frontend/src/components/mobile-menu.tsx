"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

/** Hamburger menu for the public nav below 760px. */
export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const pathname = usePathname();
  const id = useId();

  // Close after navigating: the menu remembers the page it was opened on.
  const isOpen = open && openedOn === pathname;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <div className="mobile-menu">
      <ThemeToggle />
      <button
        type="button"
        className="icon-button"
        aria-expanded={isOpen}
        aria-controls={id}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        onClick={() => {
          setOpenedOn(pathname);
          setOpen(!isOpen);
        }}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav id={id} className="mobile-menu-panel" hidden={!isOpen} aria-label="Mobile navigation">
        {links.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
        <Link href="/planner" className="button button-primary button-full" onClick={() => setOpen(false)}>
          Plan a route
        </Link>
      </nav>
    </div>
  );
}
