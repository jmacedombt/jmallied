"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs font-medium text-allied-silver/70 hover:text-white border border-allied-border rounded-lg px-3 py-2 transition"
    >
      Sair
    </button>
  );
}
