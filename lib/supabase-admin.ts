import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/env";

export function createSupabaseAdminClient() {
  return createClient(
    getSupabaseUrl(),
    getSupabaseServiceRoleKey(),
  );
}
