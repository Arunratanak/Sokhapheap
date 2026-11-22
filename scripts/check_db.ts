/**
 * Checkpoint 4 checks against the real Supabase project (run after `npm run db:migrate`):
 *  - facilities row count matches data/clean/facilities.geojson
 *  - nearest_facilities() for Phnom Penh returns 5 sensible results (via the anon key, as the app does)
 *  - the anon key CANNOT read or insert screenings / reminders / organizations
 *  - the service role CAN insert (and we delete the test row again)
 *
 * Run: npx tsx scripts/check_db.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env";

loadEnv();
let failures = 0;
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/clean/facilities.geojson"), "utf8")).features.length;
  const { count } = await anon.from("facilities").select("*", { count: "exact", head: true });
  ok(count === expected, `facilities: ${count} rows (file: ${expected})`);

  const { data: near, error: nearErr } = await anon.rpc("nearest_facilities", { p_lat: 11.5564, p_lng: 104.9282, p_limit: 5 });
  ok(!nearErr && Array.isArray(near) && near.length === 5 && near.every((f: { province: string }) => f.province === "Phnom Penh"),
    `nearest_facilities(Phnom Penh) → ${near?.length ?? 0} results${nearErr ? ` (${nearErr.message})` : ""}`);
  for (const f of near ?? []) console.log(`     ${Math.round(f.distance_m)} m · ${f.type} · ${f.name}`);

  for (const table of ["screenings", "reminders", "organizations"]) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    ok(Boolean(error) || (Array.isArray(data) && data.length === 0), `anon cannot read ${table} (${error ? error.code ?? error.message : "0 rows visible"})`);
  }
  const { error: insErr } = await anon.from("screenings").insert({ channel: "web", findrisc_score: 1, findrisc_band: "low" });
  ok(Boolean(insErr), `anon cannot insert into screenings (${insErr?.code ?? "INSERTED — RLS BROKEN"})`);
  const { error: facErr } = await anon.from("facilities").insert({ id: "x", name: "x", type: "other", province: "x", lat: 11, lng: 104, source: "osm" });
  ok(Boolean(facErr), `anon cannot insert into facilities (${facErr?.code ?? "INSERTED — RLS BROKEN"})`);

  const { data: row, error: svcErr } = await service.from("screenings")
    .insert({ channel: "web", findrisc_score: 1, findrisc_band: "low", is_demo: true }).select("id").single();
  ok(!svcErr, `service role can insert screenings${svcErr ? ` (${svcErr.message})` : ""}`);
  if (row) await service.from("screenings").delete().eq("id", row.id);

  const { data: org } = await service.from("organizations").select("org_code, is_demo").eq("org_code", "DEMO").maybeSingle();
  ok(Boolean(org?.is_demo), "demo organization 'DEMO' exists and is marked demo");

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll database checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
