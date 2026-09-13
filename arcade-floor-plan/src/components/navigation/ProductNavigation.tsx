"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/floor-plan", label: "Floor Plans" },
  { href: "/machines", label: "Machines" },
] as const;

/** The shared top-level product navigation for the editor and machine registry. */
export function ProductNavigation() {
  const pathname = usePathname();

  return <nav className="product-navigation" aria-label="Product navigation">
    {links.map((link) => {
      const active = pathname === link.href || (link.href === "/floor-plan" && pathname === "/");
      return <Link key={link.href} href={link.href} className={active ? "product-navigation__link product-navigation__link--active" : "product-navigation__link"} aria-current={active ? "page" : undefined}>{link.label}</Link>;
    })}
  </nav>;
}
