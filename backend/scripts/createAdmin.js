/*
|--------------------------------------------------------------------------
| CREATE ADMIN — one-time CLI script
|--------------------------------------------------------------------------
| There is no public registration page anymore. The very first admin
| account has to be created directly in the database, by running this
| script from the server (not from the app).
|
| Usage:
|   node scripts/createAdmin.js "Admin Name" admin@example.com "SomePassword1"
|
| Or set env vars and run with no args:
|   ADMIN_NAME="Admin Name" ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=SomePassword1 node scripts/createAdmin.js
|
| Safe to re-run — if that email already exists, it just reports that
| instead of creating a duplicate or overwriting anything.
|--------------------------------------------------------------------------
*/

require("dotenv").config();

const bcrypt = require("bcryptjs");
const { connectDB } = require("../config/database");
const { User } = require("../models");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

async function main() {
  const [, , argName, argEmail, argPassword] = process.argv;

  const name = argName || process.env.ADMIN_NAME;
  const email = (argEmail || process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = argPassword || process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error(
      "Usage: node scripts/createAdmin.js \"Admin Name\" admin@example.com \"Password123\"\n" +
      "   or: set ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD env vars"
    );
    process.exit(1);
  }

  if (!EMAIL_RE.test(email)) {
    console.error("That email address doesn't look valid.");
    process.exit(1);
  }

  if (!PASSWORD_RE.test(password)) {
    console.error("Password must be at least 6 characters and include a letter and a number.");
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`A user with email "${email}" already exists (role: ${existing.role}). Nothing created.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await User.create({
    name: name.trim(),
    email,
    password: passwordHash,
    role: "admin",
    status: "active",
  });

  console.log(`Admin created: ${admin.name} <${admin.email}>`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to create admin:", error);
  process.exit(1);
});
