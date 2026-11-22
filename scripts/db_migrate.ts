/**
 * Applies supabase/migrations/*.sql in order (once each), then seeds facilities from
 * data/clean/facilities.geojson. Uses SUPABASE_DB_URL from .env / .env.local.
 *
 * Run: npm run db:migrate
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { loadEnv } from "./env";

loadEnv();
const ROOT = path.resolve(__dirname, "..");

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is missing in .env");
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    await db.query(`create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())`);
    await db.query(`alter table public._migrations enable row level security`);
    await db.query(`revoke all on public._migrations from anon, authenticated`);
    const done = new Set((await db.query(`select name from public._migrations`)).rows.map((r) => r.name));

    const dir = path.join(ROOT, "supabase/migrations");
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      if (done.has(file)) {
        console.log(`✓ ${file} (already applied)`);
        continue;
      }
      await db.query("begin");
      try {
        await db.query(fs.readFileSync(path.join(dir, file), "utf8"));
        await db.query(`insert into public._migrations (name) values ($1)`, [file]);
        await db.query("commit");
        console.log(`→ applied ${file}`);
      } catch (e) {
        await db.query("rollback");
        throw new Error(`${file}: ${(e as Error).message}`);
      }
    }

    // Seed facilities (replace all rows so the table always matches the clean file).
    const geo = JSON.parse(fs.readFileSync(path.join(ROOT, "data/clean/facilities.geojson"), "utf8"));
    const rows = geo.features.map((f: { properties: Record<string, unknown> }) => f.properties);
    await db.query("begin");
    await db.query("delete from public.facilities");
    const cols = ["id", "name", "name_km", "type", "province", "district", "lat", "lng", "source"];
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const values: unknown[] = [];
      const tuples = chunk.map((r: Record<string, unknown>, j: number) => {
        cols.forEach((c) => values.push(r[c] ?? null));
        return `(${cols.map((_, k) => `$${j * cols.length + k + 1}`).join(",")})`;
      });
      await db.query(`insert into public.facilities (${cols.join(",")}) values ${tuples.join(",")}`, values);
    }
    await db.query("commit");
    const { rows: c } = await db.query("select count(*)::int as n from public.facilities");
    console.log(`✓ facilities seeded: ${c[0].n} rows (file has ${rows.length})`);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
