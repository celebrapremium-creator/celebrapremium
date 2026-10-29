import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createTestAdminClient() {
  const url = process.env.SUPABASE_TEST_URL;
  const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
