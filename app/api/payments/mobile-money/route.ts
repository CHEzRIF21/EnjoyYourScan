import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendOrderConfirmation } from "@/lib/notifications";

/**
 * POST — Crée un paiement pending + renvoie la config du widget KkiaPay.
 * PUT  — Vérifie un transactionId retourné par le widget KkiaPay.
 */

// ── POST : initier le paiement Mobile Money ─────────────
export async function POST(req: NextRequest) {
  const { orderId, phone } = (await req.json()) as {
    orderId: string;
    phone?: string;
  };

  if (!orderId) return NextResponse.json({ error: "orderId requis." }, { status: 400 });

  const service = createServiceClient();

  const { data: order } = await service
    .from("orders")
    .select("id, restaurant_id, total_amount, payment_confirmed")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  if (order.payment_confirmed) {
    return NextResponse.json({ error: "Déjà payée." }, { status: 400 });
  }

  // Sauvegarder le téléphone
  if (phone) {
    await service.from("orders").update({ customer_phone: phone }).eq("id", orderId);
  }

  // Créer la ligne payment
  await service.from("payments").insert({
    order_id: orderId,
    restaurant_id: order.restaurant_id,
    method: "mobile_money",
    provider: "kkiapay",
    amount: order.total_amount,
    status: "pending",
  });

  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_KKIAPAY_KEY ?? "",
    sandbox: process.env.KKIAPAY_SANDBOX === "true",
  });
}

// ── PUT : vérifier la transaction après callback client ──
export async function PUT(req: NextRequest) {
  const { orderId, transactionId, phone } = (await req.json()) as {
    orderId: string;
    transactionId: string;
    phone?: string;
  };

  if (!orderId || !transactionId) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }

  // Vérifier le transactionId auprès de KkiaPay
  const kkRes = await fetch(
    `https://api.kkiapay.me/api/v1/transactions/status?transactionId=${transactionId}`,
    {
      headers: { "x-api-key": process.env.KKIAPAY_SECRET_KEY ?? "" },
    }
  );

  if (!kkRes.ok) {
    return NextResponse.json({ error: "Impossible de vérifier le paiement." }, { status: 502 });
  }

  const kkData = (await kkRes.json()) as { status: string; amount: number };

  if (kkData.status !== "SUCCESS") {
    return NextResponse.json({ error: "Paiement non confirmé par KkiaPay." }, { status: 402 });
  }

  const service = createServiceClient();

  // Mettre à jour le paiement
  await service
    .from("payments")
    .update({ status: "success", external_reference: transactionId })
    .eq("order_id", orderId)
    .eq("method", "mobile_money")
    .eq("status", "pending");

  // Confirmer la commande → visible en cuisine
  await service
    .from("orders")
    .update({ payment_confirmed: true, customer_phone: phone || null })
    .eq("id", orderId);

  // Notification SMS
  await notifyCustomer(service, orderId);

  return NextResponse.json({ success: true });
}

async function notifyCustomer(
  service: ReturnType<typeof createServiceClient>,
  orderId: string
) {
  const { data: order } = await service
    .from("orders")
    .select("order_number, total_amount, customer_phone, restaurant_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || !order.customer_phone) return;

  const { data: restaurant } = await service
    .from("restaurants")
    .select("name, currency")
    .eq("id", order.restaurant_id)
    .maybeSingle();
  if (!restaurant) return;

  await sendOrderConfirmation({
    phone: order.customer_phone,
    orderNumber: order.order_number,
    totalAmount: Number(order.total_amount),
    currency: restaurant.currency,
    restaurantName: restaurant.name,
  });
}
