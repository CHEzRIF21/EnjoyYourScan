import { notFound } from "next/navigation";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { PaymentClient } from "@/components/client/scan/payment-client";

export const dynamic = "force-dynamic";

interface Props {
  params: { qr_token: string; orderId: string };
  searchParams: { stripe_session_id?: string; payment_status?: string };
}

export default async function PayPage({ params, searchParams }: Props) {
  const service = createServiceClient();

  // Valider qr_token → restaurant
  const { data: table } = await service
    .from("restaurant_tables")
    .select("id, restaurant_id")
    .eq("qr_token", params.qr_token)
    .maybeSingle();

  if (!table) notFound();

  // Charger la commande
  const { data: order } = await service
    .from("orders")
    .select("id, order_number, total_amount, restaurant_id, payment_confirmed, customer_phone")
    .eq("id", params.orderId)
    .maybeSingle();

  if (!order || order.restaurant_id !== table.restaurant_id) notFound();

  // Charger le restaurant
  const { data: restaurant } = await service
    .from("restaurants")
    .select("name, currency")
    .eq("id", order.restaurant_id)
    .maybeSingle();

  if (!restaurant) notFound();

  // Si retour Stripe avec session_id, vérifier et confirmer côté serveur
  let isPaid = order.payment_confirmed;

  if (!isPaid && searchParams.stripe_session_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(
        searchParams.stripe_session_id
      );
      if (session.payment_status === "paid") {
        await service
          .from("payments")
          .update({ status: "success" })
          .eq("external_reference", session.id)
          .eq("status", "pending");

        await service
          .from("orders")
          .update({ payment_confirmed: true })
          .eq("id", order.id)
          .eq("payment_confirmed", false);

        isPaid = true;
      }
    } catch {
      // Session invalide ou expirée — on ne bloque pas l'affichage
    }
  }

  return (
    <PaymentClient
      qrToken={params.qr_token}
      orderId={order.id}
      orderNumber={order.order_number}
      totalAmount={Number(order.total_amount)}
      currency={restaurant.currency}
      restaurantName={restaurant.name}
      isPaid={isPaid}
      stripeReturnCancelled={searchParams.payment_status === "cancelled"}
    />
  );
}
