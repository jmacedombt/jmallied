import { Package, Boxes, RefreshCcw, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import CardResumo from "@/components/CardResumo";
import ImportarBasePecasForm from "@/components/ImportarBasePecasForm";
import GraficoPecasPorPeriodo from "@/components/GraficoPecasPorPeriodo";
import TabelaVariacaoPrecoPecas, { type VariacaoPreco } from "@/components/TabelaVariacaoPrecoPecas";
import TabelaPecasCasadasGspn, { type PecaCasada } from "@/components/TabelaPecasCasadasGspn";
import { type RemessaCasada } from "@/components/FiltroRemessaGspn";
import { formatarDataBr, podeImportarBasePecas } from "@/lib/pecas";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

export default async function BasePecasPage({
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

  type ResumoPecas = { pecas_unicas: number; pecas_registradas: number; data_mais_recente: string | null };
  type PontoPeriodo = { periodo: string; quantidade: number | string };

  const remessaSelecionada = searchParams.remessa?.trim() || null;

  const [
    { data: resumo },
    { data: porMes },
    { data: porSemana },
    { data: porAno },
    { data: ultimaImportacao },
    { data: variacaoPreco },
    { data: pecasCasadasBrutas, error: erroPecasCasadas },
    { data: remessasBrutas, error: erroRemessas },
  ] = await Promise.all([
    supabase.rpc("pecas_metricas_resumo").single() as unknown as Promise<{ data: ResumoPecas | null }>,
    supabase.rpc("pecas_metricas_periodo", { p_agrupamento: "mes" }) as unknown as Promise<{
      data: PontoPeriodo[] | null;
    }>,
    supabase.rpc("pecas_metricas_periodo", { p_agrupamento: "semana" }) as unknown as Promise<{
      data: PontoPeriodo[] | null;
    }>,
    supabase.rpc("pecas_metricas_periodo", { p_agrupamento: "ano" }) as unknown as Promise<{
      data: PontoPeriodo[] | null;
    }>,
    supabase
      .from("pecas_importacoes")
      .select("importado_em, usuarios:importado_por (nome, sobrenome)")
      .order("importado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("pecas_variacao_preco_recente", { p_dias: 60 }) as unknown as Promise<{
      data: VariacaoPreco[] | null;
    }>,
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
  const erroPecasCasadasGspn = erroPecasCasadas?.message || erroRemessas?.message || null;

  const pecasCasadas: PecaCasada[] = (pecasCasadasBrutas ?? []).map((p) => ({
    peca: p.peca,
    quantidade: Number(p.quantidade),
    percentual: Number(p.percentual),
  }));
  const remessasCasadas: RemessaCasada[] = (remessasBrutas ?? []).map((r) => ({
    nf_remessa_allied: r.nf_remessa_allied,
    quantidade_chamados: Number(r.quantidade_chamados),
  }));

  const normalizar = (linhas: PontoPeriodo[] | null) =>
    (linhas ?? []).map((l) => ({ periodo: l.periodo, quantidade: Number(l.quantidade) }));

  const usuarioImportacao = ultimaImportacao?.usuarios as
    | { nome: string; sobrenome: string }
    | { nome: string; sobrenome: string }[]
    | null
    | undefined;
  const nomeUsuarioImportacao = Array.isArray(usuarioImportacao)
    ? usuarioImportacao[0]
    : usuarioImportacao;

  return (
    <AppShell titulo="Base Peças" perfil={perfil}>
      {/* Carregar base + os 4 cards de resumo, todos na mesma linha (quebra
          responsivamente em telas menores) — pedido explícito do Rafael. */}
      <div className="flex flex-wrap items-start gap-4 mb-6">
        {podeImportarBasePecas(perfil) && (
          <div className="flex-[1.4] min-w-[320px]">
            <ImportarBasePecasForm />
          </div>
        )}
        <div className="flex-1 min-w-[200px]">
          <CardResumo icone={Package} label="Peças únicas (códigos)" valor={resumo?.pecas_unicas ?? 0} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <CardResumo
            icone={Boxes}
            label="Peças registradas (soma da quantidade)"
            valor={resumo?.pecas_registradas ?? 0}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <CardResumo
            icone={RefreshCcw}
            label="Atualizada em"
            valor={ultimaImportacao ? formatarDataHoraBrasilia(ultimaImportacao.importado_em) : "—"}
            sub={
              nomeUsuarioImportacao
                ? `por ${nomeUsuarioImportacao.nome} ${nomeUsuarioImportacao.sobrenome}`
                : undefined
            }
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <CardResumo
            icone={CalendarClock}
            label="Peça mais recente da base"
            valor={formatarDataBr(resumo?.data_mais_recente)}
          />
        </div>
      </div>

      <GraficoPecasPorPeriodo
        porMes={normalizar(porMes)}
        porSemana={normalizar(porSemana)}
        porAno={normalizar(porAno)}
      />

      <TabelaVariacaoPrecoPecas linhas={variacaoPreco ?? []} />

      <TabelaPecasCasadasGspn
        linhas={pecasCasadas}
        remessas={remessasCasadas}
        remessaSelecionada={remessaSelecionada}
        erro={erroPecasCasadasGspn}
      />
    </AppShell>
  );
}
