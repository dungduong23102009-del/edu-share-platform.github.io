import { existsSync } from "node:fs";
const envFile = existsSync(".env.local");
if (envFile) process.loadEnvFile(".env.local");
const state = (value, validate) => !value ? "missing" : validate(value) ? "configured" : "invalid";
const httpUrl = (value) => {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
};
console.log(JSON.stringify({
  envFile: envFile ? "configured" : "missing",
  NEXT_PUBLIC_SUPABASE_URL: state(process.env.NEXT_PUBLIC_SUPABASE_URL, (value) => httpUrl(value) && new URL(value).hostname === "eeqeapunixkekiygnbis.supabase.co"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: state(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, (value) => value.startsWith("sb_publishable_")),
  NEXT_PUBLIC_APP_URL: state(process.env.NEXT_PUBLIC_APP_URL, (value) => httpUrl(value) && new URL(value).origin === "http://127.0.0.1:3001"),
}));
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
  { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } },
);
if (!response.ok)
  throw new Error(`Auth settings unavailable (${response.status})`);
const settings = await response.json();
console.log(
  JSON.stringify({
    connection: response.status,
    google: settings.external?.google === true,
    email: settings.external?.email === true,
    signupEnabled: settings.disable_signup === false,
    emailConfirmation: settings.mailer_autoconfirm === false,
  }),
);
