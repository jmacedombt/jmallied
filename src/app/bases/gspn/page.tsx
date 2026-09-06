import { ClipboardList, RefreshCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import CardResumo from "@/components/CardResumo";
import ImportarGspnForm from "@/components/ImportarGspnForm";
import TabelaPecasCasadasGspn, { type PecaCasada } from "@/components/TabelaPecasCasadasGspn";
import { type RemessaCasada } from "@/components/FiltroRemessaGspn";
import { podeImportarGspn } from "@/lib/gspn";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

export default async function BaseGspnPage({
  searchParams,
}: {
  searchParams: { remessa?: string };
}) {
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

  const remessaSelecionada = searchParams.remessa?.trim() || null;

  const [
    { count: totalChamados },
    { data: ultimaImportacao },
    { data: pecasCasadasBrutas, error: erroPecasCasadas },
    { data: remessasBrutas, error: erroRemessas },
  ] = await Promise.all([
    supabase.from("gspn_chamados").select("id", { count: "exact", head: true }),
    supabase
      .from("gspn_importacoes")
      .select(
        "importado_em, chamados_novos, chamados_atualizados, pecas_casadas_orcamento, pecas_nao_casadas_orcamento, usuarios:importado_por (nome, sobrenome)"
      )
      .order("importado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("gspn_pecas_casadas", { p_nf_remessa: remessaSelecionada }) as unknown as Promise<{
      data: PecaCasada[] | null;
      error: { message: string } | null;
    }>,
    supabase.rpc("gspn_remessas_casadas") as unknown as Promise<{
      data: RemessaCasada[] | null;
      error: { message: string } | null;
    }>,
  ]);

  // se as funções da migration 0024 ainda não foram rodadas no Supabase (ou
  // qualquer outro erro na consulta), mostra isso explicitamente em vez de
  // simplesmente aparentar "nenhuma peça casada" — evita confusão.
  const erroRelacao = erroPecasCasadas?.message || erroRemessas?.message || null;

  const usuarioImportacao = ultimaImportacao?.usuarios as
    | { nome: string; sobrenome: string }
    | { nome: string; sobrenome: string }[]
    | null
    | undefined;
  const nomeUsuarioImportacao = Array.isArray(usuarioImportacao) ? usuarioImportacao[0] : usuarioImportacao;

  const pecasCasadas: PecaCasada[] = (pecasCasadasBrutas ?? []).map((p) => ({
    peca: p.peca,
    quantidade: Number(p.quantidade),
    percentual: Number(p.percentual),
  }));
  const remessasCasadas: RemessaCasada[] = (remessasBrutas ?? []).map((r) => ({
    nf_remessa_allied: r.nf_remessa_allied,
    quantidade_chamados: Number(r.quantidade_chamados),
  }));

  return (
    <AppShell
      titulo="Base GSPN"
      perfil={perfil}
      tituloInfo="Importe a exportação do sistema Samsung GSPN. O sistema casa cada chamado pela OS Reparadora e atualiza as peças (peça 1 a 10) da tabela de orçamentos automaticamente."
    >
      {/* Carregar base + os 2 cards de resumo, todos na mesma linha
          (quebra responsivamente em telas menores). */}
      <div className="flex flex-wrap items-start gap-4 mb-6">
        {podeImportarGspn(perfil) && (
          <div className="flex-[1.4] min-w-[320px]">
            <ImportarGspnForm />
          </div>
        )}
        <div className="flex-1 min-w-[220px]">
          <CardResumo icone={ClipboardList} label="Chamados na Base GSPN" valor={totalChamados ?? 0} />
        </div>
        <div className="flex-1 min-w-[220px]">
          <CardResumo
            icone={RefreshCcw}
            label="Última importação"
            valor={ultimaImportacao ? formatarDataHoraBrasilia(ultimaImportacao.importado_em) : "—"}
            sub={
              ultimaImportacao
                ? `${nomeUsuarioImportacao ? `por ${nomeUsuarioImportacao.nome} ${nomeUsuarioImportacao.sobrenome} · ` : ""}${ultimaImportacao.pecas_casadas_orcamento} casaram${ultimaImportacao.pecas_nao_casadas_orcamento > 0 ? `, ${ultimaImportacao.pecas_nao_casadas_orcamento} não casaram` : ""}`
                : undefined
            }
          />
        </div>
      </div>

      <TabelaPecasCasadasGspn
        linhas={pecasCasadas}
        remessas={remessasCasadas}
        remessaSelecionada={remessaSelecionada}
        erro={erroRelacao}
      />
    </AppShell>
  );
}
