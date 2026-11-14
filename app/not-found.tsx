import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

// Without this file Next renders its built-in 404, which keeps the layout's homepage <title> and
// "index, follow" next to its own, and has no way back into the site.
export const metadata: Metadata = {
  title: "Page not found",
  description: "This page does not exist. Go back to the Bitcoin mining farm calculator, its methodology, the free API or the MCP server.",
  robots: { index: false, follow: true },
};

const LINKS = [
  { href: "/", label: "Bitcoin mining farm calculator" },
  { href: "/methodology", label: "Methodology" },
  { href: "/api-docs", label: "Free API" },
  { href: "/mcp", label: "AI agents (MCP)" },
];

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-16">
        <header className="space-y-3">
          <p className="label">404</p>
          <h1 className="text-3xl font-semibold tracking-tight text-fg">Page not found</h1>
          <p className="max-w-2xl text-fg-2">There is nothing at this address. These pages exist:</p>
        </header>
        <ul className="space-y-2 text-sm">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-fg underline underline-offset-2">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
