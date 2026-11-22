-- Demo organization with FAKE, randomly generated screenings for the pitch.
-- Clearly marked: organizations.is_demo = true and screenings.is_demo = true.
-- Remove with:  delete from screenings where is_demo; delete from organizations where is_demo;

insert into public.organizations (name, type, org_code, is_demo)
values ('Demo Garment Factory (DEMO DATA)', 'workplace', 'DEMO', true)
on conflict (org_code) do nothing;

insert into public.screenings (created_at, channel, findrisc_score, findrisc_band, cvd_band, province, org_code, is_demo)
select
  now() - (random() * interval '30 days'),
  case when random() < 0.7 then 'web' else 'bot' end,
  s.score,
  case
    when s.score < 7 then 'low'
    when s.score <= 11 then 'slightly_elevated'
    when s.score <= 14 then 'moderate'
    when s.score <= 20 then 'high'
    else 'very_high'
  end,
  (array['<5', '<5', '<5', '5-10', '5-10', '10-20', null])[1 + floor(random() * 7)::int],
  'Phnom Penh',
  'DEMO',
  true
from (
  select least(26, greatest(0, round(abs(random() + random() + random() - 1.5) * 12)))::int as score
  from generate_series(1, 87)
) s
where not exists (select 1 from public.screenings where org_code = 'DEMO');
