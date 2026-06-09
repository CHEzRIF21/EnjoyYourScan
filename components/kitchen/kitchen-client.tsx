"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  KitchenOrder,
  KitchenOrderItem,
  KitchenTable,
  KitchenMenuItem,
} from "@/app/(kitchen)/kitchen/page";
import { KitchenTicket } from "./kitchen-ticket";

const KITCHEN_STATUSES = ["new", "preparing"];

interface Props {
  restaurantId: string;
  restaurantName: string;
  initialOrders: KitchenOrder[];
  initialOrderItems: KitchenOrderItem[];
  tables: KitchenTable[];
  menuItems: KitchenMenuItem[];
}

export function KitchenClient({
  restaurantId,
  restaurantName,
  initialOrders,
  initialOrderItems,
  tables,
  menuItems,
}: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [orderItems, setOrderItems] = useState(initialOrderItems);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [clock, setClock] = useState(() => formatClock());

  // Track known order IDs so we can detect truly new arrivals
  const knownIdsRef = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { setOrders(initialOrders); }, [initialOrders]);
  useEffect(() => { setOrderItems(initialOrderItems); }, [initialOrderItems]);

  // Clock update every second
  useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(id);
  }, []);

  // Preload alert sound
  useEffect(() => {
    const audio = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdHiMkZeXk4iAdnN3fIGEhYWHi42OjoyIhYJ/fn9/gIGDhYiLjY+QkI6Mi4mHhYOCgoKDhIWHiYuNjo+QkI+OjYuJh4WDgoGBgoOEhoiKjI6PkJCPjo2LiYeGhIOCgoKDhIaHiYuNj5CQkI+OjIqIhoSEgoKCg4SFh4mLjY+QkJCPjoyKiIaEhIKCgoOEhYeJi42Pj5CQj46MioiGhISDgoKDhIWHiYuNj4+QkI+OjIqIhoSEg4KCg4SFh4mLjY+PkJCPjoyKiIaEhIOCgoOEhYeJi42Pj5CQj46MioiGhISDgoKDhIWHiYuNj4+QkI+OjIqIhoSEg4KCg4SFh4mLjY+PkJCPjoyKiIaEhIOCgoOEhYeJi42Pj5CQj46MioiGhISDgoKDhIWHiYuNj5CQkI+OjIqIhoSEgoKCg4SFh4mLjY+QkJCPjoyKiIaEhIKCgoOEhYeJi42PkJCQj46MioiGhISCgoKDhIWHiYuNj5CQkI+OjIqIhoSEgoKCg4SFh4mLjY+QkJCPjoyKiIaEg4KCgoOEhYeJi42Pj5CQj46MioiGhISDgoKDhIWHiYuNj4+QkI+OjIqIhoSDgoKCg4SFh4mLjY+PkJCPjoyKiIaEg4KCg4SFh4mLjY+PkJCPjoyKiIaEg4KCg4SFh4mLjQ=="
    );
    audio.volume = 0.8;
    audioRef.current = audio;
  }, []);

  const playAlert = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, []);

  // Load order_items for a new order
  const loadOrderItems = useCallback(
    async (orderId: string) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("order_items")
        .select("id, order_id, menu_item_id, quantity, unit_price, notes")
        .eq("order_id", orderId);
      if (data && data.length > 0) {
        setOrderItems((prev) => [
          ...prev.filter((oi) => oi.order_id !== orderId),
          ...(data as KitchenOrderItem[]),
        ]);
      }
    },
    []
  );

  // ── Supabase Realtime ──
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`kitchen-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as KitchenOrder;
          if (!KITCHEN_STATUSES.includes(row.status)) return;
          setOrders((prev) => {
            if (prev.some((o) => o.id === row.id)) return prev;
            return [...prev, row].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
          if (!knownIdsRef.current.has(row.id)) {
            knownIdsRef.current.add(row.id);
            setNewOrderIds((prev) => new Set(prev).add(row.id));
            playAlert();
            // Clear new-order highlight after 5s
            setTimeout(() => {
              setNewOrderIds((prev) => {
                const next = new Set(prev);
                next.delete(row.id);
                return next;
              });
            }, 5000);
          }
          loadOrderItems(row.id);
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
          const row = payload.new as KitchenOrder;
          if (KITCHEN_STATUSES.includes(row.status)) {
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === row.id);
              if (exists) return prev.map((o) => (o.id === row.id ? row : o));
              return [...prev, row].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, playAlert, loadOrderItems]);

  // Lookup maps
  const tableMap = Object.fromEntries(tables.map((t) => [t.id, t]));
  const menuMap = Object.fromEntries(menuItems.map((m) => [m.id, m]));
  const itemsByOrder: Record<string, KitchenOrderItem[]> = {};
  for (const oi of orderItems) {
    if (!itemsByOrder[oi.order_id]) itemsByOrder[oi.order_id] = [];
    itemsByOrder[oi.order_id].push(oi);
  }

  const newOrders = orders.filter((o) => o.status === "new");
  const preparingOrders = orders.filter((o) => o.status === "preparing");

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col select-none">
      {/* ── Header ── */}
      <header className="shrink-0 px-6 py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black tracking-tight uppercase">Cuisine</h1>
          <span className="text-sm text-gray-500">{restaurantName}</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-gray-400">
                En attente <span className="font-bold text-white">{newOrders.length}</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-gray-400">
                En prép. <span className="font-bold text-white">{preparingOrders.length}</span>
              </span>
            </span>
          </div>
          <span className="text-lg font-mono text-gray-400 tabular-nums">{clock}</span>
        </div>
      </header>

      {/* ── Tickets grid ── */}
      <div className="flex-1 p-4 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3">
            <span className="text-7xl">👨‍🍳</span>
            <p className="text-2xl font-bold">Aucune commande en attente</p>
            <p className="text-base text-gray-500">
              Les nouvelles commandes apparaîtront automatiquement.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {orders.map((order) => (
              <KitchenTicket
                key={order.id}
                order={order}
                items={itemsByOrder[order.id] ?? []}
                tableMap={tableMap}
                menuMap={menuMap}
                isNew={newOrderIds.has(order.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function formatClock(): string {
  return new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
