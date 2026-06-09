import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";
import { createServiceClient } from "@/lib/supabase/service";
import { RestaurantForm } from "@/components/dashboard/settings/restaurant-form";
import { TeamMembers } from "@/components/dashboard/settings/team-members";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Paramètres — EnjoyYourScan" };

export default async function SettingsPage() {
  const { restaurantId, role } = await getCurrentRestaurant();

  if (role !== "owner" && role !== "manager") {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">
          Vous n&apos;avez pas accès à cette page.
        </p>
      </div>
    );
  }

  const admin = createServiceClient();

  // ── Données restaurant ──
  const { data: restaurant, error: restError } = await admin
    .from("restaurants")
    .select("id, name, phone, address, currency, logo_url")
    .eq("id", restaurantId)
    .single();

  if (restError || !restaurant) {
    return (
      <div className="p-8">
        <p className="text-destructive">Impossible de charger les données.</p>
      </div>
    );
  }

  // ── Membres de l'équipe (service_role pour contourner la RLS profiles) ──
  const { data: rawMembers } = await admin
    .from("restaurant_users")
    .select(
      `
      id,
      user_id,
      role,
      created_at,
      profiles ( full_name, email )
    `
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  const members = (rawMembers ?? []).map((m) => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles,
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gérez les informations de votre restaurant et votre équipe.
        </p>
      </div>

      <Separator />

      <RestaurantForm restaurant={restaurant} />

      <Separator />

      <TeamMembers members={members} isOwner={role === "owner"} />
    </div>
  );
}
