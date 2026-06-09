-- ============================================================
-- 0002_restaurant_settings.sql — Settings & team management
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Ajout de l'email dans profiles pour la recherche de membres
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Rétro-remplissage depuis auth.users
UPDATE profiles p
SET    email = u.email
FROM   auth.users u
WHERE  p.id = u.id;

-- Met à jour le trigger pour capturer l'email dès l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    email     = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$;

-- Politique supplémentaire : un membre peut voir les profils de ses coéquipiers
-- (nécessaire pour l'affichage de la liste d'équipe côté client)
CREATE POLICY "profiles_select_teammates"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM   restaurant_users ru1
      JOIN   restaurant_users ru2 ON ru1.restaurant_id = ru2.restaurant_id
      WHERE  ru1.user_id = auth.uid()
        AND  ru2.user_id = profiles.id
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Bucket Storage pour les logos de restaurants
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-logos',
  'restaurant-logos',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (les logos sont affichés sur le menu client)
CREATE POLICY "logos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'restaurant-logos');

-- Upload réservé aux utilisateurs authentifiés
CREATE POLICY "logos_insert_authenticated"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'restaurant-logos' AND auth.role() = 'authenticated');

CREATE POLICY "logos_update_authenticated"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'restaurant-logos' AND auth.role() = 'authenticated');

CREATE POLICY "logos_delete_authenticated"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'restaurant-logos' AND auth.role() = 'authenticated');
