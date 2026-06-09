import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";
import { Sidebar } from "@/components/dashboard/sidebar";

// Les pages /login et /signup utilisent ce layout sans la sidebar.
// Le middleware garantit que seules les routes protégées nécessitent une session.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sur /login et /signup, getCurrentRestaurant() ne sera pas appelé
  // car le middleware empêche l'accès à ces pages si l'user est connecté
  // et redirige vers /login si l'user n'est pas connecté pour /dashboard.
  // On récupère le restaurant uniquement pour les routes internes /dashboard.
  let restaurant: Awaited<ReturnType<typeof getCurrentRestaurant>> | null = null;

  try {
    restaurant = await getCurrentRestaurant();
  } catch {
    // /login et /signup n'ont pas de session — render sans sidebar
  }

  if (!restaurant) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        restaurantName={restaurant.restaurantName}
        role={restaurant.role}
      />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
