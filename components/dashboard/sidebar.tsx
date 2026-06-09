"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/(dashboard)/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Vue d'ensemble" },
  { href: "/dashboard/orders", label: "Commandes" },
  { href: "/dashboard/menu", label: "Menu" },
  { href: "/dashboard/tables", label: "Tables" },
  { href: "/dashboard/settings", label: "Paramètres" },
];

interface SidebarProps {
  restaurantName: string;
  role: string;
}

export function Sidebar({ restaurantName, role }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-64 border-r bg-muted/40 min-h-screen">
      <div className="p-4 border-b">
        <p className="font-semibold text-sm truncate">{restaurantName}</p>
        <p className="text-xs text-muted-foreground capitalize">{role}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === item.href
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t">
        <form action={logoutAction}>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
            Se déconnecter
          </Button>
        </form>
      </div>
    </aside>
  );
}
