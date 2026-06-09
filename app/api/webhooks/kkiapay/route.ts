import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendOrderConfirmation } from "@/lib/notifications";

/**
 * Webhook KkiaPay — appelé quand un paiement Mobile Money est confirmé.
 * Sert de filet de sécurité en complément de la vérification client-side.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    transactionId?: string;
    status?: string;
    data?: string; // orderId passé dans le champ "data" du widget
  };

  const transactionId = body.transactionId;
  const orderId = body.data;

  if (!transactionId || !orderId) {
    return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
  }

  // Toujours re-vérifier auprès de KkiaPay (ne jamais faire confiance au webhook seul)
  const kkRes = await fetch(
    `https://api.kkiapay.me/api/v1/transactions/status?transactionId=${transactionId}`,
    {
      headers: { "x-api-key": process.env.KKIAPAY_SECRET_KEY ?? "" },
    }
  );

  if (!kkRes.ok) {
    return NextResponse.json({ error: "Vérification KkiaPay échouée." }, { status: 502 });
  }

  const kkData = (await kkRes.json()) as { status: string };

  const service = createServiceClient();

  if (kkData.status === "SUCCESS") {
    // Mettre à jour le paiement
    await service
      .from("payments")
      .update({ status: "success", external_reference: transactionId })
      .eq("order_id", orderId)
      .eq("method", "mobile_money")
      .eq("status", "pending");

    // Confirmer la commande
    await service
      .from("orders")
      .update({ payment_confirmed: true })
      .eq("id", orderId)
      .eq("payment_confirmed", false);

    // Notification
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
  } else {
    // Échec
    await service
      .from("payments")
      .update({ status: "failed", external_reference: transactionId })
      .eq("order_id", orderId)
      .eq("method", "mobile_money")
      .eq("status", "pending");
  }

  return NextResponse.json({ received: true });
}
