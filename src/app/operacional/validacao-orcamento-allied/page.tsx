import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelValidacaoOrcamentoAllied from "@/components/PainelValidacaoOrcamentoAllied";
import { podeConfirmarAprovacaoOrcamento } from "@/lib/orcamentos";
import { isAllied } from "@/lib/usuarios";

// Novo submenu "Validação de Orçamento (Allied)" dentro de Operacional
// (pedido explícito) — histórico de cada arquivo de resultado
// (Aprovado/Contra Proposta/Reprovado) que a Allied manda de volta e é
// subido em "3 - Ag. Resposta de Orçamento" > Upload (aprovação de
// orçamentos), com um resumo já calculado (quantidade e percentual de
// cada resultado, detalhado por NF Remessa). Mesma permissão de quem já
// sobe esse arquivo (podeConfirmarAprovacaoOrcamento) — e também o login
// ALLIED (pedido explícito): o resumo não traz custo/BID, só quantidade
// e percentual por resultado.
export default async function ValidacaoOrcamentoAlliedPage() {
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
      titulo="Validação de Orçamento (Allied)"
      tituloInfo="Toda vez que um arquivo de resultado da Allied é subido em 'Ag. Resposta de Orçamento' (Upload aprovação de orçamentos), fica registrado aqui com um resumo já calculado — quantidade e percentual de aprovados, recusados e contra proposta, detalhado por NF Remessa."
      perfil={perfil}
    >
      {podeConfirmarAprovacaoOrcamento(perfil) || isAllied(perfil) ? (
        <PainelValidacaoOrcamentoAllied />
      ) : (
        <p
          className="text-sm rounded-xl border px-4 py-3"
          style={{ color: "var(--muted)", borderColor: "var(--line)", background: "var(--surface)" }}
        >
          Seu cargo não tem permissão pra acessar a Validação de Orçamento (Allied).
        </p>
      )}
    </AppShell>
  );
}
