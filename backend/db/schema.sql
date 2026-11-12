-- =============================================================================
-- MangoFilter — esquema de base de datos (PostgreSQL / Supabase)
--
-- Cómo usarlo: en Supabase → SQL Editor → New query → pega TODO este archivo
-- → Run. Es idempotente: se puede volver a ejecutar sin perder datos.
--
-- Todo vive en el esquema privado `mangofilter`, que Supabase NO expone por su
-- API pública (PostgREST). Solo el backend de MangoFilter accede, con la
-- cadena de conexión de la base de datos. Además se activa RLS sin políticas
-- como defensa adicional: aunque alguien expusiera el esquema, los roles
-- públicos (anon/authenticated) no podrían leer ni escribir nada.
-- =============================================================================

create schema if not exists mangofilter;

-- ---------------------------------------------------------------- Usuarios ---
create table if not exists mangofilter.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null unique
                      check (email = lower(email) and length(email) <= 254 and position('@' in email) > 1),
  created_at          timestamptz not null default now(),
  last_login_at       timestamptz,
  -- Momento en que aceptó el aviso de privacidad (Ley 1581 de 2012).
  privacy_accepted_at timestamptz not null
);

-- Códigos de verificación de 6 dígitos. Se guarda solo el HMAC del código,
-- nunca el código en texto plano.
create table if not exists mangofilter.login_codes (
  id           bigint generated always as identity primary key,
  email        text not null,
  code_hash    text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  attempts     integer not null default 0,
  consumed_at  timestamptz,
  requested_ip text
);
create index if not exists login_codes_email_idx on mangofilter.login_codes (email, created_at desc);

-- Sesiones: se guarda solo el SHA-256 del token que tiene el celular.
create table if not exists mangofilter.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references mangofilter.users (id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  user_agent   text
);
create index if not exists sessions_user_idx on mangofilter.sessions (user_id);

-- ------------------------------------------------- Datos de cada usuario ---
create table if not exists mangofilter.preferences (
  user_id    uuid primary key references mangofilter.users (id) on delete cascade,
  city       text not null,
  city_name  text not null,
  criterion  text not null check (criterion in ('precio', 'equilibrado', 'rapidez')),
  theme_mode text not null check (theme_mode in ('system', 'light', 'dark')),
  haptics    boolean not null,
  updated_at timestamptz not null default now()
);

create table if not exists mangofilter.saved_products (
  user_id            uuid not null references mangofilter.users (id) on delete cascade,
  product_id         text not null,
  name               text not null,
  image_url          text,
  query              text not null,
  best_total_at_save bigint not null check (best_total_at_save >= 0),
  saved_at           timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- --------------------------------------------------------------- Eventos ---
-- `actor` es un seudónimo (HMAC) del usuario o del dispositivo anónimo: permite
-- contar personas distintas sin guardar quién es. `user_id` solo se llena si
-- la persona inició sesión, y se borra cuando borra su historial o su cuenta.

-- Una fila por búsqueda (sin repetir la misma búsqueda del mismo actor en 10 min).
create table if not exists mangofilter.search_events (
  id           bigint generated always as identity primary key,
  actor        text not null,
  user_id      uuid references mangofilter.users (id) on delete set null,
  query        text not null,
  query_norm   text not null,
  city         text not null,
  result_count integer not null,
  created_at   timestamptz not null default now()
);
create index if not exists search_events_city_idx  on mangofilter.search_events (city, created_at desc);
create index if not exists search_events_actor_idx on mangofilter.search_events (actor, created_at desc);
create index if not exists search_events_user_idx  on mangofilter.search_events (user_id, created_at desc) where user_id is not null;

-- Una "vista" = el usuario abrió el enlace de una oferta hacia la tienda
-- (sin repetir la misma oferta del mismo actor en 30 min).
create table if not exists mangofilter.click_events (
  id           bigint generated always as identity primary key,
  actor        text not null,
  user_id      uuid references mangofilter.users (id) on delete set null,
  store_id     text not null,
  offer_id     text not null,
  product_name text not null,
  query_norm   text,
  city         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists click_events_time_idx  on mangofilter.click_events (created_at desc, store_id);
create index if not exists click_events_actor_idx on mangofilter.click_events (actor, offer_id, created_at desc);
create index if not exists click_events_user_idx  on mangofilter.click_events (user_id, created_at desc) where user_id is not null;

-- --------------------------------------------------------------- Seguridad ---
alter table mangofilter.users          enable row level security;
alter table mangofilter.login_codes    enable row level security;
alter table mangofilter.sessions       enable row level security;
alter table mangofilter.preferences    enable row level security;
alter table mangofilter.saved_products enable row level security;
alter table mangofilter.search_events  enable row level security;
alter table mangofilter.click_events   enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema mangofilter from anon, authenticated;
    revoke all on all tables in schema mangofilter from anon, authenticated;
    revoke all on all sequences in schema mangofilter from anon, authenticated;
  end if;
end
$$;
