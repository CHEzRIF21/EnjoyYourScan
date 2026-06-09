import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";

const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

function toStripeAmount(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
}

/**
 * POST — Crée une Stripe Checkout Session pour un paiement par carte.
 */
export async function POST(req: NextRequest) {
  const { orderId, phone } = (await req.json()) as {
    orderId: string;
    phone?: string;
  };

  if (!orderId) return NextResponse.json({ error: "orderId requis." }, { status: 400 });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe non configuré." }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const service = createServiceClient();

  // Charger la commande + restaurant + lignes
  const { data: order } = await service
    .from("orders")
    .select("id, restaurant_id, total_amount, payment_confirmed, order_number")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  if (order.payment_confirmed) {
    return NextResponse.json({ error: "Déjà payée." }, { status: 400 });
  }

  const { data: restaurant } = await service
    .from("restaurants")
    .select("name, currency")
    .eq("id", order.restaurant_id)
    .maybeSingle();

  if (!restaurant) return NextResponse.json({ error: "Restaurant introuvable." }, { status: 404 });

  // Sauvegarder le téléphone
  if (phone) {
    await service.from("orders").update({ customer_phone: phone }).eq("id", orderId);
  }

  // Charger les lignes de commande + noms des plats
  const { data: items } = await service
    .from("order_items")
    .select("menu_item_id, quantity, unit_price")
    .eq("order_id", orderId);

  const menuItemIds = (items ?? []).map((i) => i.menu_item_id);
  const { data: menuItems } = await service
    .from("menu_items")
    .select("id, name")
    .in("id", menuItemIds);

  const nameMap = Object.fromEntries((menuItems ?? []).map((m) => [m.id, m.name]));
  const currency = restaurant.currency.toLowerCase();

  // Créer la session Stripe Checkout
  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  // Trouver le qr_token pour construire l'URL de retour
  const { data: tableData } = await service
    .from("restaurant_tables")
    .select("qr_token")
    .eq("restaurant_id", order.restaurant_id)
    .limit(1)
    .maybeSingle();

  const qrToken = tableData?.qr_token ?? "unknown";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: (items ?? []).map((oi) => ({
      price_data: {
        currency,
        product_data: { name: nameMap[oi.menu_item_id] ?? "Article" },
        unit_amount: toStripeAmount(Number(oi.unit_price), restaurant.currency),
      },
      quantity: oi.quantity,
    })),
    mode: "payment",
    success_url: `${origin}/t/${qrToken}/pay/${orderId}?stripe_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/t/${qrToken}/pay/${orderId}?payment_status=cancelled`,
    metadata: { orderId, restaurantId: order.restaurant_id },
  });

  // Créer la ligne payment
  await service.from("payments").insert({
    order_id: orderId,
    restaurant_id: order.restaurant_id,
    method: "card",
    provider: "stripe",
    amount: order.total_amount,
    status: "pending",
    external_reference: session.id,
  });

  return NextResponse.json({ url: session.url });
}
