import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";
import { MenuClient } from "@/components/dashboard/menu/menu-client";
import type { CategoryWithItems, MenuItem } from "./actions";

export const metadata = { title: "Menu — EnjoyYourScan" };

export default async function MenuPage() {
  const { restaurantId, role } = await getCurrentRestaurant();

  const supabase = createClient();

  const { data: raw, error } = await supabase
    .from("menu_categories")
    .select(
      `id, restaurant_id, name, sort_order, is_active, created_at,
       menu_items (
         id, restaurant_id, category_id, name, description, price,
         photo_url, is_available, prep_time_minutes, sort_order, created_at
       )`
    )
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">Impossible de charger le menu.</p>
      </div>
    );
  }

  const categories: CategoryWithItems[] = (raw ?? []).map((cat) => ({
    id: cat.id,
    restaurant_id: cat.restaurant_id,
    name: cat.name,
    sort_order: cat.sort_order,
    is_active: cat.is_active,
    created_at: cat.created_at,
    items: ((cat.menu_items ?? []) as MenuItem[]).sort(
      (a, b) => a.sort_order - b.sort_order
    ),
  }));

  const canManage = role === "owner" || role === "manager";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Menu</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Organisez les catégories et les plats par glisser-déposer.
        </p>
      </div>

      <MenuClient initialCategories={categories} canManage={canManage} />
    </div>
  );
}
