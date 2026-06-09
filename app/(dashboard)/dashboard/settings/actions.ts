"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentRestaurant } from "@/lib/supabase/get-current-restaurant";

export interface ActionState {
  error?: string;
  success?: string;
}

// ─────────────────────────────────────────────
// Mise à jour des informations du restaurant
// ─────────────────────────────────────────────
export async function updateRestaurantAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();

  if (role !== "owner" && role !== "manager") {
    return { error: "Accès refusé." };
  }

  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const currency = formData.get("currency") as string;

  if (!name) return { error: "Le nom du restaurant est requis." };

  const supabase = createClient();
  const { error } = await supabase
    .from("restaurants")
    .update({ name, phone, address, currency })
    .eq("id", restaurantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return { success: "Informations mises à jour." };
}

// ─────────────────────────────────────────────
// Upload du logo (Server Action, max 2 Mo)
// ─────────────────────────────────────────────
export async function uploadLogoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role } = await getCurrentRestaurant();

  if (role !== "owner" && role !== "manager") {
    return { error: "Accès refusé." };
  }

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return { error: "Aucun fichier sélectionné." };
  if (file.size > 2 * 1024 * 1024) return { error: "Le fichier dépasse 2 Mo." };

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return { error: "Format non supporté. Utilisez JPEG, PNG, WebP ou GIF." };
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${restaurantId}/logo-${Date.now()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const admin = createServiceClient();
  const { error: uploadError } = await admin.storage
    .from("restaurant-logos")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = admin.storage
    .from("restaurant-logos")
    .getPublicUrl(path);

  const { error: dbError } = await admin
    .from("restaurants")
    .update({ logo_url: urlData.publicUrl })
    .eq("id", restaurantId);

  if (dbError) return { error: dbError.message };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return { success: "Logo mis à jour." };
}

// ─────────────────────────────────────────────
// Inviter un membre par email
// ─────────────────────────────────────────────
export async function inviteMemberAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role, userId } = await getCurrentRestaurant();

  if (role !== "owner") {
    return { error: "Seul l'owner peut inviter des membres." };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const memberRole = formData.get("role") as string;

  if (!email) return { error: "L'email est requis." };
  if (!["manager", "waiter", "kitchen"].includes(memberRole)) {
    return { error: "Rôle invalide." };
  }

  const admin = createServiceClient();

  // Cherche l'utilisateur dans profiles par email
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let targetUserId: string;

  if (profile) {
    targetUserId = profile.id;

    // Vérifie qu'il n'est pas déjà membre
    const { data: existing } = await admin
      .from("restaurant_users")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (existing) {
      return { error: "Cet utilisateur est déjà membre de votre équipe." };
    }
  } else {
    // Utilisateur inconnu : envoi d'une invitation Supabase Auth
    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: { invited_by: userId, restaurant_id: restaurantId },
      });

    if (inviteError) return { error: inviteError.message };
    targetUserId = inviteData.user.id;

    // Crée un profil minimal pour l'utilisateur invité
    await admin.from("profiles").upsert(
      { id: targetUserId, email, full_name: "" },
      { onConflict: "id", ignoreDuplicates: true }
    );
  }

  const { error } = await admin.from("restaurant_users").insert({
    restaurant_id: restaurantId,
    user_id: targetUserId,
    role: memberRole,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return {
    success: profile
      ? `${email} a été ajouté(e) à l'équipe.`
      : `Invitation envoyée à ${email}.`,
  };
}

// ─────────────────────────────────────────────
// Supprimer un membre
// ─────────────────────────────────────────────
export async function removeMemberAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { restaurantId, role, userId } = await getCurrentRestaurant();

  if (role !== "owner") {
    return { error: "Seul l'owner peut retirer des membres." };
  }

  const membershipId = formData.get("membership_id") as string;
  const targetUserId = formData.get("user_id") as string;
  const targetRole = formData.get("role") as string;

  if (!membershipId) return { error: "Identifiant de membership manquant." };

  // Empêche le retrait si c'est le dernier owner
  if (targetRole === "owner") {
    const { count } = await createServiceClient()
      .from("restaurant_users")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("role", "owner");

    if ((count ?? 0) <= 1) {
      return { error: "Impossible de retirer le dernier owner du restaurant." };
    }
  }

  // Empêche l'auto-suppression de l'owner courant
  if (targetUserId === userId && role === "owner") {
    return {
      error:
        "Vous ne pouvez pas vous retirer vous-même. Transférez d'abord le rôle owner.",
    };
  }

  const admin = createServiceClient();
  const { error } = await admin
    .from("restaurant_users")
    .delete()
    .eq("id", membershipId)
    .eq("restaurant_id", restaurantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: "Membre retiré." };
}
