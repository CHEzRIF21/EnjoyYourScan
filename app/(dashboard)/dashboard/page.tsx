import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";

export default async function DashboardPage() {
  const { restaurantName, role } = await getCurrentRestaurant();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Tableau de bord</h1>
      <p className="text-muted-foreground mb-8">
        {restaurantName} — <span className="capitalize">{role}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        Gérez vos menus, tables, et commandes en temps réel.
      </p>
    </div>
  );
}
