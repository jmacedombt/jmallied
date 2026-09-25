import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelConsultaAlteracao from "@/components/PainelConsultaAlteracao";
import { podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";
import { isAllied, podeConsultarOrcamento } from "@/lib/usuarios";

// "Consulta/Alteração" (pedido explícito, 25/09/2026, migration 0070) —
// localizar um orçamento por OS Reparadora/OS Care/Trade Allied e ver a
// ficha completa. Alterar (só o campo OS Reparadora) é restrito a
// Supervisor/Gerente/Administrador — ver podeConfirmarAnaliseEmLote.
// Custo de peça nunca aparece pro login ALLIED (mesma regra do resto do
// sistema) — reforçado de novo na rota de API, não só aqui.
export default async function ConsultaAlteracaoPage() {
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
      titulo="Consulta/Alteração"
      tituloInfo="Localize um orçamento pela OS Reparadora, OS Care Allied ou Trade Allied e veja a ficha completa. Supervisor, Gerente e Administrador também podem corrigir a OS Reparadora — toda alteração fica registrada em Sistema > Auditoria por 60 dias."
      perfil={perfil}
    >
      {podeConsultarOrcamento(perfil) ? (
        <PainelConsultaAlteracao podeAlterar={podeConfirmarAnaliseEmLote(perfil)} souAllied={isAllied(perfil)} />
      ) : (
        <p
          className="text-sm rounded-xl border px-4 py-3"
          style={{ color: "var(--muted)", borderColor: "var(--line)", background: "var(--surface)" }}
        >
          Seu cargo não tem permissão pra acessar essa tela.
        </p>
      )}
    </AppShell>
  );
}
