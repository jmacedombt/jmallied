import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelAuditoria from "@/components/PainelAuditoria";

// "Auditoria" (pedido explícito, 25/09/2026, migration 0070) — histórico
// das alterações de OS Reparadora feitas em Operacional > Consulta/
// Alteração. Só pro Administrador (is_master) — mais restrito que a
// própria alteração (Supervisor/Gerente também alteram, mas não veem
// esse histórico, de propósito).
export default async function AuditoriaPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let perfil: { nome: string; sobrenome: string; cargo: string; is_master: boolean } | null = null;
  if (user) {
    const { data } = await supabase
      .from("usuarios")
      .select("nome, sobrenome, cargo, is_master")
      .eq("id", user.id)
      .single();
    perfil = data;
  }

  return (
    <AppShell
      titulo="Auditoria"
      tituloInfo="Toda alteração de OS Reparadora feita em Operacional > Consulta/Alteração fica registrada aqui, com quem alterou e quando — disponível por 60 dias."
      perfil={perfil}
    >
      {perfil?.is_master ? (
        <PainelAuditoria />
      ) : (
        <p
          className="text-sm rounded-xl border px-4 py-3"
          style={{ color: "var(--muted)", borderColor: "var(--line)", background: "var(--surface)" }}
        >
          Só o Administrador pode acessar a Auditoria.
        </p>
      )}
    </AppShell>
  );
}
