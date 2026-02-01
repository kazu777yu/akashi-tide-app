import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Lazy-init to avoid crashing at build time when env vars are missing
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

export type FishingRecord = {
  id: string;
  date: string;
  time: string | null;
  tide_type: string | null;
  fish_count: number | null;
  fish_type: string | null;
  memo: string | null;
  created_at: string;
};
