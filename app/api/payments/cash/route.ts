import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendOrderConfirmation } from "@/lib/notifications";

/**
 * POST — Paiement en espèces : marque la commande comme « à régler sur place ».
 * Le serveur validera le paiement depuis le dashboard.
 */
export async function POST(req: NextRequest) {
  const { orderId, phone } = (await req.json()) as {
    orderId: string;
    phone?: string;
  };

  if (!orderId) return NextResponse.json({ error: "orderId requis." }, { status: 400 });

  const service = createServiceClient();

  const { data: order } = await service
    .from("orders")
    .select("id, restaurant_id, total_amount, payment_confirmed, order_number")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  if (order.payment_confirmed) {
    return NextResponse.json({ error: "Déjà validée." }, { status: 400 });
  }

  // Sauvegarder le téléphone
  if (phone) {
    await service.from("orders").update({ customer_phone: phone }).eq("id", orderId);
  }

  // Créer le paiement (pending — le serveur validera en caisse)
  await service.from("payments").insert({
    order_id: orderId,
    restaurant_id: order.restaurant_id,
    method: "cash",
    amount: order.total_amount,
    status: "pending",
  });

  // Pour les espèces, la commande est immédiatement visible en cuisine
  await service
    .from("orders")
    .update({ payment_confirmed: true, customer_phone: phone || null })
    .eq("id", orderId);

  // Notification SMS
  const { data: restaurant } = await service
    .from("restaurants")
    .select("name, currency")
    .eq("id", order.restaurant_id)
    .maybeSingle();

  if (phone && restaurant) {
    await sendOrderConfirmation({
      phone,
      orderNumber: order.order_number,
      totalAmount: Number(order.total_amount),
      currency: restaurant.currency,
      restaurantName: restaurant.name,
    });
  }

  return NextResponse.json({ success: true });
}
