/** Fails if any server secret value appears in the client bundle (.next/static). Prints names only. */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env";

loadEnv();
const SECRETS = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL", "GEMINI_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "CRON_SECRET", "ORG_DASHBOARD_ACCESS_CODE"];
const dir = path.resolve(__dirname, "../.next/static");
const files: string[] = [];
const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name))));
walk(dir);
const contents = files.map((f) => fs.readFileSync(f, "utf8"));
let leaks = 0;
for (const name of SECRETS) {
  const v = process.env[name];
  if (!v || v.length < 8) { console.log(`- ${name}: not set, skipped`); continue; }
  const found = contents.some((c) => c.includes(v) || c.includes(v.slice(0, 16)));
  if (found) leaks++;
  console.log(`${found ? "✗ LEAK" : "✓"} ${name}`);
}
// Known key prefixes
for (const prefix of ["AIza", "sb_secret_", "service_role"]) {
  const hit = contents.some((c) => c.includes(prefix));
  console.log(`${hit ? "✗ found" : "✓ not found"}: prefix "${prefix}"`);
  if (hit) leaks++;
}
console.log(`${files.length} client files scanned.`);
process.exit(leaks ? 1 : 0);
