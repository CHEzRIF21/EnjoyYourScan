-- ============================================================
-- 0004_menu_photos.sql — Bucket Storage pour les photos de plats
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-photos',
  'menu-photos',
  true,
  5242880, -- 5 Mo
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (photos affichées sur le menu client)
CREATE POLICY "menu_photos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-photos');

-- Upload / mise à jour / suppression réservés aux utilisateurs authentifiés
CREATE POLICY "menu_photos_insert_authenticated"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-photos' AND auth.role() = 'authenticated');

CREATE POLICY "menu_photos_update_authenticated"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'menu-photos' AND auth.role() = 'authenticated');

CREATE POLICY "menu_photos_delete_authenticated"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'menu-photos' AND auth.role() = 'authenticated');
