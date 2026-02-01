"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Proverbs" },
  { href: "/tasks", label: "Tasks" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200/20 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 text-sm text-slate-200 md:px-6">
        <div className="font-semibold tracking-wide text-slate-50">
          Copilot Playground
        </div>
        <ul className="flex items-center gap-3">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 transition-colors ${
                    isActive
                      ? "bg-slate-200 text-slate-900"
                      : "text-slate-300 hover:bg-slate-800/60"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
