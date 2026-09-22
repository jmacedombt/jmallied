import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelContraPropostas from "@/components/PainelContraPropostas";
import { podeConfirmarAprovacaoOrcamento } from "@/lib/orcamentos";
import { isAllied } from "@/lib/usuarios";

// Novo submenu "Contra Propostas" dentro de Operacional (pedido
// explícito) — histórico de toda planilha final gerada em Ag. Contra
// Proposta > Enviar Contra Proposta, com data/hora, pra consulta futura e
// re-download. Mesmo formato/padrão do "Modelo de Retorno" (migration
// 0049/0060). Mesma permissão de quem decide a Contra Proposta
// (podeConfirmarAprovacaoOrcamento) — e também o login ALLIED (pedido
// explícito).
export default async function ContraPropostasPage() {
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
      titulo="Contra Propostas"
      tituloInfo="Histórico das planilhas finais geradas em Ag. Contra Proposta > Enviar Contra Proposta — cada geração fica registrada aqui com data e hora, disponível pra consulta e download quando precisar."
      perfil={perfil}
    >
      {podeConfirmarAprovacaoOrcamento(perfil) || isAllied(perfil) ? (
        <PainelContraPropostas />
      ) : (
        <p
          className="text-sm rounded-xl border px-4 py-3"
          style={{ color: "var(--muted)", borderColor: "var(--line)", background: "var(--surface)" }}
        >
          Seu cargo não tem permissão pra acessar o histórico de Contra Propostas.
        </p>
      )}
    </AppShell>
  );
}
