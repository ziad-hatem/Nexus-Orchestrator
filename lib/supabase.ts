import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

let client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
    );
  }

  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    const instance = getSupabaseClient();
    const value = Reflect.get(instance as object, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
