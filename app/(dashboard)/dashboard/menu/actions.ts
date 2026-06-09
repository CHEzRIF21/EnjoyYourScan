"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";

// ─────────────────────────────────────────────
// Types partagés
// ─────────────────────────────────────────────
export interface ActionState {
  error?: string;
  success?: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  photo_url: string | null;
  is_available: boolean;
  prep_time_minutes: number | null;
  sort_order: number;
  created_at: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CategoryWithItems extends MenuCategory {
  items: MenuItem[];
}

// ─────────────────────────────────────────────
// Catégories
// ─────────────────────────────────────────────

export async function createCategoryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();
  if (role !== "owner" && role !== "manager") return { error: "Accès refusé." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Le nom est requis." };

  const supabase = createClient();

  const { data: last } = await supabase
    .from("menu_categories")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("menu_categories").insert({
    restaurant_id: restaurantId,
    name,
    sort_order: last ? last.sort_order + 1 : 0,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/menu");
  return { success: `Catégorie "${name}" créée.` };
}

export async function updateCategoryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();
  if (role !== "owner" && role !== "manager") return { error: "Accès refusé." };

  const categoryId = formData.get("category_id") as string;
  const name = (formData.get("name") as string)?.trim();

  if (!categoryId) return { error: "ID manquant." };
  if (!name) return { error: "Le nom est requis." };

  const supabase = createClient();
  const { error } = await supabase
    .from("menu_categories")
    .update({ name })
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/menu");
  return { success: "Catégorie mise à jour." };
}

export async function deleteCategoryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();
  if (role !== "owner" && role !== "manager") return { error: "Accès refusé." };

  const categoryId = formData.get("category_id") as string;
  if (!categoryId) return { error: "ID manquant." };

  const supabase = createClient();
  const { error } = await supabase
    .from("menu_categories")
    .delete()
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/menu");
  return { success: "Catégorie supprimée." };
}

export async function toggleCategoryActiveAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();
  if (role !== "owner" && role !== "manager") return { error: "Accès refusé." };

  const categoryId = formData.get("category_id") as string;
  const currentIsActive = formData.get("is_active") === "true";

  if (!categoryId) return { error: "ID manquant." };

  const supabase = createClient();
  const { error } = await supabase
    .from("menu_categories")
    .update({ is_active: !currentIsActive })
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/menu");
  return {};
}

// Appelée directement après un drag-end (pas via formulaire)
export async function reorderCategoriesAction(orderedIds: string[]): Promise<void> {
  const { restaurantId, role } = await getCurrentRestaurant();
  if (role !== "owner" && role !== "manager") return;

  const supabase = createClient();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("menu_categories")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("restaurant_id", restaurantId)
    )
  );
  revalidatePath("/dashboard/menu");
}

// ─────────────────────────────────────────────
// Plats (menu_items)
// ─────────────────────────────────────────────

export async function createItemAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();
  if (role !== "owner" && role !== "manager") return { error: "Accès refusé." };

  const categoryId = formData.get("category_id") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const price = parseFloat(formData.get("price") as string);
  const rawPrep = formData.get("prep_time_minutes") as string;
  const prepTime = rawPrep ? parseInt(rawPrep, 10) : null;
  const photoFile = formData.get("photo") as File | null;

  if (!categoryId) return { error: "Catégorie requise." };
  if (!name) return { error: "Le nom est requis." };
  if (isNaN(price) || price < 0) return { error: "Prix invalide." };

  let photoUrl: string | null = null;
  if (photoFile && photoFile.size > 0) {
    const result = await uploadItemPhoto(photoFile, restaurantId);
    if (result.error) return { error: result.error };
    photoUrl = result.url ?? null;
  }

  const supabase = createClient();

  const { data: last } = await supabase
    .from("menu_items")
    .select("sort_order")
    .eq("category_id", categoryId)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("menu_items").insert({
    restaurant_id: restaurantId,
    category_id: categoryId,
    name,
    description,
    price,
    prep_time_minutes: prepTime,
    photo_url: photoUrl,
    sort_order: last ? last.sort_order + 1 : 0,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/menu");
  return { success: `"${name}" ajouté.` };
}

export async function updateItemAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();
  if (role !== "owner" && role !== "manager") return { error: "Accès refusé." };

  const itemId = formData.get("item_id") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const price = parseFloat(formData.get("price") as string);
  const rawPrep = formData.get("prep_time_minutes") as string;
  const prepTime = rawPrep ? parseInt(rawPrep, 10) : null;
  const photoFile = formData.get("photo") as File | null;
  const existingPhotoUrl = (formData.get("existing_photo_url") as string) || null;
  const isAvailable = formData.get("is_available") === "on";

  if (!itemId) return { error: "ID manquant." };
  if (!name) return { error: "Le nom est requis." };
  if (isNaN(price) || price < 0) return { error: "Prix invalide." };

  let photoUrl = existingPhotoUrl;
  if (photoFile && photoFile.size > 0) {
    const result = await uploadItemPhoto(photoFile, restaurantId);
    if (result.error) return { error: result.error };
    photoUrl = result.url ?? null;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({ name, description, price, prep_time_minutes: prepTime, photo_url: photoUrl, is_available: isAvailable })
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/menu");
  return { success: "Plat mis à jour." };
}

export async function deleteItemAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();
  if (role !== "owner" && role !== "manager") return { error: "Accès refusé." };

  const itemId = formData.get("item_id") as string;
  if (!itemId) return { error: "ID manquant." };

  const supabase = createClient();
  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/menu");
  return { success: "Plat supprimé." };
}

export async function toggleItemAvailabilityAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();
  if (role !== "owner" && role !== "manager") return { error: "Accès refusé." };

  const itemId = formData.get("item_id") as string;
  const currentIsAvailable = formData.get("is_available") === "true";

  if (!itemId) return { error: "ID manquant." };

  const supabase = createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: !currentIsAvailable })
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/menu");
  return {};
}

// Appelée directement après un drag-end
export async function reorderItemsAction(
  categoryId: string,
  orderedIds: string[]
): Promise<void> {
  const { restaurantId, role } = await getCurrentRestaurant();
  if (role !== "owner" && role !== "manager") return;

  const supabase = createClient();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("menu_items")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("category_id", categoryId)
        .eq("restaurant_id", restaurantId)
    )
  );
  revalidatePath("/dashboard/menu");
}

// ─────────────────────────────────────────────
// Utilitaire interne : upload photo
// ─────────────────────────────────────────────
async function uploadItemPhoto(
  file: File,
  restaurantId: string
): Promise<{ url?: string; error?: string }> {
  if (file.size > 5 * 1024 * 1024) return { error: "La photo dépasse 5 Mo." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { error: "Format non supporté (JPEG, PNG ou WebP)." };
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${restaurantId}/${Date.now()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const admin = createServiceClient();
  const { error: uploadError } = await admin.storage
    .from("menu-photos")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return { error: uploadError.message };

  const { data } = admin.storage.from("menu-photos").getPublicUrl(path);
  return { url: data.publicUrl };
}
