import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelMovimentar from "@/components/PainelMovimentar";
import { podeMovimentarOrcamentos, STATUS_DESTINO_MOVIMENTAR } from "@/lib/orcamentos";

// "Movimentar" (menu Operacional, pedido explícito, 03/10/2026) — sobe
// uma lista de Trade Allied ou OS Reparadora e troca o status_operacional
// de todos de uma vez (ou um a um). Só Administrador (is_master) ou
// Gerente (ver podeMovimentarOrcamentos em lib/orcamentos.ts) — nem
// Allied, nem os demais cargos de gestão entram aqui, de propósito.
export default async function MovimentarPage() {
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
      titulo="Movimentar"
      tituloInfo="Suba uma lista de Trade Allied ou OS Reparadora e troque o status de todos de uma vez, ou um a um. Pula as regras normais de cada etapa — use pra corrigir, não como fluxo normal. Toda movimentação fica registrada na Auditoria."
      perfil={perfil}
    >
      {podeMovimentarOrcamentos(perfil) ? (
        <PainelMovimentar statusDisponiveis={STATUS_DESTINO_MOVIMENTAR} />
      ) : (
        <p
          className="text-sm rounded-xl border px-4 py-3"
          style={{ color: "var(--muted)", borderColor: "var(--line)", background: "var(--surface)" }}
        >
          Só Administrador ou Gerente podem acessar Movimentar.
        </p>
      )}
    </AppShell>
  );
}
