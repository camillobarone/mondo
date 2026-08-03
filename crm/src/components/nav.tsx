"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Nav({
  items,
  userName,
  userRole,
  office,
}: {
  items: NavItem[];
  userName: string;
  userRole: string;
  office: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = items.map((item) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
          active
            ? "bg-brand-600 text-white shadow-sm"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <span>{item.label}</span>
        {item.badge ? (
          <span
            className={`ml-2 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
              active ? "bg-white/20 text-white" : "bg-slate-700 text-slate-200"
            }`}
          >
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  });

  return (
    <>
      {/* Barra superiore su telefono */}
      <div className="no-print sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 text-white lg:hidden">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Mondo Immobiliare
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-md px-2.5 py-1.5 text-sm hover:bg-slate-800"
          aria-expanded={open}
        >
          {open ? "Chiudi" : "Menu"}
        </button>
      </div>

      {open ? (
        <nav className="border-b border-slate-800 bg-slate-900 px-3 pb-3 lg:hidden">
          <form action="/cerca" className="mb-2" onSubmit={() => setOpen(false)}>
            <input
              name="q"
              placeholder="Cerca nome, telefono, immobile…"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand-500 focus:outline-none"
              aria-label="Cerca in tutto l'archivio"
            />
          </form>
          <div className="space-y-1">{links}</div>
        </nav>
      ) : null}

      {/* Colonna laterale su computer */}
      <aside className="hidden w-56 shrink-0 flex-col bg-slate-900 lg:flex">
        <div className="px-4 py-5">
          <Link href="/" className="block text-base leading-tight font-semibold text-white">
            Mondo
            <span className="block text-xs font-normal tracking-wide text-brand-300 uppercase">
              Immobiliare
            </span>
          </Link>
        </div>

        {/* Il telefono squilla e il nome va trovato prima di rispondere:
            la ricerca sta sotto il logo, sempre alla stessa distanza. */}
        <form action="/cerca" className="px-3 pb-3">
          <input
            name="q"
            placeholder="Cerca…"
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-brand-500 focus:outline-none"
            aria-label="Cerca in tutto l'archivio"
          />
        </form>

        <nav className="flex-1 space-y-1 px-3">{links}</nav>

        <div className="border-t border-slate-800 px-4 py-4">
          <p className="truncate text-sm font-medium text-white">{userName}</p>
          <p className="text-xs text-slate-400 capitalize">
            {userRole} · {office}
          </p>
          <Link
            href="/esci"
            className="mt-2 inline-block text-xs text-slate-400 underline-offset-2 hover:text-white hover:underline"
          >
            Esci
          </Link>
        </div>
      </aside>
    </>
  );
}
