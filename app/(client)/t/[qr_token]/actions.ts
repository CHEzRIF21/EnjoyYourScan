"use server";

import { createServiceClient } from "@/lib/supabase/service";

export interface CartItemInput {
  itemId: string;
  quantity: number;
}

export interface PlaceOrderResult {
  orderId?: string;
  orderNumber?: number;
  error?: string;
}

export async function placeOrderAction(
  formData: FormData
): Promise<PlaceOrderResult> {
  const qrToken = formData.get("qr_token") as string;
  const cartJson = formData.get("cart") as string;
  const orderType = formData.get("order_type") as "dine_in" | "takeaway";
  const targetTableNumber = (formData.get("target_table_number") as string) ?? "";

  if (!qrToken || !cartJson || !orderType) return { error: "Données manquantes." };

  let cartItems: CartItemInput[];
  try {
    cartItems = JSON.parse(cartJson);
    if (!Array.isArray(cartItems) || cartItems.length === 0) throw new Error();
  } catch {
    return { error: "Panier invalide." };
  }

  const service = createServiceClient();

  // 1. Valider le qr_token → table ouverte
  const { data: tableRow } = await service
    .from("restaurant_tables")
    .select("id, restaurant_id, is_open")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (!tableRow) return { error: "Table introuvable." };
  if (!tableRow.is_open) return { error: "Cette table est maintenant fermée." };

  const restaurantId = tableRow.restaurant_id;

  // 2. Résoudre la table cible
  let tableId: string | null = orderType === "takeaway" ? null : tableRow.id;

  if (orderType === "dine_in" && targetTableNumber.trim() !== "") {
    const num = parseInt(targetTableNumber.trim(), 10);
    if (isNaN(num) || num <= 0) return { error: "Numéro de table invalide." };

    const { data: targetTable } = await service
      .from("restaurant_tables")
      .select("id, is_open")
      .eq("restaurant_id", restaurantId)
      .eq("table_number", num)
      .maybeSingle();

    if (!targetTable) return { error: `Table ${num} introuvable dans ce restaurant.` };
    if (!targetTable.is_open) return { error: `La table ${num} est fermée.` };
    tableId = targetTable.id;
  }

  // 3. Valider les articles (appartiennent à ce restaurant et sont disponibles)
  const itemIds = cartItems.map((ci) => ci.itemId);
  const { data: menuItems } = await service
    .from("menu_items")
    .select("id, price, is_available")
    .eq("restaurant_id", restaurantId)
    .in("id", itemIds);

  if (!menuItems || menuItems.length !== itemIds.length) {
    return { error: "Certains articles sont introuvables." };
  }
  const unavailable = menuItems.filter((m) => !m.is_available);
  if (unavailable.length > 0) {
    return { error: "Certains articles ne sont plus disponibles." };
  }

  // 4. Total calculé côté serveur (pas de confiance au client)
  const priceMap = Object.fromEntries(menuItems.map((m) => [m.id, Number(m.price)]));
  const totalAmount = cartItems.reduce(
    (sum, ci) => sum + priceMap[ci.itemId] * ci.quantity,
    0
  );

  // 5. Créer la commande — order_number rempli par le trigger set_order_number
  const { data: order, error: orderError } = await service
    .from("orders")
    .insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      type: orderType,
      total_amount: totalAmount,
      order_number: 0, // remplacé par le trigger BEFORE INSERT
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    return { error: orderError?.message ?? "Erreur lors de la commande." };
  }

  // 6. Créer les lignes de commande
  const { error: itemsError } = await service.from("order_items").insert(
    cartItems.map((ci) => ({
      order_id: order.id,
      menu_item_id: ci.itemId,
      quantity: ci.quantity,
      unit_price: priceMap[ci.itemId],
    }))
  );

  if (itemsError) return { error: itemsError.message };

  return { orderId: order.id, orderNumber: order.order_number };
}
