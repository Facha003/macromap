// Usage: ADMIN_TOKEN=... node scripts/import-official.mjs data/official/example.json [http://localhost:3000]
import { readFileSync } from "node:fs";
const [file, base = "http://localhost:3000"] = process.argv.slice(2);
if (!file || !process.env.ADMIN_TOKEN) {
  console.error("Usage: ADMIN_TOKEN=... node scripts/import-official.mjs <file.json> [baseUrl]");
  process.exit(1);
}
const res = await fetch(`${base}/api/admin/official`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
  body: readFileSync(file, "utf8"),
});
console.log(res.status, JSON.stringify(await res.json(), null, 2));
