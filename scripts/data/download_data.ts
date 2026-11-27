/**
 * Downloads the raw open datasets into data/raw (skips files that already exist).
 * If a download fails, download it by hand from the URL in data/SOURCES.md and
 * unzip it into the folder shown below.
 */
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const RAW = path.resolve(__dirname, "../../data/raw");

const DATASETS = [
  {
    dir: "moh",
    check: "Health/khm_hltfacp_referral_gov.shp",
    url: "https://data.humdata.org/dataset/1803994d-6218-4b98-ac3a-30c7f85c6dbc/resource/f30b0f4b-1c40-45f3-986d-2820375ea8dd/download/health_facility.zip",
  },
  {
    dir: "osm",
    check: "health_facilities.geojson",
    url: "https://production-raw-data-api.s3.amazonaws.com/ISO3/KHM/health_facilities/hotosm_khm_health_facilities_osm_geojson.zip",
  },
  {
    dir: "admin",
    check: "khm_admin2.geojson",
    url: "https://data.humdata.org/dataset/7472f7e0-3deb-44d9-bd36-38237c666a2e/resource/2926d754-10b7-4742-889c-eb37aedd1d03/download/khm_admin_boundaries.geojson.zip",
  },
];

async function main() {
  for (const d of DATASETS) {
    const dir = path.join(RAW, d.dir);
    if (fs.existsSync(path.join(dir, d.check))) {
      console.log(`✓ ${d.dir} already present`);
      continue;
    }
    console.log(`↓ ${d.dir} ← ${d.url}`);
    const res = await fetch(d.url);
    if (!res.ok) throw new Error(`Download failed for ${d.dir} (HTTP ${res.status}). Download it manually: ${d.url}`);
    fs.mkdirSync(dir, { recursive: true });
    new AdmZip(Buffer.from(await res.arrayBuffer())).extractAllTo(dir, true);
    if (!fs.existsSync(path.join(dir, d.check))) throw new Error(`${d.dir}: expected ${d.check} after unzip`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
