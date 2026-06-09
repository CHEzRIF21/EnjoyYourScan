import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";
import { LiveClient } from "@/components/dashboard/live/live-client";

export const metadata = { title: "Live — EnjoyYourScan" };

export interface OrderRow {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  order_number: number;
  type: "dine_in" | "takeaway";
  status: "new" | "preparing" | "ready" | "served" | "completed" | "cancelled";
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
}

export interface TableRow {
  id: string;
  table_number: number;
  label: string | null;
  is_open: boolean;
  is_occupied: boolean;
}

export interface MenuItemLookup {
  id: string;
  name: string;
}

export default async function LivePage() {
  const { restaurantId, role } = await getCurrentRestaurant();
  const supabase = createClient();

  const activeStatuses = ["new", "preparing", "ready", "served"];

  const [ordersRes, tablesRes, itemsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, restaurant_id, table_id, order_number, type, status, total_amount, created_at, updated_at")
      .eq("restaurant_id", restaurantId)
      .in("status", activeStatuses)
      .order("created_at", { ascending: false }),
    supabase
      .from("restaurant_tables")
      .select("id, table_number, label, is_open, is_occupied")
      .eq("restaurant_id", restaurantId)
      .order("table_number", { ascending: true }),
    supabase
      .from("menu_items")
      .select("id, name")
      .eq("restaurant_id", restaurantId),
  ]);

  const orders = (ordersRes.data ?? []) as OrderRow[];
  const tables = (tablesRes.data ?? []) as TableRow[];
  const menuItemsLookup = (itemsRes.data ?? []) as MenuItemLookup[];

  // Charger les lignes de commande pour toutes les commandes actives
  let orderItems: OrderItemRow[] = [];
  if (orders.length > 0) {
    const { data } = await supabase
      .from("order_items")
      .select("id, order_id, menu_item_id, quantity, unit_price, notes")
      .in(
        "order_id",
        orders.map((o) => o.id)
      );
    orderItems = (data ?? []) as OrderItemRow[];
  }

  const canManage = role === "owner" || role === "manager";

  return (
    <div className="px-4 py-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Commandes en direct</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Suivi temps réel des tables et commandes actives.
        </p>
      </div>

      <LiveClient
        restaurantId={restaurantId}
        initialOrders={orders}
        initialOrderItems={orderItems}
        initialTables={tables}
        menuItemsLookup={menuItemsLookup}
        canManage={canManage}
      />
    </div>
  );
}
