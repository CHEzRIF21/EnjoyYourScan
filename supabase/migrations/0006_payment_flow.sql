-- ============================================================
-- 0006_payment_flow.sql
-- Ajoute payment_confirmed + customer_phone aux commandes
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_phone text;

-- Les commandes existantes sont considérées comme payées
UPDATE orders SET payment_confirmed = true WHERE payment_confirmed = false;
