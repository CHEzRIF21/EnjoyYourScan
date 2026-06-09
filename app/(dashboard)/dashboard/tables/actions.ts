"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";

export interface ActionState {
  error?: string;
  success?: string;
}

// ─────────────────────────────────────────────
// Créer une table
// ─────────────────────────────────────────────
export async function createTableAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();

  if (role !== "owner" && role !== "manager") {
    return { error: "Accès refusé." };
  }

  const tableNumber = parseInt(formData.get("table_number") as string, 10);
  const label = (formData.get("label") as string)?.trim() || null;

  if (!tableNumber || tableNumber < 1 || tableNumber > 999) {
    return { error: "Numéro de table invalide (1–999)." };
  }

  const supabase = createClient();

  const { data: existing } = await supabase
    .from("restaurant_tables")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("table_number", tableNumber)
    .maybeSingle();

  if (existing) {
    return { error: `La table numéro ${tableNumber} existe déjà.` };
  }

  const { error } = await supabase
    .from("restaurant_tables")
    .insert({ restaurant_id: restaurantId, table_number: tableNumber, label });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tables");
  return { success: `Table ${tableNumber} créée.` };
}

// ─────────────────────────────────────────────
// Modifier une table (numéro + label)
// ─────────────────────────────────────────────
export async function updateTableAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();

  if (role !== "owner" && role !== "manager") {
    return { error: "Accès refusé." };
  }

  const tableId = formData.get("table_id") as string;
  const tableNumber = parseInt(formData.get("table_number") as string, 10);
  const label = (formData.get("label") as string)?.trim() || null;

  if (!tableId) return { error: "Identifiant de table manquant." };
  if (!tableNumber || tableNumber < 1 || tableNumber > 999) {
    return { error: "Numéro de table invalide (1–999)." };
  }

  const supabase = createClient();

  // Vérifie doublon (autre table avec le même numéro)
  const { data: duplicate } = await supabase
    .from("restaurant_tables")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("table_number", tableNumber)
    .neq("id", tableId)
    .maybeSingle();

  if (duplicate) {
    return { error: `La table numéro ${tableNumber} existe déjà.` };
  }

  const { error } = await supabase
    .from("restaurant_tables")
    .update({ table_number: tableNumber, label })
    .eq("id", tableId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tables");
  return { success: "Table mise à jour." };
}

// ─────────────────────────────────────────────
// Supprimer une table
// ─────────────────────────────────────────────
export async function deleteTableAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();

  if (role !== "owner" && role !== "manager") {
    return { error: "Accès refusé." };
  }

  const tableId = formData.get("table_id") as string;
  if (!tableId) return { error: "Identifiant de table manquant." };

  const supabase = createClient();
  const { error } = await supabase
    .from("restaurant_tables")
    .delete()
    .eq("id", tableId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tables");
  return { success: "Table supprimée." };
}

// ─────────────────────────────────────────────
// Toggle is_open (Ouvrir / Fermer)
// ─────────────────────────────────────────────
export async function toggleTableOpenAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();

  if (role !== "owner" && role !== "manager") {
    return { error: "Accès refusé." };
  }

  const tableId = formData.get("table_id") as string;
  const currentIsOpen = formData.get("is_open") === "true";

  if (!tableId) return { error: "Identifiant de table manquant." };

  const supabase = createClient();
  const { error } = await supabase
    .from("restaurant_tables")
    .update({ is_open: !currentIsOpen })
    .eq("id", tableId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/tables");
  return { success: currentIsOpen ? "Table fermée." : "Table ouverte." };
}
