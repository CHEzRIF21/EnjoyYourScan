import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";
import { KitchenClient } from "@/components/kitchen/kitchen-client";

export const metadata = { title: "Cuisine — EnjoyYourScan" };

export interface KitchenOrder {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  order_number: number;
  type: "dine_in" | "takeaway";
  status: "new" | "preparing";
  total_amount: number;
  is_locked: boolean;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KitchenOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
}

export interface KitchenTable {
  id: string;
  table_number: number;
  label: string | null;
}

export interface KitchenMenuItem {
  id: string;
  name: string;
  prep_time_minutes: number | null;
}

export default async function KitchenPage() {
  const { restaurantId, restaurantName } = await getCurrentRestaurant();
  const supabase = createClient();

  const [ordersRes, tablesRes, menuRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, restaurant_id, table_id, order_number, type, status, total_amount, is_locked, locked_at, created_at, updated_at"
      )
      .eq("restaurant_id", restaurantId)
      .in("status", ["new", "preparing"])
      .order("created_at", { ascending: true }),
    supabase
      .from("restaurant_tables")
      .select("id, table_number, label")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("menu_items")
      .select("id, name, prep_time_minutes")
      .eq("restaurant_id", restaurantId),
  ]);

  const orders = (ordersRes.data ?? []) as KitchenOrder[];
  const tables = (tablesRes.data ?? []) as KitchenTable[];
  const menuItems = (menuRes.data ?? []) as KitchenMenuItem[];

  let orderItems: KitchenOrderItem[] = [];
  if (orders.length > 0) {
    const { data } = await supabase
      .from("order_items")
      .select("id, order_id, menu_item_id, quantity, unit_price, notes")
      .in("order_id", orders.map((o) => o.id));
    orderItems = (data ?? []) as KitchenOrderItem[];
  }

  return (
    <KitchenClient
      restaurantId={restaurantId}
      restaurantName={restaurantName}
      initialOrders={orders}
      initialOrderItems={orderItems}
      tables={tables}
      menuItems={menuItems}
    />
  );
}
