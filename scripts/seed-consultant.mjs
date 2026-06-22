#!/usr/bin/env node
// =====================================================================
// One DSD vNext — seed the first CONSULTANT (owner) account.
//   node scripts/seed-consultant.mjs <email> <username> [tempPassword]
// If tempPassword is omitted, a strong one is generated and printed once.
// Password is hashed with the app's own scrypt (never stored in plaintext).
// Requires DATABASE_URL to write. Without it, prints a dry-run (and proves
// hashing works) so you can rehearse before deployment. Idempotent on email.
// =====================================================================
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [email, username, pwArg] = process.argv.slice(2);
if (!email || !username) {
  console.error("usage: node scripts/seed-consultant.mjs <email> <username> [tempPassword]");
  process.exit(2);
}
const tempPassword = pwArg || (randomBytes(12).toString("base64url"));

const { hashPassword } = await import("../dist/auth/password.js");
const hash = await hashPassword(tempPassword);
console.log(`Consultant: ${username} <${email}>`);
console.log(`Temp password: ${tempPassword}   (change it at first sign-in)`);

if (!process.env.DATABASE_URL) {
  console.log("\nDRY RUN (no DATABASE_URL). Hash computed OK; nothing written.");
  console.log("Set DATABASE_URL to create the account.");
  process.exit(0);
}

const { getDb, closeDb } = await import("../dist/db.js");
const db = getDb();
try {
  await db.tx(async (tx) => {
    const existing = await tx.query("SELECT id FROM users WHERE email = $1 OR username = $2", [email, username]);
    if (existing.rows[0]) {
      console.log("\nAccount already exists — leaving it unchanged (idempotent). No password reset performed.");
      return;
    }
    const ins = await tx.query(
      "INSERT INTO users (username, email, display_name, password_hash, active) VALUES ($1,$2,$3,$4,true) RETURNING id",
      [username, email, username, hash],
    );
    const id = ins.rows[0].id;
    await tx.query("INSERT INTO role_assignments (user_id, role_key) VALUES ($1,'consultant') ON CONFLICT DO NOTHING", [id]);
    console.log(`\nCREATED consultant account ${id}. Sign in and change the password immediately.`);
  });
} finally {
  await closeDb();
}
