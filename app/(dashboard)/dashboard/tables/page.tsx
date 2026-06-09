import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";
import { TablesClient } from "@/components/dashboard/tables/tables-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Tables — EnjoyYourScan" };

export default async function TablesPage() {
  const { restaurantId, role } = await getCurrentRestaurant();

  const supabase = createClient();

  const { data: tables, error } = await supabase
    .from("restaurant_tables")
    .select("id, restaurant_id, table_number, label, qr_token, is_open, is_occupied, created_at")
    .eq("restaurant_id", restaurantId)
    .order("table_number", { ascending: true });

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">Impossible de charger les tables.</p>
      </div>
    );
  }

  const canManage = role === "owner" || role === "manager";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tables</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez les tables, leurs QR codes et leur état en temps réel.
          </p>
        </div>
        {tables && tables.length > 0 && (
          <Button variant="outline" asChild>
            <Link href="/dashboard/tables/print" target="_blank">
              Imprimer les QR codes
            </Link>
          </Button>
        )}
      </div>

      <TablesClient
        initialTables={tables ?? []}
        restaurantId={restaurantId}
        canManage={canManage}
      />
    </div>
  );
}
