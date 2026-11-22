/**
 * Local development: run the SAME bot logic in long-polling mode.
 * Only one mode can be active, so this deletes any webhook first.
 * After testing, run `npm run bot:webhook` to switch back to the production webhook.
 *
 * Run: npm run bot:dev
 */
import { loadEnv } from "./env";

loadEnv();

async function main() {
  const { getBot } = await import("../src/lib/bot/bot");
  const bot = getBot();
  if (!bot) throw new Error("TELEGRAM_BOT_TOKEN missing");
  await bot.api.deleteWebhook({ drop_pending_updates: false });
  await bot.api.setMyCommands([
    { command: "check", description: "Risk check / ពិនិត្យហានិភ័យ" },
    { command: "lab", description: "Blood test / តេស្តឈាម" },
    { command: "near", description: "Nearest care / កន្លែងព្យាបាល" },
    { command: "remind", description: "Reminder / ការរំលឹក" },
    { command: "language", description: "ខ្មែរ / English" },
    { command: "help", description: "Help / ជំនួយ" },
  ]);
  const me = await bot.api.getMe();
  console.log(`Polling as @${me.username} — press Ctrl+C to stop.`);
  process.once("SIGINT", () => bot.stop());
  await bot.start();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
