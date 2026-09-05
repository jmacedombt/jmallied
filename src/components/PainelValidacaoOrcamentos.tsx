"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgePercent,
  Coins,
  Gauge,
  LayoutList,
  PackageCheck,
  Percent,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";
import { podeImportarBasePecas } from "@/lib/pecas";
import { type FaixaMarkup } from "@/lib/bid";
import PopupPecasValidacao, { type AparelhoValidacaoDetalhe } from "@/components/PopupPecasValidacao";
import PopupRevisaoValidacao, { type ResumoValidacao } from "@/components/PopupRevisaoValidacao";
import CelulaLucroPercentual, { corPercentualLucro } from "@/components/CelulaLucroPercentual";
import PopupDetalheCard, { type BaseCalculoResumo, type LinhaDetalheCard } from "@/components/PopupDetalheCard";

export type AparelhoValidacao = AparelhoValidacaoDetalhe & {
  id: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
};

type CardKey =
  | "pendentes"
  | "quantidadePecas"
  | "custoTotalPecas"
  | "impostoTotalPecas"
  | "vendaTotalPecas"
  | "lucroTotal"
  | "percLucroPecas"
  | "percLucroTotal";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// mesma conta de agregação usada pelos cards (soma tudo, recalcula os
// percentuais sobre os totais agregados — nunca é a média dos
// percentuais de cada aparelho) — reaproveitada tanto pro total exibido
// quanto pra quebra por lote de cada card.
function calcularResumoDeLista(lista: AparelhoValidacao[]): ResumoValidacao {
  const base = lista.reduce(
    (acc, a) => ({
      quantidadePecas: acc.quantidadePecas + a.quantidadePecas,
      custoTotalPecas: acc.custoTotalPecas + a.custoTotalPecas,
      impostoTotalPecas: acc.impostoTotalPecas + a.impostoTotalPecas,
      vendaTotalPecas: acc.vendaTotalPecas + a.vendaTotalPecas,
      maoDeObraTotal: acc.maoDeObraTotal + a.maoDeObra,
    }),
    { quantidadePecas: 0, custoTotalPecas: 0, impostoTotalPecas: 0, vendaTotalPecas: 0, maoDeObraTotal: 0 }
  );
  const lucroTotal = base.maoDeObraTotal + base.vendaTotalPecas - base.custoTotalPecas - base.impostoTotalPecas;
  const percLucroPecas = base.vendaTotalPecas > 0 ? ((base.vendaTotalPecas - base.custoTotalPecas) / base.vendaTotalPecas) * 100 : 0;
  const baseLucroTotal = base.vendaTotalPecas + base.maoDeObraTotal;
  const percLucroTotal = baseLucroTotal > 0 ? ((baseLucroTotal - base.custoTotalPecas) / baseLucroTotal) * 100 : 0;
  return {
    quantidadeOrcamentos: lista.length,
    quantidadePecas: base.quantidadePecas,
    custoTotalPecas: base.custoTotalPecas,
    impostoTotalPecas: base.impostoTotalPecas,
    maoDeObraTotal: base.maoDeObraTotal,
    vendaTotalPecas: base.vendaTotalPecas,
    lucroTotal,
    percLucroPecas,
    percLucroTotal,
  };
}

// Faixa fininha com degradê no topo de cada card — só um detalhe visual
// pedido pelo Rafael pra deixar os cards mais "vivos".
function FaixaDegrade() {
  return <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent2))" }} />;
}

function CardStat({
  icone: Icone,
  label,
  valor,
  cor,
  onClick,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icone: React.ComponentType<any>;
  label: string;
  valor: React.ReactNode;
  cor?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-lg border overflow-hidden transition hover:brightness-110 cursor-pointer"
      style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
      title="Clique pra ver o detalhe desse dado"
    >
      <FaixaDegrade />
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Icone size={14} style={{ color: cor ?? "var(--accent2)" }} />
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            {label}
          </span>
          <span className="text-xs font-semibold" style={{ color: cor ?? "var(--ink)" }}>
            {valor}
          </span>
        </span>
      </div>
    </button>
  );
}

export default function PainelValidacaoOrcamentos({
  aparelhos,
  perfil,
  faixas,
  icmsPercentual,
  pendentesLabel,
  topo,
  mensagemVazia = "Nenhum aparelho em Validação de Orçamentos no momento.",
}: {
  aparelhos: AparelhoValidacao[];
  perfil: { cargo: string; is_master: boolean } | null;
  /** faixas de markup do BID e o ICMS% configurado — usados só pra
   * montar o balão de cálculo completo (mesmo formato do BID) ao passar
   * o mouse na Venda de Peças, dentro do pop-up de peças. */
  faixas: FaixaMarkup[];
  icmsPercentual: number;
  /** conteúdo já pronto do balão de pendências dessa etapa (contador ao
   * vivo), pra entrar como o primeiro card da linha — mesmo componente
   * usado nas outras telas de Operacional, só estilizado igual aos
   * outros cards aqui. */
  pendentesLabel: React.ReactNode;
  topo: React.ReactNode;
  mensagemVazia?: string;
}) {
  const router = useRouter();
  const [loteSelecionado, setLoteSelecionado] = useState("");
  const [detalhe, setDetalhe] = useState<AparelhoValidacao | null>(null);
  const [popupRevisao, setPopupRevisao] = useState<"revisao" | "confirmar" | null>(null);
  const [cardAberto, setCardAberto] = useState<CardKey | null>(null);

  const podeCadastrarPeca = podeImportarBasePecas(perfil);
  const podeConfirmarLote = podeConfirmarAnaliseEmLote(perfil);

  // se o pop-up de um aparelho estiver aberto e a lista atualizar (depois
  // de cadastrar peça, confirmar sem peça, ou o lote avançar), re-aponta
  // pro objeto novo — senão o pop-up ficaria travado nos dados antigos.
  useEffect(() => {
    if (!detalhe) return;
    const atualizado = aparelhos.find((a) => a.id === detalhe.id);
    setDetalhe(atualizado ?? null);
  }, [aparelhos, detalhe?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // lotes (NF Remessa) disponíveis nessa etapa — sempre com base em
  // TODOS os aparelhos, não só nos já filtrados, pra caixa de seleção
  // nunca "sumir" com opções conforme o usuário troca de lote.
  const lotes = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const a of aparelhos) mapa.set(a.nf_remessa_allied, (mapa.get(a.nf_remessa_allied) ?? 0) + 1);
    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([nf, quantidade]) => ({ nf, quantidade }));
  }, [aparelhos]);

  const filtrados = useMemo(() => {
    if (!loteSelecionado) return aparelhos;
    return aparelhos.filter((a) => a.nf_remessa_allied === loteSelecionado);
  }, [aparelhos, loteSelecionado]);

  // cards sempre somam o que está sendo exibido na tabela agora — todos
  // os lotes juntos quando nenhum está selecionado, ou só o escolhido.
  const resumo = useMemo(() => calcularResumoDeLista(filtrados), [filtrados]);

  // a mesma conta, mas quebrada por lote — usada só pro "resumo
  // relacionado ao card" quando o usuário clica num card pra entender
  // como o total ali se formou.
  const resumosPorLote = useMemo(
    () => lotes.map((l) => ({ nf: l.nf, resumo: calcularResumoDeLista(aparelhos.filter((a) => a.nf_remessa_allied === l.nf)) })),
    [lotes, aparelhos]
  );

  // travas do lote selecionado — mesma checagem que o servidor faz de
  // novo antes de confirmar (aqui é só pra já avisar e desabilitar o
  // botão, evitando uma ida e volta desnecessária ao servidor).
  const loteTemPecaSemCusto = filtrados.some((a) => a.temPecaSemCusto);
  const loteTemPendenteConfirmacao = filtrados.some((a) => a.quantidadePecas === 0 && !a.validacaoConfirmadoSemPeca);
  const podeConfirmarEnvio = !!loteSelecionado && !loteTemPecaSemCusto && !loteTemPendenteConfirmacao && podeConfirmarLote;

  async function confirmarEnvioLote() {
    const res = await fetch("/api/operacional/orcamentos/avancar-validacao-em-massa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nf_remessa_allied: loteSelecionado }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || "Não foi possível confirmar o envio.");
    }
    setPopupRevisao(null);
    setLoteSelecionado("");
    router.refresh();
  }

  // config de cada card: ícone/rótulo, valor atual (a partir de
  // `resumo`), cor, fórmula (só nos calculados) e como ler aquele mesmo
  // dado dentro de um ResumoValidacao — usado tanto pra renderizar o
  // card quanto pra montar o pop-up de detalhe (quebra por lote).
  const CARDS: {
    key: CardKey;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icone: React.ComponentType<any>;
    label: string;
    formula?: string;
    cor?: string;
    formatar: (r: ResumoValidacao) => string;
  }[] = [
    { key: "quantidadePecas", icone: LayoutList, label: "Quantidade de Peças", formatar: (r) => String(r.quantidadePecas) },
    { key: "custoTotalPecas", icone: Coins, label: "Total de Custo de Peças", formatar: (r) => formatarReal(r.custoTotalPecas) },
    { key: "impostoTotalPecas", icone: Percent, label: "Total de Imposto (ICMS)", formatar: (r) => formatarReal(r.impostoTotalPecas) },
    { key: "vendaTotalPecas", icone: Wallet, label: "Valor Venda de Peças", formatar: (r) => formatarReal(r.vendaTotalPecas) },
    {
      key: "lucroTotal",
      icone: TrendingUp,
      label: "Lucro Total (R$)",
      formula: "Mão de obra + Venda de Peças − Custo das Peças − Imposto",
      cor: resumo.lucroTotal >= 0 ? "#22c55e" : "#ef4444",
      formatar: (r) => formatarReal(r.lucroTotal),
    },
    {
      key: "percLucroPecas",
      icone: BadgePercent,
      label: "% Lucro Peças",
      formula: "(Venda − Custo) ÷ Venda",
      cor: corPercentualLucro(resumo.percLucroPecas),
      formatar: (r) => formatarPercentual(r.percLucroPecas),
    },
    {
      key: "percLucroTotal",
      icone: Gauge,
      label: "% Lucro Total",
      formula: "((Venda + Mão de obra) − Custo) ÷ (Venda + Mão de obra)",
      cor: corPercentualLucro(resumo.percLucroTotal),
      formatar: (r) => formatarPercentual(r.percLucroTotal),
    },
  ];

  // esses 3 cards são os únicos cuja conta depende da Mão de obra — que
  // não tem card próprio na linha de cima (decidido pra não competir por
  // espaço); em vez disso ela aparece como contexto dentro do pop-up
  // desses cards, junto com Custo/Imposto/Venda.
  const CARDS_COM_BASE: CardKey[] = ["lucroTotal", "percLucroPecas", "percLucroTotal"];

  const cardDetalhe = cardAberto ? CARDS.find((c) => c.key === cardAberto) : undefined;
  const baseCalculoCard: BaseCalculoResumo | undefined =
    cardAberto && CARDS_COM_BASE.includes(cardAberto)
      ? {
          custoTotalPecas: resumo.custoTotalPecas,
          impostoTotalPecas: resumo.impostoTotalPecas,
          vendaTotalPecas: resumo.vendaTotalPecas,
          maoDeObra: resumo.maoDeObraTotal,
        }
      : undefined;
  const linhasDetalheCard: LinhaDetalheCard[] =
    cardAberto === "pendentes"
      ? lotes.map((l) => ({ rotulo: l.nf, valor: String(l.quantidade) }))
      : cardDetalhe
        ? resumosPorLote.map((rl) => ({ rotulo: rl.nf, valor: cardDetalhe.formatar(rl.resumo) }))
        : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center flex-wrap gap-2 [&>a]:!mb-0">
        {topo}
        <CardStat icone={Gauge} label="Nessa etapa" valor={pendentesLabel} onClick={() => setCardAberto("pendentes")} />
        {CARDS.map((c) => (
          <CardStat
            key={c.key}
            icone={c.icone}
            label={c.label}
            valor={c.formatar(resumo)}
            cor={c.cor}
            onClick={() => setCardAberto(c.key)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: "var(--muted)" }}>
            Lote (NF Remessa):
          </label>
          <select
            value={loteSelecionado}
            onChange={(e) => setLoteSelecionado(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition"
            style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
          >
            <option value="">Todos os lotes ({aparelhos.length})</option>
            {lotes.map((l) => (
              <option key={l.nf} value={l.nf}>
                {l.nf} ({l.quantidade})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPopupRevisao("revisao")}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--ink)", border: "1px solid var(--line)" }}
          >
            <AlertTriangle size={13} style={{ color: "var(--accent2)" }} />
            Revisão
          </button>
          <button
            type="button"
            onClick={() => setPopupRevisao("confirmar")}
            disabled={!podeConfirmarEnvio}
            title={
              !loteSelecionado
                ? "Selecione um lote específico pra confirmar o envio."
                : loteTemPecaSemCusto
                  ? "Existem peças sem custo na Base Peças nesse lote (Prioridade)."
                  : loteTemPendenteConfirmacao
                    ? "Existem aparelhos sem peça que ainda não foram confirmados."
                    : !podeConfirmarLote
                      ? "Seu cargo não tem permissão pra confirmar o envio de um lote."
                      : undefined
            }
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)" }}
          >
            <PackageCheck size={13} />
            Confirmar Envio
          </button>
        </div>
      </div>

      {loteSelecionado && (loteTemPecaSemCusto || loteTemPendenteConfirmacao) && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: "#ef4444" }}>
          <AlertTriangle size={13} />
          {loteTemPecaSemCusto
            ? "Esse lote tem peça(s) sem custo na Base Peças (destaque vermelho / Prioridade) — cadastre antes de confirmar o envio."
            : "Esse lote tem aparelho(s) sem peça que ainda não foram confirmados (destaque amarelo) — abra e confirme antes de enviar."}
        </p>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">NF Remessa</th>
              <th className="px-4 py-2.5 font-medium">OS Reparadora</th>
              <th className="px-4 py-2.5 font-medium">OS Care Allied</th>
              <th className="px-4 py-2.5 font-medium">Modelo comercial</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium">Descrição</th>
              <th className="px-4 py-2.5 font-medium text-right">Lucro Total %</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => {
              const prioridade = a.temPecaSemCusto;
              const semPecaPendente = a.quantidadePecas === 0 && !a.validacaoConfirmadoSemPeca;
              return (
                <tr
                  key={a.id}
                  onClick={() => setDetalhe(a)}
                  className="border-t cursor-pointer transition hover:brightness-110"
                  style={{
                    borderColor: prioridade ? "#ef4444" : semPecaPendente ? "#ca8a04" : "var(--line)",
                    background: prioridade
                      ? "rgba(239, 68, 68, 0.1)"
                      : semPecaPendente
                        ? "rgba(250, 240, 137, 0.12)"
                        : "var(--surface)",
                  }}
                  title="Clique pra ver mão de obra e peças desse orçamento"
                >
                  <td className="px-4 py-2.5 font-mono" style={{ color: "var(--muted)" }}>
                    {a.nf_remessa_allied}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      {a.os_reparadora || "—"}
                      {prioridade && (
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ color: "#ef4444", background: "rgba(239, 68, 68, 0.15)" }}
                        >
                          <AlertTriangle size={10} />
                          PRIORIDADE
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {a.os_care_allied}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {a.modelo_comercial}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {a.sku}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }} title={a.descricao_completa ?? ""}>
                    {(a.descricao_completa ?? "").split(" ")[0]}
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <CelulaLucroPercentual
                      base={{
                        custoTotalPecas: a.custoTotalPecas,
                        impostoTotalPecas: a.impostoTotalPecas,
                        vendaTotalPecas: a.vendaTotalPecas,
                        maoDeObra: a.maoDeObra,
                        lucroTotal: a.lucroTotal,
                        percLucroPecas: a.percLucroPecas,
                        percLucroTotal: a.percLucroTotal,
                      }}
                    />
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  {aparelhos.length === 0 ? mensagemVazia : "Nenhum aparelho encontrado nesse lote."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs flex items-center gap-3 flex-wrap" style={{ color: "var(--muted)" }}>
        <span>Clique numa linha pra ver a mão de obra e os códigos de peça desse orçamento.</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(239, 68, 68, 0.3)", border: "1px solid #ef4444" }} />
          Prioridade (peça sem custo)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(250, 240, 137, 0.4)", border: "1px solid #ca8a04" }} />
          Sem peça lançada (aguardando confirmação)
        </span>
      </p>

      {detalhe && (
        <PopupPecasValidacao
          aparelho={detalhe}
          faixas={faixas}
          icmsPercentual={icmsPercentual}
          podeCadastrarPeca={podeCadastrarPeca}
          podeConfirmarSemPeca={podeConfirmarLote}
          onAtualizado={() => router.refresh()}
          onFechar={() => setDetalhe(null)}
        />
      )}

      {popupRevisao && (
        <PopupRevisaoValidacao
          modo={popupRevisao}
          loteNf={loteSelecionado || undefined}
          resumo={resumo}
          onFechar={() => setPopupRevisao(null)}
          onConfirmar={popupRevisao === "confirmar" ? confirmarEnvioLote : undefined}
        />
      )}

      {cardAberto && (
        <PopupDetalheCard
          icone={cardAberto === "pendentes" ? Gauge : cardDetalhe!.icone}
          label={cardAberto === "pendentes" ? "Nessa etapa" : cardDetalhe!.label}
          valorAtual={cardAberto === "pendentes" ? String(aparelhos.length) : cardDetalhe!.formatar(resumo)}
          corValor={cardAberto === "pendentes" ? undefined : cardDetalhe!.cor}
          formula={cardAberto === "pendentes" ? undefined : cardDetalhe!.formula}
          baseCalculo={baseCalculoCard}
          linhas={linhasDetalheCard}
          onFechar={() => setCardAberto(null)}
        />
      )}
    </div>
  );
}
