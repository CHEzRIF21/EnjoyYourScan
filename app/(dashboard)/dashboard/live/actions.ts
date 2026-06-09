"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";

export interface ActionState {
  error?: string;
  success?: string;
}

const STATUS_ORDER: Record<string, string> = {
  new: "preparing",
  preparing: "ready",
  ready: "served",
  served: "completed",
};

export async function advanceOrderStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();

  if (role === "kitchen" || role === "waiter" || role === "manager" || role === "owner") {
    // ok
  } else {
    return { error: "Accès refusé." };
  }

  const orderId = formData.get("order_id") as string;
  const currentStatus = formData.get("current_status") as string;
  const expectedUpdatedAt = formData.get("updated_at") as string;

  if (!orderId || !currentStatus || !expectedUpdatedAt) {
    return { error: "Données manquantes." };
  }

  const nextStatus = STATUS_ORDER[currentStatus];
  if (!nextStatus) {
    return { error: `Impossible d'avancer depuis le statut « ${currentStatus} ».` };
  }

  const supabase = createClient();

  // Verrou optimiste : on ne met à jour QUE si updated_at est identique
  const { data, error } = await supabase
    .from("orders")
    .update({ status: nextStatus })
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .eq("status", currentStatus)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };

  if (!data) {
    return {
      error: "Cette commande a déjà été mise à jour par quelqu'un d'autre. Rafraîchissez la page.",
    };
  }

  revalidatePath("/dashboard/live");
  return { success: `Commande passée en « ${nextStatus} ».` };
}

export async function cancelOrderAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();

  if (role !== "owner" && role !== "manager") {
    return { error: "Seul un owner ou manager peut annuler une commande." };
  }

  const orderId = formData.get("order_id") as string;
  const expectedUpdatedAt = formData.get("updated_at") as string;

  if (!orderId || !expectedUpdatedAt) return { error: "Données manquantes." };

  const supabase = createClient();

  const { data, error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return { error: "Déjà mise à jour par quelqu'un d'autre. Rafraîchissez." };
  }

  revalidatePath("/dashboard/live");
  return { success: "Commande annulée." };
}
