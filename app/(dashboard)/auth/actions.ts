"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─────────────────────────────────────────────
// SIGNUP : crée le compte + restaurant + membership owner
// ─────────────────────────────────────────────
export async function signUpAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;
  const restaurantName = formData.get("restaurant_name") as string;

  if (!email || !password || !fullName || !restaurantName) {
    return { error: "Tous les champs sont obligatoires." };
  }

  const supabase = createClient();

  // 1. Créer le compte auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (authError) {
    return { error: authError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { error: "Erreur lors de la création du compte." };
  }

  // 2. Utilise service_role pour contourner RLS sur la création initiale
  const admin = createServiceClient();

  const slug = toSlug(restaurantName);

  // Vérifie unicité du slug
  const { data: existing } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  const finalSlug = existing
    ? `${slug}-${Date.now().toString(36)}`
    : slug;

  // 3. Crée le restaurant
  const { data: restaurant, error: restError } = await admin
    .from("restaurants")
    .insert({ name: restaurantName, slug: finalSlug })
    .select("id")
    .single();

  if (restError || !restaurant) {
    return { error: "Erreur lors de la création du restaurant." };
  }

  // 4. Crée le membership owner
  const { error: memberError } = await admin.from("restaurant_users").insert({
    restaurant_id: restaurant.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    return { error: "Erreur lors de l'association au restaurant." };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/dashboard";

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────
export async function logoutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
