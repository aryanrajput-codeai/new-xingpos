import { createBrowserClient } from "@supabase/ssr";

const anyMeta = typeof import.meta !== "undefined" ? (import.meta as any).env : {};
const supabaseUrl = 
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  anyMeta?.NEXT_PUBLIC_SUPABASE_URL ||
  anyMeta?.VITE_SUPABASE_URL ||
  "https://jkkwrhywfpbitwvffkxx.supabase.co";

const supabaseKey = 
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  anyMeta?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  anyMeta?.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_D1rREhO08nd1vWNmxyugCg_Fff4X10Y";

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );
