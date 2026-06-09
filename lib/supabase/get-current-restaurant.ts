import { createClient } from "./server";
import { redirect } from "next/navigation";

export interface CurrentRestaurant {
  restaurantId: string;
  restaurantName: string;
  role: "owner" | "manager" | "waiter" | "kitchen";
  userId: string;
}

/**
 * Récupère le restaurant actif de l'utilisateur connecté.
 * À appeler dans les Server Components / Server Actions protégés.
 * Redirige vers /login si la session est absente ou invalide.
 */
export async function getCurrentRestaurant(): Promise<CurrentRestaurant> {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("restaurant_users")
    .select(
      `
      role,
      restaurant_id,
      restaurants ( name )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    // Compte sans restaurant (inscription incomplète)
    redirect("/signup?step=restaurant");
  }

  return {
    restaurantId: data.restaurant_id,
    restaurantName: (data.restaurants as unknown as { name: string }).name,
    role: data.role as CurrentRestaurant["role"],
    userId: user.id,
  };
}
