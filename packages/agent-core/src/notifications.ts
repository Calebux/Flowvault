import { Telegraf } from "telegraf";

let bot: Telegraf | null = null;

function getBot(): Telegraf | null {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  }
  return bot;
}

export async function sendTelegramMessage(
  chatId: string | null | undefined,
  message: string
): Promise<void> {
  if (!chatId) return;
  const b = getBot();
  if (!b) return;
  try {
    await b.telegram.sendMessage(chatId, message);
  } catch (err) {
    console.warn("[notifications] Telegram send failed:", err);
  }
}
