"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  OrderRow,
  OrderItemRow,
  TableRow,
  MenuItemLookup,
} from "@/app/(dashboard)/dashboard/live/page";
import { TablesGrid } from "./tables-grid";
import { OrderCard } from "./order-card";
import { Badge } from "@/components/ui/badge";

const ACTIVE_STATUSES = ["new", "preparing", "ready", "served"];

interface Props {
  restaurantId: string;
  initialOrders: OrderRow[];
  initialOrderItems: OrderItemRow[];
  initialTables: TableRow[];
  menuItemsLookup: MenuItemLookup[];
  canManage: boolean;
}

export function LiveClient({
  restaurantId,
  initialOrders,
  initialOrderItems,
  initialTables,
  menuItemsLookup,
  canManage,
}: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [orderItems, setOrderItems] = useState(initialOrderItems);
  const [tables, setTables] = useState(initialTables);

  useEffect(() => { setOrders(initialOrders); }, [initialOrders]);
  useEffect(() => { setOrderItems(initialOrderItems); }, [initialOrderItems]);
  useEffect(() => { setTables(initialTables); }, [initialTables]);

  // ── Supabase Realtime : orders ──
  useEffect(() => {
    const supabase = createClient();

    const ordersChannel = supabase
      .channel(`live-orders-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as OrderRow;
          if (ACTIVE_STATUSES.includes(row.status) && row.payment_confirmed) {
            setOrders((prev) => [row, ...prev.filter((o) => o.id !== row.id)]);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as OrderRow;
          if (ACTIVE_STATUSES.includes(row.status) && row.payment_confirmed) {
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === row.id);
              if (exists) return prev.map((o) => (o.id === row.id ? row : o));
              return [row, ...prev];
            });
          } else {
            setOrders((prev) => prev.filter((o) => o.id !== row.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          setOrders((prev) => prev.filter((o) => o.id !== payload.old.id));
        }
      )
      .subscribe();

    // ── Supabase Realtime : restaurant_tables ──
    const tablesChannel = supabase
      .channel(`live-tables-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_tables",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTables((prev) => {
              const next = [...prev, payload.new as TableRow];
              return next.sort((a, b) => a.table_number - b.table_number);
            });
          } else if (payload.eventType === "UPDATE") {
            setTables((prev) =>
              prev.map((t) => (t.id === (payload.new as TableRow).id ? (payload.new as TableRow) : t))
            );
          } else if (payload.eventType === "DELETE") {
            setTables((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(tablesChannel);
    };
  }, [restaurantId]);

  // Lookup maps
  const tableMap = Object.fromEntries(tables.map((t) => [t.id, t]));
  const menuMap = Object.fromEntries(menuItemsLookup.map((m) => [m.id, m.name]));

  // Regrouper les order_items par order_id
  const itemsByOrder: Record<string, OrderItemRow[]> = {};
  for (const oi of orderItems) {
    if (!itemsByOrder[oi.order_id]) itemsByOrder[oi.order_id] = [];
    itemsByOrder[oi.order_id].push(oi);
  }

  // Grouper les commandes par statut
  const byStatus: Record<string, OrderRow[]> = {
    new: [],
    preparing: [],
    ready: [],
    served: [],
  };
  for (const order of orders) {
    if (byStatus[order.status]) byStatus[order.status].push(order);
  }

  // Compute table → latest active status
  const tableStatuses: Record<string, string> = {};
  for (const order of orders) {
    if (!order.table_id) continue;
    const current = tableStatuses[order.table_id];
    const priority: Record<string, number> = { new: 0, preparing: 1, ready: 2, served: 3 };
    if (!current || (priority[order.status] ?? 9) < (priority[current] ?? 9)) {
      tableStatuses[order.table_id] = order.status;
    }
  }

  const statusMeta: Record<string, { label: string; color: string }> = {
    new: { label: "Nouvelles", color: "bg-blue-500" },
    preparing: { label: "En préparation", color: "bg-amber-500" },
    ready: { label: "Prêtes", color: "bg-emerald-500" },
    served: { label: "Servies", color: "bg-violet-500" },
  };

  return (
    <div className="space-y-8">
      {/* ── Grille des tables ── */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Tables</h2>
        <TablesGrid tables={tables} tableStatuses={tableStatuses} />
      </section>

      {/* ── Colonnes de commandes par statut ── */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Commandes actives</h2>

        {orders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Aucune commande active.</p>
            <p className="text-sm mt-1">Les nouvelles commandes apparaîtront ici en temps réel.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {(["new", "preparing", "ready", "served"] as const).map((status) => (
              <div key={status} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusMeta[status].color}`} />
                  <span className="font-medium text-sm">{statusMeta[status].label}</span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {byStatus[status].length}
                  </Badge>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {byStatus[status].map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      orderItems={itemsByOrder[order.id] ?? []}
                      menuMap={menuMap}
                      tableMap={tableMap}
                      canManage={canManage}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
