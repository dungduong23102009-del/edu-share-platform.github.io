import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";
import type { Database } from "./database.types";

export function createClient() {
  const { url, key } = supabaseConfig();
  return createBrowserClient<Database>(url, key);
}
