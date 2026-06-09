import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";
import { createClient } from "@/lib/supabase/server";
import { PrintClient } from "@/components/dashboard/tables/print-client";

export const metadata = { title: "Impression QR codes — EnjoyYourScan" };

export default async function PrintTablesPage() {
  const { restaurantId, restaurantName } = await getCurrentRestaurant();

  const supabase = createClient();
  const { data: tables, error } = await supabase
    .from("restaurant_tables")
    .select("id, table_number, label, qr_token, is_open")
    .eq("restaurant_id", restaurantId)
    .order("table_number", { ascending: true });

  if (error || !tables) {
    return (
      <div className="p-8">
        <p className="text-destructive">Impossible de charger les tables.</p>
      </div>
    );
  }

  return <PrintClient tables={tables} restaurantName={restaurantName} />;
}
