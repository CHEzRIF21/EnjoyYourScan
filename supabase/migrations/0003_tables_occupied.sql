-- ============================================================
-- 0003_tables_occupied.sql
-- Ajoute le statut d'occupation des tables + active Realtime
-- ============================================================

ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS is_occupied boolean NOT NULL DEFAULT false;

-- Realtime : capture les valeurs OLD (nécessaire pour les filtres sur DELETE)
ALTER TABLE restaurant_tables REPLICA IDENTITY FULL;

-- Ajoute la table à la publication Realtime de Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;
