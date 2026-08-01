// Branded shell for every /admin page: gauge mark + wordmark, section tabs,
// and (when authenticated) the logout control. Pages keep their own auth gates;
// this layout is chrome only.

import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import BrandMark from "@/components/BrandMark";
import { isAuthorized } from "@/lib/adminGate";

export const metadata: Metadata = {
  title: { default: "Admin · MileageBachao", template: "%s · Admin · MileageBachao" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { ok, who } = await isAuthorized();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/admin" className="flex items-center gap-2.5 no-underline">
            <BrandMark size={30} />
            <span className="leading-tight">
              <span className="block text-[15px] font-extrabold tracking-tight">
                Mileage<span className="text-[var(--accent)]">Bachao</span>
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-3)]">
                Admin console
              </span>
            </span>
          </Link>

          <nav aria-label="Admin sections" className="flex items-center gap-1">
            {(
              [
                ["/admin", "Dashboard"],
                ["/admin/pumps", "Pumps"],
                ["/", "View site ↗"],
              ] as const
            ).map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-[13px] font-bold text-[var(--ink-2)] no-underline hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              >
                {label}
              </Link>
            ))}
          </nav>

          {ok && (
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-[11.5px] text-[var(--ink-3)] sm:block">{who}</span>
              <form method="post" action="/admin/logout">
                <button
                  type="submit"
                  className="min-h-[36px] rounded-lg border border-[var(--line-strong)] px-3 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
                >
                  Log out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
