-- Optional "Log in with Telegram" and saved records ("My records"), shared by the website and the bot.
-- Privacy: only the numeric Telegram user ID is kept. No name, @username, phone number or photo is stored
-- (login_requests.first_name is held for a few minutes, only until the browser picks up its session, and is
-- then deleted with the row). Records hold result summaries only, never the answers.
-- The anonymous research table public.screenings is unchanged and never linked to an account.
-- Access: service role only (server routes and the bot). anon / authenticated get nothing.

-- ---------- login requests (website → confirm in the bot), live for 10 minutes ----------
create table if not exists public.login_requests (
  id               uuid primary key default gen_random_uuid(),
  link_hash        text not null unique,  -- sha256 of the token in the t.me/<bot>?start=login_<token> link
  poll_hash        text not null unique,  -- sha256 of the secret only the browser that started the login holds
  code             text not null,         -- 4 digits shown on the website and in the bot, to match by eye
  status           text not null default 'pending' check (status in ('pending', 'confirmed', 'denied')),
  telegram_user_id bigint,
  first_name       text,
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now()
);
create index if not exists login_requests_expires_idx on public.login_requests (expires_at);

-- ---------- web sessions (bearer tokens; only their hash is stored) ----------
create table if not exists public.user_sessions (
  id               uuid primary key default gen_random_uuid(),
  token_hash       text not null unique,
  telegram_user_id bigint not null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null
);
create index if not exists user_sessions_user_idx on public.user_sessions (telegram_user_id);

-- ---------- saved records ----------
create table if not exists public.health_records (
  id               uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null,
  created_at       timestamptz not null default now(),
  channel          text not null check (channel in ('web', 'bot')),
  kind             text not null check (kind in ('health_check', 'risk', 'lab')),
  data             jsonb not null check (octet_length(data::text) <= 20000)
);
create index if not exists health_records_user_idx on public.health_records (telegram_user_id, created_at desc);

alter table public.login_requests enable row level security;
alter table public.user_sessions  enable row level security;
alter table public.health_records enable row level security;
revoke all on public.login_requests, public.user_sessions, public.health_records from anon, authenticated;
grant select, insert, update, delete on public.login_requests, public.user_sessions, public.health_records to service_role;
