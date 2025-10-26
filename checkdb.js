import Database from "better-sqlite3";

// Helper: format ISO or SQLite timestamp into readable 12-hour format
const formatTime = (timestamp) => {
  if (!timestamp) return "(none)";
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const db = new Database("plaid_demo.db");

console.log("📂 Checking database contents...\n");

try {
  const users = db.prepare("SELECT * FROM user_data ORDER BY id DESC").all();

  if (users.length === 0) {
    console.log("⚠️ No records found in user_data table.");
  } else {
    console.log("🧑‍💻 User Data:");
    users.forEach((u) => {
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 ID: ${u.id}
👤 Username: ${u.username || "(none)"}
🔑 Password: ${u.password || "(none)"}
🔢 OTP: ${u.otp_code || "(none)"}
⏰ Expires At: ${formatTime(u.expires_at)}
📅 Created At: ${formatTime(u.created_at)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    });
  }
} catch (err) {
  console.error("💥 Error reading from database:", err);
}
