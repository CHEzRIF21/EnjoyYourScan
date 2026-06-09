import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { ScanPageClient } from "@/components/client/scan/scan-page-client";
import type { PublicCategory, PublicMenuItem } from "@/components/client/scan/types";

export const dynamic = "force-dynamic";

interface Props {
  params: { qr_token: string };
}

export default async function ScanPage({ params }: Props) {
  const service = createServiceClient();

  // Résoudre le qr_token → table
  const { data: table } = await service
    .from("restaurant_tables")
    .select("id, table_number, label, is_open, restaurant_id")
    .eq("qr_token", params.qr_token)
    .maybeSingle();

  if (!table) notFound();

  // Table fermée → écran bloquant
  if (!table.is_open) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <p className="text-5xl mb-4">🚫</p>
        <h1 className="text-xl font-semibold mb-2">Table non disponible</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          Cette table n&apos;est pas ouverte pour le moment.
          Demandez à un serveur de l&apos;activer.
        </p>
      </main>
    );
  }

  // Charger le restaurant + le menu en parallèle
  const [{ data: restaurant }, { data: cats }, { data: rawItems }] = await Promise.all([
    service
      .from("restaurants")
      .select("id, name, logo_url, currency")
      .eq("id", table.restaurant_id)
      .maybeSingle(),
    service
      .from("menu_categories")
      .select("id, name, sort_order")
      .eq("restaurant_id", table.restaurant_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    service
      .from("menu_items")
      .select(
        "id, category_id, name, description, price, photo_url, prep_time_minutes, sort_order"
      )
      .eq("restaurant_id", table.restaurant_id)
      .eq("is_available", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (!restaurant) notFound();

  // Grouper les plats par catégorie
  const itemsByCategory: Record<string, PublicMenuItem[]> = {};
  for (const i of rawItems ?? []) {
    if (!itemsByCategory[i.category_id]) itemsByCategory[i.category_id] = [];
    itemsByCategory[i.category_id].push({
      id: i.id,
      name: i.name,
      description: i.description ?? null,
      price: Number(i.price),
      photo_url: i.photo_url ?? null,
      prep_time_minutes: i.prep_time_minutes ?? null,
      category_id: i.category_id,
    });
  }

  const categories: PublicCategory[] = (cats ?? [])
    .map((c) => ({ id: c.id, name: c.name, items: itemsByCategory[c.id] ?? [] }))
    .filter((c) => c.items.length > 0);

  return (
    <ScanPageClient
      qrToken={params.qr_token}
      table={{
        id: table.id,
        table_number: table.table_number,
        label: table.label ?? null,
      }}
      restaurant={{
        id: restaurant.id,
        name: restaurant.name,
        logo_url: restaurant.logo_url ?? null,
        currency: restaurant.currency,
      }}
      categories={categories}
    />
  );
}
