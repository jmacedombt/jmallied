import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelReorcamento from "@/components/PainelReorcamento";
import { podeConfirmarAprovacaoOrcamento } from "@/lib/orcamentos";
import { isAllied } from "@/lib/usuarios";

// Novo submenu "Reorçamento" dentro de Operacional (pedido explícito,
// 02/10/2026) — histórico de toda planilha Complementar já gerada em "4 -
// Ag. Resposta de Reorçamento" > Enviar planilha Complementar, com
// data/hora, pra consulta futura e re-download. Mesmo formato/padrão do
// "Contra Propostas" (ver PainelContraPropostas.tsx) — mesma permissão de
// quem decide a Contra Proposta/Reorçamento (podeConfirmarAprovacaoOrcamento)
// e também o login ALLIED (pedido explícito).
export default async function ReorcamentoPage() {
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
      titulo="Reorçamento"
      tituloInfo="Histórico das planilhas Complementares geradas em 4 - Ag. Resposta de Reorçamento > Enviar planilha Complementar — cada envio fica registrado aqui com data e hora, disponível pra consulta e download quando precisar."
      perfil={perfil}
    >
      {podeConfirmarAprovacaoOrcamento(perfil) || isAllied(perfil) ? (
        <PainelReorcamento />
      ) : (
        <p
          className="text-sm rounded-xl border px-4 py-3"
          style={{ color: "var(--muted)", borderColor: "var(--line)", background: "var(--surface)" }}
        >
          Seu cargo não tem permissão pra acessar o histórico de Reorçamento.
        </p>
      )}
    </AppShell>
  );
}
