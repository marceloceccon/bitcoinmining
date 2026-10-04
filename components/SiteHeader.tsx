import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/ui/ThemeToggle";

const NAV = [
  { href: "/#calculator", label: "Calculator" },
  { href: "/methodology", label: "Methodology" },
  { href: "/api-docs", label: "API" },
];

export default function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-40" style={{ top: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/web-app-manifest-192x192.png" alt="" width={28} height={28} className="rounded" />
          <span className="font-semibold tracking-tight text-fg">
            MineForge <span className="hidden font-normal text-muted sm:inline">· Bitcoin Mining Farm Calculator</span>
          </span>
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-4 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hidden text-muted transition-colors hover:text-fg md:inline">
              {n.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
