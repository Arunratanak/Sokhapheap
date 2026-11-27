/**
 * Points the Telegram bot at the production webhook (with the secret token) and registers commands.
 * Run after deploy: npm run bot:webhook   (uses NEXT_PUBLIC_SITE_URL)
 */
import { loadEnv } from "../env";

loadEnv();

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!token || !secret || !site?.startsWith("https://")) throw new Error("Need TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and an https NEXT_PUBLIC_SITE_URL");
  const api = (method: string, body: unknown) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  const url = `${site.replace(/\/$/, "")}/api/telegram`;
  const r = await api("setWebhook", { url, secret_token: secret, allowed_updates: ["message", "callback_query"] });
  console.log("setWebhook:", r.ok ? `ok → ${url}` : r.description);
  await api("setMyCommands", {
    commands: [
      { command: "check", description: "Risk check / ពិនិត្យហានិភ័យ" },
      { command: "lab", description: "Blood test / តេស្តឈាម" },
      { command: "near", description: "Nearest care / កន្លែងព្យាបាល" },
      { command: "area", description: "Your area / តំបន់របស់អ្នក" },
      { command: "remind", description: "Reminder / ការរំលឹក" },
      { command: "language", description: "ខ្មែរ / English" },
      { command: "help", description: "Help / ជំនួយ" },
    ],
  });
  const info = await api("getWebhookInfo", {});
  console.log("webhook info:", { url: info.result?.url, pending: info.result?.pending_update_count, last_error: info.result?.last_error_message ?? null });
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
