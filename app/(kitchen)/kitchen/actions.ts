"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function startPreparingAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId } = await getCurrentRestaurant();

  const orderId = formData.get("order_id") as string;
  const expectedUpdatedAt = formData.get("updated_at") as string;

  if (!orderId || !expectedUpdatedAt) return { error: "Données manquantes." };

  const supabase = createClient();

  const { data, error } = await supabase
    .from("orders")
    .update({
      status: "preparing",
      is_locked: true,
      locked_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .eq("status", "new")
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Déjà prise en charge par un autre poste." };

  revalidatePath("/kitchen");
  return { success: "Commande en préparation." };
}

export async function markReadyAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId } = await getCurrentRestaurant();

  const orderId = formData.get("order_id") as string;
  const expectedUpdatedAt = formData.get("updated_at") as string;

  if (!orderId || !expectedUpdatedAt) return { error: "Données manquantes." };

  const supabase = createClient();

  const { data, error } = await supabase
    .from("orders")
    .update({ status: "ready" })
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .eq("status", "preparing")
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Déjà mise à jour par un autre poste." };

  revalidatePath("/kitchen");
  return { success: "Commande prête — salle notifiée." };
}
