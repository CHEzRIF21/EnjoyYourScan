-- ============================================================
-- 0001_init.sql — Schéma multitenant EnjoyYourScan
-- ============================================================

-- ────────────────────────────────────────────
-- Extensions
-- ────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────
-- Enums
-- ────────────────────────────────────────────
create type restaurant_role  as enum ('owner', 'manager', 'waiter', 'kitchen');
create type order_type       as enum ('dine_in', 'takeaway');
create type order_status     as enum ('new', 'preparing', 'ready', 'served', 'completed', 'cancelled');
create type payment_method   as enum ('mobile_money', 'card', 'cash');
create type payment_status   as enum ('pending', 'success', 'failed');

-- ────────────────────────────────────────────
-- Helper : appartenance d'un user à un restaurant
-- (réutilisé dans TOUTES les policies)
-- ────────────────────────────────────────────
create or replace function is_restaurant_member(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from restaurant_users
    where restaurant_id = p_restaurant_id
      and user_id = auth.uid()
  );
$$;

-- ────────────────────────────────────────────
-- TABLE : restaurants
-- ────────────────────────────────────────────
create table restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  phone       text,
  address     text,
  currency    text not null default 'XOF',
  timezone    text not null default 'Africa/Porto-Novo',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index idx_restaurants_slug on restaurants (slug);

alter table restaurants enable row level security;

-- Lecture : tout membre du restaurant
create policy "restaurants_select"
  on restaurants for select
  using ( is_restaurant_member(id) );

-- Insertion : authentifié (l'owner est créé juste après via restaurant_users)
create policy "restaurants_insert"
  on restaurants for insert
  with check ( auth.uid() is not null );

-- Mise à jour : owner ou manager
create policy "restaurants_update"
  on restaurants for update
  using (
    exists (
      select 1 from restaurant_users
      where restaurant_id = id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

-- Suppression : owner uniquement
create policy "restaurants_delete"
  on restaurants for delete
  using (
    exists (
      select 1 from restaurant_users
      where restaurant_id = id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

-- ────────────────────────────────────────────
-- TABLE : profiles (miroir de auth.users)
-- ────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;

-- Chaque utilisateur voit et modifie uniquement son profil
create policy "profiles_select"
  on profiles for select
  using ( id = auth.uid() );

create policy "profiles_insert"
  on profiles for insert
  with check ( id = auth.uid() );

create policy "profiles_update"
  on profiles for update
  using ( id = auth.uid() );

-- Trigger : crée automatiquement un profil à l'inscription
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ────────────────────────────────────────────
-- TABLE : restaurant_users (membership + rôle)
-- ────────────────────────────────────────────
create table restaurant_users (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants (id) on delete cascade,
  user_id        uuid not null references profiles (id) on delete cascade,
  role           restaurant_role not null,
  created_at     timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create index idx_restaurant_users_restaurant on restaurant_users (restaurant_id);
create index idx_restaurant_users_user       on restaurant_users (user_id);

alter table restaurant_users enable row level security;

-- Lecture : membres du restaurant
create policy "restaurant_users_select"
  on restaurant_users for select
  using ( is_restaurant_member(restaurant_id) );

-- Ajout d'un membre : owner ou manager
create policy "restaurant_users_insert"
  on restaurant_users for insert
  with check (
    exists (
      select 1 from restaurant_users ru
      where ru.restaurant_id = restaurant_id
        and ru.user_id = auth.uid()
        and ru.role in ('owner', 'manager')
    )
    -- ou l'utilisateur s'ajoute lui-même comme owner d'un nouveau restaurant
    or (user_id = auth.uid() and role = 'owner')
  );

-- Modification du rôle : owner uniquement
create policy "restaurant_users_update"
  on restaurant_users for update
  using (
    exists (
      select 1 from restaurant_users ru
      where ru.restaurant_id = restaurant_id
        and ru.user_id = auth.uid()
        and ru.role = 'owner'
    )
  );

-- Suppression : owner, ou l'utilisateur lui-même (quitter)
create policy "restaurant_users_delete"
  on restaurant_users for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from restaurant_users ru
      where ru.restaurant_id = restaurant_id
        and ru.user_id = auth.uid()
        and ru.role = 'owner'
    )
  );

-- ────────────────────────────────────────────
-- TABLE : restaurant_tables
-- ────────────────────────────────────────────
create table restaurant_tables (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants (id) on delete cascade,
  table_number   int  not null,
  label          text,
  qr_token       uuid not null unique default gen_random_uuid(),
  is_open        boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (restaurant_id, table_number)
);

create index idx_restaurant_tables_restaurant on restaurant_tables (restaurant_id);
create index idx_restaurant_tables_qr_token   on restaurant_tables (qr_token);

alter table restaurant_tables enable row level security;

create policy "restaurant_tables_select"
  on restaurant_tables for select
  using ( is_restaurant_member(restaurant_id) );

create policy "restaurant_tables_insert"
  on restaurant_tables for insert
  with check (
    exists (
      select 1 from restaurant_users
      where restaurant_id = restaurant_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

create policy "restaurant_tables_update"
  on restaurant_tables for update
  using (
    exists (
      select 1 from restaurant_users
      where restaurant_id = restaurant_id
        and user_id = auth.uid()
        and role in ('owner', 'manager', 'waiter')
    )
  );

create policy "restaurant_tables_delete"
  on restaurant_tables for delete
  using (
    exists (
      select 1 from restaurant_users
      where restaurant_id = restaurant_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

-- Policy publique : un client non authentifié peut résoudre un qr_token
-- pour afficher le menu (lecture seule sur restaurant_id + label)
create policy "restaurant_tables_public_qr"
  on restaurant_tables for select
  using ( true );  -- filtré par qr_token côté applicatif

-- ────────────────────────────────────────────
-- TABLE : menu_categories
-- ────────────────────────────────────────────
create table menu_categories (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants (id) on delete cascade,
  name           text not null,
  sort_order     int  not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create index idx_menu_categories_restaurant on menu_categories (restaurant_id);

alter table menu_categories enable row level security;

-- Lecture : membres + clients anonymes (accès menu public)
create policy "menu_categories_select"
  on menu_categories for select
  using ( is_active = true or is_restaurant_member(restaurant_id) );

create policy "menu_categories_insert"
  on menu_categories for insert
  with check (
    exists (
      select 1 from restaurant_users
      where restaurant_id = restaurant_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

create policy "menu_categories_update"
  on menu_categories for update
  using (
    exists (
      select 1 from restaurant_users
      where restaurant_id = restaurant_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

create policy "menu_categories_delete"
  on menu_categories for delete
  using (
    exists (
      select 1 from restaurant_users
      where restaurant_id = restaurant_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

-- ────────────────────────────────────────────
-- TABLE : menu_items
-- ────────────────────────────────────────────
create table menu_items (
  id                  uuid primary key default gen_random_uuid(),
  restaurant_id       uuid not null references restaurants (id) on delete cascade,
  category_id         uuid not null references menu_categories (id) on delete restrict,
  name                text not null,
  description         text,
  price               numeric(12, 2) not null,
  photo_url           text,
  is_available        boolean not null default true,
  prep_time_minutes   int,
  sort_order          int  not null default 0,
  created_at          timestamptz not null default now()
);

create index idx_menu_items_restaurant on menu_items (restaurant_id);
create index idx_menu_items_category   on menu_items (category_id);

alter table menu_items enable row level security;

-- Lecture publique (menu client)
create policy "menu_items_select"
  on menu_items for select
  using ( is_available = true or is_restaurant_member(restaurant_id) );

create policy "menu_items_insert"
  on menu_items for insert
  with check (
    exists (
      select 1 from restaurant_users
      where restaurant_id = restaurant_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

create policy "menu_items_update"
  on menu_items for update
  using (
    exists (
      select 1 from restaurant_users
      where restaurant_id = restaurant_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

create policy "menu_items_delete"
  on menu_items for delete
  using (
    exists (
      select 1 from restaurant_users
      where restaurant_id = restaurant_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

-- ────────────────────────────────────────────
-- Fonction : order_number séquentiel PAR restaurant
-- Utilise un advisory lock pour éviter les doublons en concurrence
-- ────────────────────────────────────────────
create sequence if not exists order_number_seq;  -- non utilisé directement, sert de fallback

create or replace function next_order_number(p_restaurant_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  -- Lock au niveau du restaurant pour garantir l'unicité
  perform pg_advisory_xact_lock(hashtext(p_restaurant_id::text));

  select coalesce(max(order_number), 0) + 1
    into v_next
    from orders
   where restaurant_id = p_restaurant_id;

  return v_next;
end;
$$;

-- ────────────────────────────────────────────
-- TABLE : orders
-- ────────────────────────────────────────────
create table orders (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants (id) on delete restrict,
  table_id       uuid references restaurant_tables (id) on delete set null,
  order_number   int  not null,
  type           order_type   not null default 'dine_in',
  status         order_status not null default 'new',
  is_locked      boolean not null default false,
  locked_at      timestamptz,
  total_amount   numeric(12, 2) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (restaurant_id, order_number)
);

create index idx_orders_restaurant   on orders (restaurant_id);
create index idx_orders_table        on orders (table_id);
create index idx_orders_status       on orders (restaurant_id, status);
create index idx_orders_order_number on orders (restaurant_id, order_number);

alter table orders enable row level security;

-- Trigger : remplit order_number automatiquement avant insertion
create or replace function set_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.order_number := next_order_number(new.restaurant_id);
  return new;
end;
$$;

create trigger trg_set_order_number
  before insert on orders
  for each row execute function set_order_number();

-- Trigger : met à jour updated_at
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function touch_updated_at();

-- Policies orders
create policy "orders_select"
  on orders for select
  using ( is_restaurant_member(restaurant_id) );

-- Insertion : tout membre (waiter, manager, owner) + client anonyme via qr_token
-- (le client anonyme passe par une Server Action qui vérifie le qr_token)
create policy "orders_insert"
  on orders for insert
  with check (
    is_restaurant_member(restaurant_id)
    or auth.uid() is null  -- commande client anonyme (contrôlée par Server Action)
  );

create policy "orders_update"
  on orders for update
  using (
    is_restaurant_member(restaurant_id)
    and not is_locked  -- impossible de modifier une commande verrouillée
  );

create policy "orders_delete"
  on orders for delete
  using (
    exists (
      select 1 from restaurant_users
      where restaurant_id = restaurant_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

-- ────────────────────────────────────────────
-- TABLE : order_items
-- ────────────────────────────────────────────
create table order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders (id) on delete cascade,
  menu_item_id   uuid not null references menu_items (id) on delete restrict,
  quantity       int  not null check (quantity > 0),
  unit_price     numeric(12, 2) not null,
  notes          text,
  created_at     timestamptz not null default now()
);

create index idx_order_items_order     on order_items (order_id);
create index idx_order_items_menu_item on order_items (menu_item_id);

alter table order_items enable row level security;

-- Accès via la commande parente (même restaurant)
create policy "order_items_select"
  on order_items for select
  using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and is_restaurant_member(o.restaurant_id)
    )
  );

create policy "order_items_insert"
  on order_items for insert
  with check (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (
          is_restaurant_member(o.restaurant_id)
          or auth.uid() is null  -- client anonyme
        )
        and not o.is_locked
    )
  );

create policy "order_items_update"
  on order_items for update
  using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and is_restaurant_member(o.restaurant_id)
        and not o.is_locked
    )
  );

create policy "order_items_delete"
  on order_items for delete
  using (
    exists (
      select 1 from orders o
      join restaurant_users ru on ru.restaurant_id = o.restaurant_id
      where o.id = order_id
        and ru.user_id = auth.uid()
        and ru.role in ('owner', 'manager', 'waiter')
        and not o.is_locked
    )
  );

-- ────────────────────────────────────────────
-- TABLE : payments
-- ────────────────────────────────────────────
create table payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders (id) on delete restrict,
  restaurant_id       uuid not null references restaurants (id) on delete restrict,
  method              payment_method not null,
  provider            text,
  amount              numeric(12, 2) not null,
  status              payment_status not null default 'pending',
  external_reference  text,
  created_at          timestamptz not null default now()
);

create index idx_payments_order      on payments (order_id);
create index idx_payments_restaurant on payments (restaurant_id);
create index idx_payments_status     on payments (restaurant_id, status);

alter table payments enable row level security;

create policy "payments_select"
  on payments for select
  using ( is_restaurant_member(restaurant_id) );

-- Création d'un paiement : membre ou client anonyme (webhook)
create policy "payments_insert"
  on payments for insert
  with check (
    is_restaurant_member(restaurant_id)
    or auth.uid() is null
  );

-- Mise à jour : owner/manager (ex. marquer success/failed manuellement)
create policy "payments_update"
  on payments for update
  using (
    exists (
      select 1 from restaurant_users
      where restaurant_id = restaurant_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

-- Aucune suppression de paiement permise (audit trail)
-- (pas de policy DELETE → bloqué par défaut)
