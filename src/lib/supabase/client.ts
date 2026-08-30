"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso em Client Components (formulários, etc).
 * Usa a anon key pública — a segurança dos dados fica a cargo das
 * políticas de RLS definidas em supabase/migrations.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
