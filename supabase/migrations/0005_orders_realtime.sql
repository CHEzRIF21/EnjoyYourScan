-- ============================================================
-- 0005_orders_realtime.sql
-- Active Realtime sur la table orders + policy SELECT publique
-- pour que le dashboard live reçoive les events Realtime.
-- ============================================================

-- Capture les OLD values (nécessaire pour DELETE/UPDATE dans Realtime)
ALTER TABLE orders REPLICA IDENTITY FULL;

-- Ajoute à la publication Realtime de Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
