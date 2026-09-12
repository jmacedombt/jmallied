import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gauge } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import {
  statusPorSlug,
  calcularDetalheValidacao,
  aplicarAjusteManualValidacao,
  STATUS_ETAPAS_ANTERIORES_A_VALIDACAO,
  type CamposPecasOrcamento,
} from "@/lib/orcamentos";
import { calcularRTatAoVivo, formatarDias } from "@/lib/metricas";
import CardValorPrevisao from "@/components/CardValorPrevisao";
import { type AparelhoAgAbertura } from "@/components/TabelaAgAbertura";
import PainelAgAbertura from "@/components/PainelAgAbertura";
import PainelAgTriagem from "@/components/PainelAgTriagem";
import PainelAgAnalise, { type AparelhoAgAnalise } from "@/components/PainelAgAnalise";
import PainelValidacaoOrcamentos, { type AparelhoValidacao } from "@/components/PainelValidacaoOrcamentos";
import PainelOrcamentoReprovado, { type AparelhoReprovado } from "@/components/PainelOrcamentoReprovado";
import PainelRespostaOrcamento, { type AparelhoRespostaOrcamento } from "@/components/PainelRespostaOrcamento";
import PainelContraProposta, { type AparelhoContraPropostaLista } from "@/components/PainelContraProposta";
import PainelRespostaReorcamento, { type AparelhoRespostaReorcamento } from "@/components/PainelRespostaReorcamento";
import PainelAgPecas, { type AparelhoAgPecas } from "@/components/PainelAgPecas";
import PainelAgReparo, { type AparelhoAgReparo, type FalhaOqcResumo } from "@/components/PainelAgReparo";
import PainelOqc, { type AparelhoOqcLista } from "@/components/PainelOqc";
import PainelEtapaSimples, { type AparelhoEtapaSimples } from "@/components/PainelEtapaSimples";
import PainelOperacionalAllied from "@/components/PainelOperacionalAllied";
import ContadorAoVivo from "@/components/ContadorAoVivo";
import { buscarPrecosBidPorPartNumber, type FaixaMarkup } from "@/lib/bid";
import { isAllied } from "@/lib/usuarios";
import { buscarAparelhosAllied } from "@/lib/allied";

const COLUNAS_PECAS =
  "peca_1, peca_2, peca_3, peca_4, peca_5, peca_6, peca_7, peca_8, peca_9, peca_10, custo_peca_1, custo_peca_2, custo_peca_3, custo_peca_4, custo_peca_5, custo_peca_6, custo_peca_7, custo_peca_8, custo_peca_9, custo_peca_10";

const COLUNAS_PECAS_VALIDACAO =
  "peca_1, peca_2, peca_3, peca_4, peca_5, peca_6, peca_7, peca_8, peca_9, peca_10, peca_add_1, peca_add_2, peca_add_3, peca_add_4, peca_add_5";

export default async function StatusOperacionalPage({ params }: { params: { slug: string } }) {
  const statusEncontrado = statusPorSlug(params.slug);
  if (!statusEncontrado) notFound();
  const status = statusEncontrado;

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

  // Botão de voltar: fica no fluxo normal da página (não mais "fixed"),
  // canto superior esquerdo, logo acima da coluna OS Reparadora — assim
  // ele nunca fica atrás da tabela nem depende de z-index/scroll pra se
  // posicionar certo. Sem fundo — só a seta com brilho e um anel fino
  // que gira ao redor do contorno (classe .botao-voltar-brilho em
  // globals.css).
  const voltar = (
    <Link
      href="/operacional"
      title="Voltar para Operacional"
      aria-label="Voltar para Operacional"
      className="botao-voltar-brilho relative inline-flex items-center justify-center w-11 h-11 rounded-full mb-3 transition-transform hover:scale-110 active:scale-100"
    >
      <ArrowLeft
        size={20}
        strokeWidth={2.5}
        style={{ color: "var(--accent2)", filter: "drop-shadow(0 0 5px var(--accent2))" }}
      />
    </Link>
  );

  // Badge com a contagem de pendências dessa etapa, ao vivo (Realtime) —
  // atualiza sozinho assim que um aparelho entra ou sai daqui.
  function badgeContador(contagemInicial: number) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium mb-3 ml-2"
        style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <ContadorAoVivo status={status.valor} contagemInicial={contagemInicial} /> pendente(s) nessa etapa
      </span>
    );
  }

  // Card R-TAT "ao vivo" — média de dias desde a Data Reconhecimento
  // (abertura do chamado) até hoje, só dos aparelhos parados NESSA etapa
  // agora (ver calcularRTatAoVivo em lib/metricas.ts) — diferente do
  // R-TAT do menu Métricas, que olha um período histórico
  // fechado/escolhido. Só usado nas etapas com número (1 a 8).
  function badgeRTat(aparelhos: { data_reconhecimento: string | null }[]) {
    const { mediaDias, quantidade } = calcularRTatAoVivo(aparelhos.map((a) => a.data_reconhecimento));
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium mb-3 ml-2"
        style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
        title="R-TAT: média de dias desde a Data Reconhecimento (abertura do chamado) até hoje, dos aparelhos parados nessa etapa"
      >
        <Gauge size={12} style={{ color: "var(--accent2)" }} />
        R-TAT <strong>{formatarDias(mediaDias)}</strong>
        {quantidade > 0 && <span style={{ color: "var(--muted)" }}>· {quantidade}</span>}
      </span>
    );
  }

  // Card "Mão de Obra | Peças" do topo de "5 - Ag. Peças", "6 - Ag.
  // Reparo", "OQC - Controle de Qualidade", "7 - Reparo Finalizado" e
  // "8 - Orçamento Reprovado" (ver migrations 0040/0041/0042). Nas 4
  // primeiras é valor já aprovado pela Allied, o que vamos efetivamente
  // receber (ver também o gráfico em Métricas > Previsão de
  // Recebimento, que soma 5/6/7). Em "8 - Orçamento Reprovado" é o
  // valor que foi recusado — variante="reprovado" só troca o texto do
  // tooltip. Soma só os aparelhos PARADOS NESSA etapa agora, igual o
  // R-TAT "ao vivo" acima.
  async function cardPrevisao(statusValor: string, variante: "receber" | "reprovado" = "receber") {
    const { data, error } = await supabase.rpc("previsao_recebimento_resumo", { p_status: statusValor });
    if (error) {
      // não deixa passar em silêncio — sem isso, um erro (ex: a migration
      // 0040 ainda não rodou) virava um enganoso "R$ 0,00" na tela, como
      // se não tivesse nada a receber. Fica registrado no log do servidor
      // (Vercel > Logs) e a pill mostra "—" em vez do valor.
      console.error("previsao_recebimento_resumo:", error.message);
      return <CardValorPrevisao maoDeObra={0} vendaPecas={0} indisponivel />;
    }
    const linha = (data ?? [])[0] as { mao_de_obra: number; venda_pecas: number } | undefined;
    return (
      <CardValorPrevisao
        maoDeObra={Number(linha?.mao_de_obra ?? 0)}
        vendaPecas={Number(linha?.venda_pecas ?? 0)}
        variante={variante}
      />
    );
  }

  // ALLIED (login externo, só consulta) enxerga qualquer etapa, mas
  // sempre com essa mesma tela genérica de só-leitura — nunca os
  // painéis internos com botão de ação/seleção em massa. Os dados vêm
  // da RPC orcamentos_allied_listar (ver lib/allied.ts), que roda como
  // security definer e nunca seleciona nenhuma coluna de custo/BID —
  // proteção de banco, não só de tela (ver migration 0035_cargo_allied.sql).
  if (isAllied(perfil)) {
    const aparelhos = await buscarAparelhosAllied(supabase, status.valor);
    const etapaNumerada = /^\d/.test(status.valor);
    return (
      <AppShell titulo={status.label} perfil={perfil}>
        <div className="flex items-center flex-wrap">
          {voltar}
          {badgeContador(aparelhos.length)}
          {etapaNumerada && badgeRTat(aparelhos)}
        </div>
        <PainelOperacionalAllied aparelhos={aparelhos} mensagemVazia="Nenhum aparelho nessa etapa ainda." />
      </AppShell>
    );
  }

  if (status.slug === "ag-abertura" || status.slug === "1-ag-triagem") {
    const { data: aparelhos } = await supabase
      .from("orcamentos")
      .select(
        "id, os_reparadora, data_reconhecimento, os_care_allied, trade_allied, imei_allied, descricao_completa, modelo_comercial, descricao_defeito_1, descricao_defeito_2, descricao_defeito_3, descricao_defeito_4, descricao_defeito_5, descricao_defeito_6, descricao_defeito_7, descricao_defeito_8, descricao_defeito_9, descricao_defeito_10, peca_defeito_1, peca_defeito_2, peca_defeito_3, peca_defeito_4, peca_defeito_5, peca_defeito_6, peca_defeito_7, peca_defeito_8, peca_defeito_9, peca_defeito_10"
      )
      .eq("status_operacional", status.valor)
      .order(status.slug === "ag-abertura" ? "created_at" : "os_reparadora_definida_em", { ascending: true });

    if (status.slug === "ag-abertura") {
      return (
        <AppShell titulo={status.label} perfil={perfil}>
          <PainelAgAbertura
            aparelhos={(aparelhos ?? []) as AparelhoAgAbertura[]}
            mensagemVazia="Nenhum aparelho aguardando abertura no momento."
            topo={
              <>
                {voltar}
                {badgeContador(aparelhos?.length ?? 0)}
              </>
            }
          />
        </AppShell>
      );
    }

    return (
      <AppShell titulo={status.label} perfil={perfil}>
        <div className="flex items-center flex-wrap">
          {voltar}
          {badgeContador(aparelhos?.length ?? 0)}
          {badgeRTat(aparelhos ?? [])}
        </div>
        <PainelAgTriagem
          aparelhos={(aparelhos ?? []) as AparelhoAgAbertura[]}
          mensagemVazia="Nenhum aparelho em Ag. Triagem no momento."
        />
      </AppShell>
    );
  }

  if (status.slug === "2-ag-analise") {
    const { data: aparelhos } = await supabase
      .from("orcamentos")
      .select(
        `id, os_reparadora, trade_allied, os_care_allied, modelo_comercial, sku, descricao_completa, data_reconhecimento, ${COLUNAS_PECAS}`
      )
      .eq("status_operacional", status.valor)
      .order("updated_at", { ascending: false });

    const listaAparelhos = (aparelhos ?? []) as AparelhoAgAnalise[];

    // Part Numbers referenciados por esses aparelhos — busca o preço "ao
    // vivo" no BID pra cada um (em vez do custo gravado no próprio
    // orçamento), pra saber também quais estão sem cadastro no BID.
    const partNumbersReferenciados = listaAparelhos.flatMap((a) =>
      Array.from({ length: 10 }, (_, i) => a[`peca_${i + 1}` as keyof AparelhoAgAnalise] as string | null)
    );

    const [precosBid, { data: faixasBrutas }, { data: configImposto }] = await Promise.all([
      buscarPrecosBidPorPartNumber(supabase, partNumbersReferenciados),
      supabase.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
      supabase.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
    ]);

    const faixas: FaixaMarkup[] = (faixasBrutas ?? []).map((f) => ({
      valor_min: Number(f.valor_min),
      valor_max: f.valor_max == null ? null : Number(f.valor_max),
      multiplicador: Number(f.multiplicador),
    }));
    const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);

    return (
      <AppShell titulo={status.label} perfil={perfil}>
        <PainelAgAnalise
          aparelhos={listaAparelhos}
          mensagemVazia="Nenhum aparelho em Ag. Análise no momento."
          perfil={perfil}
          precosBidIniciais={precosBid}
          faixas={faixas}
          icmsPercentual={icmsPercentual}
          topo={
            <>
              {voltar}
              {badgeContador(aparelhos?.length ?? 0)}
              {badgeRTat(aparelhos ?? [])}
            </>
          }
        />
      </AppShell>
    );
  }

  if (status.slug === "validacao-orcamentos") {
    const { data: aparelhosBrutos } = await supabase
      .from("orcamentos")
      .select(
        `id, nf_remessa_allied, os_reparadora, trade_allied, os_care_allied, modelo_comercial, sku, descricao_completa, validacao_confirmado_sem_peca, validacao_ajustado_manualmente, validacao_venda_manual, validacao_custo_manual, validacao_imposto_manual, validacao_mao_de_obra_manual, validacao_ajustado_em, ajustadoPor:validacao_ajustado_por (nome, sobrenome), ${COLUNAS_PECAS_VALIDACAO}`
      )
      .eq("status_operacional", status.valor)
      .order("nf_remessa_allied", { ascending: true })
      .order("updated_at", { ascending: false });

    const listaBruta = aparelhosBrutos ?? [];

    // NFs Remessa distintas presentes nessa tela — usadas pra checar se
    // alguma delas ainda tem aparelho parado numa etapa anterior à
    // análise (Ag. Abertura / 1 - Ag. Triagem / 2 - Ag. Análise). Um lote
    // pode chegar em partes, então nem todo aparelho de uma NF entra em
    // Validação junto — "Confirmar Envio" só pode liberar um lote depois
    // que TODO aparelho dele já foi analisado (ver
    // STATUS_ETAPAS_ANTERIORES_A_VALIDACAO em lib/orcamentos.ts).
    const nfsDistintas = Array.from(
      new Set(listaBruta.map((a) => a.nf_remessa_allied).filter((nf): nf is string => !!nf))
    );

    const nfsComPendenciaEtapaAnterior: string[] = [];
    if (nfsDistintas.length > 0) {
      const pendentesSet = new Set<string>();
      const TAMANHO_LOTE_NFS = 400;
      for (let i = 0; i < nfsDistintas.length; i += TAMANHO_LOTE_NFS) {
        const loteNfs = nfsDistintas.slice(i, i + TAMANHO_LOTE_NFS);
        const { data: pendentesBrutos } = await supabase
          .from("orcamentos")
          .select("nf_remessa_allied")
          .in("nf_remessa_allied", loteNfs)
          .in("status_operacional", STATUS_ETAPAS_ANTERIORES_A_VALIDACAO as unknown as string[]);
        for (const linha of pendentesBrutos ?? []) {
          if (linha.nf_remessa_allied) pendentesSet.add(linha.nf_remessa_allied);
        }
      }
      nfsComPendenciaEtapaAnterior.push(...pendentesSet);
    }

    // códigos de peça únicos referenciados (peça normal + peça
    // adicional) por todo mundo nessa etapa, pra buscar o custo mais
    // recente de cada um de uma vez só na Base Peças.
    const codigosUnicos = Array.from(
      new Set(
        listaBruta
          .flatMap((a) => [
            a.peca_1, a.peca_2, a.peca_3, a.peca_4, a.peca_5, a.peca_6, a.peca_7, a.peca_8, a.peca_9, a.peca_10,
            a.peca_add_1, a.peca_add_2, a.peca_add_3, a.peca_add_4, a.peca_add_5,
          ])
          .map((c) => c?.trim())
          .filter((c): c is string => !!c)
      )
    );

    const custosPorCodigo = new Map<string, number>();
    const TAMANHO_LOTE_CODIGOS = 400;
    for (let i = 0; i < codigosUnicos.length; i += TAMANHO_LOTE_CODIGOS) {
      const lote = codigosUnicos.slice(i, i + TAMANHO_LOTE_CODIGOS);
      const { data } = await supabase.from("pecas_vigentes").select("codigo, valor_unitario").in("codigo", lote);
      for (const linha of data ?? []) custosPorCodigo.set(linha.codigo, Number(linha.valor_unitario));
    }

    const [{ data: configImposto }, { data: configMaoObraBruta }, { data: faixasMarkupBrutas }] = await Promise.all([
      supabase.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
      supabase.from("configuracoes_mao_de_obra").select("valor_uma_peca, valor_mais_de_uma_peca").eq("id", 1).single(),
      supabase.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
    ]);
    const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);
    const configMaoDeObra = {
      valor_uma_peca: Number(configMaoObraBruta?.valor_uma_peca ?? 80),
      valor_mais_de_uma_peca: Number(configMaoObraBruta?.valor_mais_de_uma_peca ?? 150),
    };
    // mesma faixa de markup do BID — o imposto (ICMS) da Validação de
    // Orçamentos precisa ser apurado sobre o custo JÁ com essa margem,
    // igual ao cálculo do BID (não sobre o custo cru da Base Peças).
    const faixasMarkup: FaixaMarkup[] = (faixasMarkupBrutas ?? []).map((f) => ({
      valor_min: Number(f.valor_min),
      valor_max: f.valor_max == null ? null : Number(f.valor_max),
      multiplicador: Number(f.multiplicador),
    }));

    const listaAparelhos: AparelhoValidacao[] = listaBruta.map((a) => {
      const detalheAutomatico = calcularDetalheValidacao(
        a as CamposPecasOrcamento,
        custosPorCodigo,
        icmsPercentual,
        configMaoDeObra,
        faixasMarkup
      );
      // se alguém já ajustou manualmente esse orçamento (lápis no
      // pop-up), os 4 totais do resumo vêm congelados do banco em vez de
      // recalculados agora — só a tabela de peças individuais continua
      // sempre automática (ver aplicarAjusteManualValidacao).
      const detalhe = a.validacao_ajustado_manualmente
        ? aplicarAjusteManualValidacao(detalheAutomatico, {
            vendaTotalPecas: Number(a.validacao_venda_manual ?? detalheAutomatico.vendaTotalPecas),
            custoTotalPecas: Number(a.validacao_custo_manual ?? detalheAutomatico.custoTotalPecas),
            impostoTotalPecas: Number(a.validacao_imposto_manual ?? detalheAutomatico.impostoTotalPecas),
            maoDeObra: Number(a.validacao_mao_de_obra_manual ?? detalheAutomatico.maoDeObra),
          })
        : detalheAutomatico;
      return {
        id: a.id,
        nf_remessa_allied: a.nf_remessa_allied,
        os_reparadora: a.os_reparadora,
        trade_allied: a.trade_allied,
        os_care_allied: a.os_care_allied,
        modelo_comercial: a.modelo_comercial,
        sku: a.sku,
        descricao_completa: a.descricao_completa,
        validacaoConfirmadoSemPeca: a.validacao_confirmado_sem_peca,
        ajustadoManualmente: a.validacao_ajustado_manualmente,
        ajustadoEm: a.validacao_ajustado_em,
        ajustadoPor: a.ajustadoPor,
        ...detalhe,
      };
    });

    return (
      <AppShell titulo={status.label} perfil={perfil}>
        <PainelValidacaoOrcamentos
          aparelhos={listaAparelhos}
          perfil={perfil}
          faixas={faixasMarkup}
          icmsPercentual={icmsPercentual}
          nfsComPendenciaEtapaAnterior={nfsComPendenciaEtapaAnterior}
          mensagemVazia="Nenhum aparelho em Validação de Orçamentos no momento."
          topo={voltar}
          pendentesLabel={
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <ContadorAoVivo status={status.valor} contagemInicial={listaBruta.length} /> pendente(s)
            </span>
          }
        />
      </AppShell>
    );
  }

  if (status.slug === "3-ag-resposta-orcamento") {
    const { data: aparelhos } = await supabase
      .from("orcamentos")
      .select(
        "id, os_reparadora, trade_allied, os_care_allied, modelo_comercial, sku, descricao_completa, resultado_aprovacao_allied, data_reconhecimento"
      )
      .eq("status_operacional", status.valor)
      .order("resultado_aprovacao_definido_em", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });

    return (
      <AppShell titulo={status.label} perfil={perfil}>
        <PainelRespostaOrcamento
          aparelhos={(aparelhos ?? []) as AparelhoRespostaOrcamento[]}
          perfil={perfil}
          topo={
            <>
              {voltar}
              {badgeContador(aparelhos?.length ?? 0)}
              {badgeRTat(aparelhos ?? [])}
            </>
          }
          mensagemVazia="Nenhum aparelho em 3 - Ag. Resposta de Orçamento no momento."
        />
      </AppShell>
    );
  }

  if (status.slug === "ag-contra-proposta") {
    const { data: aparelhos } = await supabase
      .from("orcamentos")
      .select(
        "id, nf_remessa_allied, os_reparadora, trade_allied, os_care_allied, modelo_comercial, sku, contra_proposta_pecas, contra_proposta_mao_de_obra, contra_proposta_ajustado"
      )
      .eq("status_operacional", status.valor)
      .order("nf_remessa_allied", { ascending: true })
      .order("updated_at", { ascending: false });

    return (
      <AppShell titulo={status.label} perfil={perfil}>
        <PainelContraProposta
          aparelhos={(aparelhos ?? []) as unknown as AparelhoContraPropostaLista[]}
          perfil={perfil}
          topo={
            <>
              {voltar}
              {badgeContador(aparelhos?.length ?? 0)}
            </>
          }
          mensagemVazia="Nenhum aparelho em Ag. Contra Proposta no momento."
        />
      </AppShell>
    );
  }

  if (status.slug === "4-ag-resposta-reorcamento") {
    const { data: aparelhos } = await supabase
      .from("orcamentos")
      .select(
        "id, os_reparadora, trade_allied, os_care_allied, modelo_comercial, sku, descricao_completa, validacao_snapshot, contra_proposta_pecas, reorcamento_detalhe, reorcamento_motivo, reorcamento_enviado_em, peca_add_1, peca_add_2, peca_add_3, peca_add_4, peca_add_5, custo_peca_add_1, custo_peca_add_2, custo_peca_add_3, custo_peca_add_4, custo_peca_add_5, data_reconhecimento"
      )
      .eq("status_operacional", status.valor)
      .order("updated_at", { ascending: false });

    const listaAparelhos = (aparelhos ?? []) as unknown as AparelhoRespostaReorcamento[];

    // parâmetros de cálculo (markup, ICMS, mão de obra) pro pop-up de
    // detalhe/ajuste do Reorçamento — mesmo padrão de busca já usado em
    // "6 - Ag. Reparo".
    const [{ data: faixasBrutas }, { data: configImposto }, { data: configMaoObraBruta }] = await Promise.all([
      supabase.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
      supabase.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
      supabase.from("configuracoes_mao_de_obra").select("valor_uma_peca, valor_mais_de_uma_peca").eq("id", 1).single(),
    ]);
    const faixasMarkup: FaixaMarkup[] = (faixasBrutas ?? []).map((f) => ({
      valor_min: Number(f.valor_min),
      valor_max: f.valor_max == null ? null : Number(f.valor_max),
      multiplicador: Number(f.multiplicador),
    }));
    const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);
    const configMaoDeObra = {
      valor_uma_peca: Number(configMaoObraBruta?.valor_uma_peca ?? 0),
      valor_mais_de_uma_peca: Number(configMaoObraBruta?.valor_mais_de_uma_peca ?? 0),
    };

    return (
      <AppShell titulo={status.label} perfil={perfil}>
        <PainelRespostaReorcamento
          aparelhos={listaAparelhos}
          perfil={perfil}
          faixasMarkup={faixasMarkup}
          icmsPercentual={icmsPercentual}
          configMaoDeObra={configMaoDeObra}
          topo={
            <>
              {voltar}
              {badgeContador(aparelhos?.length ?? 0)}
              {badgeRTat(aparelhos ?? [])}
            </>
          }
          mensagemVazia="Nenhum aparelho em 4 - Ag. Resposta de Reorçamento no momento."
        />
      </AppShell>
    );
  }

  if (status.slug === "8-orcamento-reprovado") {
    const { data: aparelhos } = await supabase
      .from("orcamentos")
      .select(
        `id, os_reparadora, trade_allied, os_care_allied, modelo_comercial, sku, descricao_completa, motivo_reprova, reprovado_em, data_reconhecimento, usuarios:reprovado_por (nome, sobrenome), ${COLUNAS_PECAS}`
      )
      .eq("status_operacional", status.valor)
      .order("reprovado_em", { ascending: false, nullsFirst: false });

    const listaAparelhos = (aparelhos ?? []) as unknown as AparelhoReprovado[];

    // mesmo esquema de preço "ao vivo" do BID usado em Ag. Análise, pra
    // manter o mesmo formato de pop-up de peças ao clicar numa linha.
    const partNumbersReferenciados = listaAparelhos.flatMap((a) =>
      Array.from({ length: 10 }, (_, i) => a[`peca_${i + 1}` as keyof AparelhoReprovado] as string | null)
    );

    const [precosBid, { data: faixasBrutas }, { data: configImposto }] = await Promise.all([
      buscarPrecosBidPorPartNumber(supabase, partNumbersReferenciados),
      supabase.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
      supabase.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
    ]);

    const faixas: FaixaMarkup[] = (faixasBrutas ?? []).map((f) => ({
      valor_min: Number(f.valor_min),
      valor_max: f.valor_max == null ? null : Number(f.valor_max),
      multiplicador: Number(f.multiplicador),
    }));
    const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);
    const cardPrevisaoEl = await cardPrevisao(status.valor, "reprovado");

    return (
      <AppShell titulo={status.label} perfil={perfil}>
        <PainelOrcamentoReprovado
          aparelhos={listaAparelhos}
          precosBidIniciais={precosBid}
          faixas={faixas}
          icmsPercentual={icmsPercentual}
          mensagemVazia="Nenhum orçamento reprovado no momento."
          topo={
            <>
              {voltar}
              {badgeContador(aparelhos?.length ?? 0)}
              {badgeRTat(aparelhos ?? [])}
              {cardPrevisaoEl}
            </>
          }
        />
      </AppShell>
    );
  }

  if (status.slug === "5-ag-pecas") {
    const { data: aparelhos } = await supabase
      .from("orcamentos")
      .select(
        "id, os_reparadora, trade_allied, os_care_allied, modelo_comercial, sku, descricao_completa, pedido_peca_feito, validacao_snapshot, data_reconhecimento"
      )
      .eq("status_operacional", status.valor)
      .order("pedido_peca_feito", { ascending: true })
      .order("updated_at", { ascending: false });

    const cardPrevisaoEl = await cardPrevisao(status.valor);

    return (
      <AppShell titulo={status.label} perfil={perfil}>
        <PainelAgPecas
          aparelhos={(aparelhos ?? []) as AparelhoAgPecas[]}
          perfil={perfil}
          topo={
            <>
              {voltar}
              {badgeContador(aparelhos?.length ?? 0)}
              {badgeRTat(aparelhos ?? [])}
              {cardPrevisaoEl}
            </>
          }
          mensagemVazia="Nenhum aparelho em 5 - Ag. Peças no momento."
        />
      </AppShell>
    );
  }

  if (status.slug === "6-ag-reparo") {
    const { data: aparelhos } = await supabase
      .from("orcamentos")
      .select(
        "id, os_reparadora, trade_allied, os_care_allied, modelo_comercial, sku, descricao_completa, validacao_snapshot, data_reconhecimento, peca_add_1, peca_add_2, peca_add_3, peca_add_4, peca_add_5, custo_peca_add_1, custo_peca_add_2, custo_peca_add_3, custo_peca_add_4, custo_peca_add_5"
      )
      .eq("status_operacional", status.valor)
      .order("updated_at", { ascending: false });

    const listaAparelhos = (aparelhos ?? []) as AparelhoAgReparo[];

    // histórico de reprovações no OQC de cada aparelho dessa lista — base
    // do destaque preto/amarelo e da tag "OQC FAIL xN" (ver
    // PainelAgReparo.tsx e migration 0037_oqc_avaliacoes.sql).
    const falhasOqc: Record<string, FalhaOqcResumo> = {};
    if (listaAparelhos.length > 0) {
      const { data: falhasBrutas } = await supabase
        .from("oqc_avaliacoes")
        .select("orcamento_id, motivo, avaliado_em")
        .in(
          "orcamento_id",
          listaAparelhos.map((a) => a.id)
        )
        .eq("resultado", "fail")
        .order("avaliado_em", { ascending: false });

      for (const f of falhasBrutas ?? []) {
        if (!falhasOqc[f.orcamento_id]) falhasOqc[f.orcamento_id] = { quantidade: 0, historico: [] };
        falhasOqc[f.orcamento_id].quantidade += 1;
        falhasOqc[f.orcamento_id].historico.push({ motivo: f.motivo, avaliado_em: f.avaliado_em });
      }
    }

    // parâmetros de cálculo (markup, ICMS, mão de obra) pro pop-up de
    // Reorçamento — mesmo padrão de busca já usado em Ag. Análise/Validação.
    const [{ data: faixasBrutas }, { data: configImposto }, { data: configMaoObraBruta }] = await Promise.all([
      supabase.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
      supabase.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
      supabase.from("configuracoes_mao_de_obra").select("valor_uma_peca, valor_mais_de_uma_peca").eq("id", 1).single(),
    ]);
    const faixasMarkup: FaixaMarkup[] = (faixasBrutas ?? []).map((f) => ({
      valor_min: Number(f.valor_min),
      valor_max: f.valor_max == null ? null : Number(f.valor_max),
      multiplicador: Number(f.multiplicador),
    }));
    const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);
    const configMaoDeObra = {
      valor_uma_peca: Number(configMaoObraBruta?.valor_uma_peca ?? 0),
      valor_mais_de_uma_peca: Number(configMaoObraBruta?.valor_mais_de_uma_peca ?? 0),
    };

    const cardPrevisaoEl = await cardPrevisao(status.valor);

    return (
      <AppShell titulo={status.label} perfil={perfil}>
        <PainelAgReparo
          aparelhos={listaAparelhos}
          perfil={perfil}
          falhasOqc={falhasOqc}
          faixasMarkup={faixasMarkup}
          icmsPercentual={icmsPercentual}
          configMaoDeObra={configMaoDeObra}
          topo={
            <>
              {voltar}
              {badgeContador(aparelhos?.length ?? 0)}
              {badgeRTat(aparelhos ?? [])}
              {cardPrevisaoEl}
            </>
          }
          mensagemVazia="Nenhum aparelho em 6 - Ag. Reparo no momento."
        />
      </AppShell>
    );
  }

  if (status.slug === "oqc-controle-qualidade") {
    const { data: aparelhos } = await supabase
      .from("orcamentos")
      .select(
        "id, os_reparadora, trade_allied, os_care_allied, modelo_comercial, sku, descricao_completa, validacao_snapshot, data_reconhecimento"
      )
      .eq("status_operacional", status.valor)
      .order("updated_at", { ascending: false });

    const cardPrevisaoEl = await cardPrevisao(status.valor);

    return (
      <AppShell titulo={status.label} perfil={perfil}>
        <PainelOqc
          aparelhos={(aparelhos ?? []) as AparelhoOqcLista[]}
          perfil={perfil}
          topo={
            <>
              {voltar}
              {badgeContador(aparelhos?.length ?? 0)}
              {cardPrevisaoEl}
            </>
          }
          mensagemVazia="Nenhum aparelho em OQC - Controle de Qualidade no momento."
        />
      </AppShell>
    );
  }

  // etapas ainda sem tela própria (7 e Produto Entregue — "3",
  // "Ag. Contra Proposta", "4", "5", "6" e "OQC - Controle de Qualidade"
  // já ganharam tela própria acima) — só a lista, com o ícone de
  // reprovar em todas menos Produto Entregue (não faz sentido reprovar
  // um orçamento já entregue), clique na linha abrindo o pop-up de
  // atendimento/peças, e o card R-TAT só nas que têm número ("7 - ..." —
  // Produto Entregue não tem número no valor).
  const { data: aparelhos } = await supabase
    .from("orcamentos")
    .select(
      "id, os_reparadora, trade_allied, os_care_allied, modelo_comercial, sku, descricao_completa, validacao_snapshot, data_reconhecimento"
    )
    .eq("status_operacional", status.valor)
    .order("updated_at", { ascending: false });

  const etapaNumerada = /^\d/.test(status.valor);
  const cardPrevisaoEl = status.slug === "7-reparo-finalizado" ? await cardPrevisao(status.valor) : null;

  return (
    <AppShell titulo={status.label} perfil={perfil}>
      <div className="flex items-center flex-wrap">
        {voltar}
        {badgeContador(aparelhos?.length ?? 0)}
        {etapaNumerada && badgeRTat(aparelhos ?? [])}
        {cardPrevisaoEl}
      </div>
      <PainelEtapaSimples
        aparelhos={(aparelhos ?? []) as AparelhoEtapaSimples[]}
        permiteReprovar={status.slug !== "produto-entregue"}
        mensagemVazia="Nenhum aparelho nessa etapa ainda."
      />
      <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
        Essa etapa ainda é só consulta — o fluxo de ação dela entra numa próxima rodada.
      </p>
    </AppShell>
  );
}
