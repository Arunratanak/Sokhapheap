-- SokhaPheap initial schema.
-- Privacy: no names, phone numbers or ID numbers are stored anywhere.
-- Access: the public (anon) client may only READ facilities. All writes go through
-- server routes using the service role key (which bypasses RLS).

-- ---------- facilities (open data, public read) ----------
create table if not exists public.facilities (
  id        text primary key,
  name      text not null,
  name_km   text,
  type      text not null check (type in ('hospital', 'health_centre', 'health_post', 'clinic', 'other')),
  province  text not null,
  district  text,
  lat       double precision not null check (lat between -90 and 90),
  lng       double precision not null check (lng between -180 and 180),
  source    text not null check (source in ('moh_2010', 'osm'))
);
create index if not exists facilities_area_idx on public.facilities (province, district);
create index if not exists facilities_latlng_idx on public.facilities (lat, lng);

-- ---------- organizations ----------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text,
  org_code   text not null unique,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- screenings (anonymous) ----------
create table if not exists public.screenings (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  channel        text not null check (channel in ('web', 'bot')),
  findrisc_score smallint not null check (findrisc_score between 0 and 26),
  findrisc_band  text not null check (findrisc_band in ('low', 'slightly_elevated', 'moderate', 'high', 'very_high')),
  cvd_band       text check (cvd_band in ('<5', '5-10', '10-20', '20-30', '>=30')),
  province       text,
  org_code       text references public.organizations (org_code) on update cascade on delete set null,
  is_demo        boolean not null default false
);
create index if not exists screenings_org_idx on public.screenings (org_code);

-- ---------- reminders (explicit opt-in only) ----------
create table if not exists public.reminders (
  id               uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint not null,
  remind_on        date not null,
  type             text not null check (type in ('6_months', '12_months')),
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);
create index if not exists reminders_due_idx on public.reminders (remind_on) where sent_at is null;

-- ---------- Row Level Security ----------
alter table public.facilities    enable row level security;
alter table public.organizations enable row level security;
alter table public.screenings    enable row level security;
alter table public.reminders     enable row level security;

drop policy if exists "facilities are public" on public.facilities;
create policy "facilities are public" on public.facilities for select to anon, authenticated using (true);
-- No policies on organizations / screenings / reminders → anon & authenticated get nothing.

revoke all on public.screenings, public.reminders, public.organizations from anon, authenticated;
revoke insert, update, delete on public.facilities from anon, authenticated;
grant select on public.facilities to anon, authenticated;

-- ---------- nearest facilities (Haversine) ----------
create or replace function public.nearest_facilities(
  p_lat   double precision,
  p_lng   double precision,
  p_limit integer default 5,
  p_types text[] default null
)
returns table (
  id text, name text, name_km text, type text, province text, district text,
  lat double precision, lng double precision, source text, distance_m double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  select f.id, f.name, f.name_km, f.type, f.province, f.district, f.lat, f.lng, f.source,
         2 * 6371000 * asin(sqrt(
           power(sin(radians(f.lat - p_lat) / 2), 2) +
           cos(radians(p_lat)) * cos(radians(f.lat)) * power(sin(radians(f.lng - p_lng) / 2), 2)
         )) as distance_m
  from public.facilities f
  where p_types is null or f.type = any (p_types)
  order by distance_m
  limit least(greatest(coalesce(p_limit, 5), 1), 50);
$$;

grant execute on function public.nearest_facilities(double precision, double precision, integer, text[]) to anon, authenticated;
