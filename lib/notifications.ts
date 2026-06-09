/**
 * Service de notification — envoie un SMS/notification de confirmation.
 *
 * Implémentation pluggable : remplacer le corps de sendSms() par
 * Twilio, Africa's Talking, Vonage, ou tout autre fournisseur SMS.
 */

export interface OrderNotification {
  phone: string;
  orderNumber: number;
  totalAmount: number;
  currency: string;
  restaurantName: string;
}

export async function sendOrderConfirmation(data: OrderNotification): Promise<void> {
  if (!data.phone) return;

  const message =
    `Commande #${data.orderNumber} confirmée — ` +
    `${new Intl.NumberFormat("fr-FR", { style: "currency", currency: data.currency }).format(data.totalAmount)}. ` +
    `Restaurant : ${data.restaurantName}. Merci !`;

  await sendSms(data.phone, message);
}

async function sendSms(to: string, body: string): Promise<void> {
  // ── Twilio (exemple) ──────────────────────────────────
  // import twilio from 'twilio';
  // const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  // await client.messages.create({ to, from: process.env.TWILIO_FROM, body });

  // ── Africa's Talking (exemple) ────────────────────────
  // const AT = require('africastalking')({ apiKey: process.env.AT_API_KEY, username: process.env.AT_USERNAME });
  // await AT.SMS.send({ to: [to], message: body });

  // ── Fallback : log console ────────────────────────────
  console.log(`[SMS → ${to}] ${body}`);
}
