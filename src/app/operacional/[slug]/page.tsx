import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { statusPorSlug, calcularDetalheValidacao, type CamposPecasOrcamento } from "@/lib/orcamentos";
import { type AparelhoAgAbertura } from "@/components/TabelaAgAbertura";
import PainelAgAbertura from "@/components/PainelAgAbertura";
import PainelAgTriagem from "@/components/PainelAgTriagem";
import PainelAgAnalise, { type AparelhoAgAnalise } from "@/components/PainelAgAnalise";
import PainelValidacaoOrcamentos, { type AparelhoValidacao } from "@/components/PainelValidacaoOrcamentos";
import ContadorAoVivo from "@/components/ContadorAoVivo";
import { buscarPrecosBidPorPartNumber, type FaixaMarkup } from "@/lib/bid";

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
        `id, os_reparadora, trade_allied, os_care_allied, modelo_comercial, sku, descricao_completa, ${COLUNAS_PECAS}`
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
        `id, nf_remessa_allied, os_reparadora, trade_allied, os_care_allied, modelo_comercial, sku, descricao_completa, validacao_confirmado_sem_peca, ${COLUNAS_PECAS_VALIDACAO}`
      )
      .eq("status_operacional", status.valor)
      .order("nf_remessa_allied", { ascending: true })
      .order("updated_at", { ascending: false });

    const listaBruta = aparelhosBrutos ?? [];

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
      const detalhe = calcularDetalheValidacao(
        a as CamposPecasOrcamento,
        custosPorCodigo,
        icmsPercentual,
        configMaoDeObra,
        faixasMarkup
      );
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
        ...detalhe,
      };
    });

    return (
      <AppShell titulo={status.label} perfil={perfil}>
        <PainelValidacaoOrcamentos
          aparelhos={listaAparelhos}
          perfil={perfil}
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

  const { data: aparelhos } = await supabase
    .from("orcamentos")
    .select("id, trade_allied, os_care_allied, modelo_comercial, sku, descricao_completa")
    .eq("status_operacional", status.valor)
    .order("updated_at", { ascending: false });

  return (
    <AppShell titulo={status.label} perfil={perfil}>
      <div className="flex items-center flex-wrap">
        {voltar}
        {badgeContador(aparelhos?.length ?? 0)}
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">Trade Allied</th>
              <th className="px-4 py-2.5 font-medium">OS Care Allied</th>
              <th className="px-4 py-2.5 font-medium">Modelo comercial</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {(aparelhos ?? []).map((a) => (
              <tr key={a.id} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>{a.trade_allied}</td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>{a.os_care_allied}</td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>{a.modelo_comercial}</td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>{a.sku}</td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }} title={a.descricao_completa ?? ""}>
                  {(a.descricao_completa ?? "").split(" ")[0]}
                </td>
              </tr>
            ))}
            {(!aparelhos || aparelhos.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  Nenhum aparelho nessa etapa ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
        Essa etapa ainda é só consulta — o fluxo de ação dela entra numa próxima rodada.
      </p>
    </AppShell>
  );
}
