import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { sendOrderConfirmation } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe non configuré." }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "Signature manquante." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (!orderId) return NextResponse.json({ received: true });

    const service = createServiceClient();

    // Mettre à jour le paiement
    await service
      .from("payments")
      .update({ status: "success" })
      .eq("external_reference", session.id)
      .eq("status", "pending");

    // Confirmer la commande
    await service
      .from("orders")
      .update({ payment_confirmed: true })
      .eq("id", orderId)
      .eq("payment_confirmed", false);

    // Notification SMS
    const { data: order } = await service
      .from("orders")
      .select("order_number, total_amount, customer_phone, restaurant_id")
      .eq("id", orderId)
      .maybeSingle();

    if (order?.customer_phone) {
      const { data: restaurant } = await service
        .from("restaurants")
        .select("name, currency")
        .eq("id", order.restaurant_id)
        .maybeSingle();

      if (restaurant) {
        await sendOrderConfirmation({
          phone: order.customer_phone,
          orderNumber: order.order_number,
          totalAmount: Number(order.total_amount),
          currency: restaurant.currency,
          restaurantName: restaurant.name,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
