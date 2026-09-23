"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Info, Loader2, Send, XCircle } from "lucide-react";
import {
  podeConfirmarAprovacaoOrcamento,
  calcularResumoContraProposta,
  montarPecasContraPropostaIniciais,
  MOTIVO_PADRAO_CONTRA_PROPOSTA_RECUSADA,
  type PecaContraProposta,
  type DetalheValidacaoOrcamento,
} from "@/lib/orcamentos";
import PopupPecasContraProposta from "@/components/PopupPecasContraProposta";
import PopupEnviarContraProposta from "@/components/PopupEnviarContraProposta";
import PopupMotivoReprovaContraProposta from "@/components/PopupMotivoReprovaContraProposta";
import PopupAviso from "@/components/PopupAviso";
import { operacionalRestrito, isAllied } from "@/lib/usuarios";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** % Dif. (pedido explícito): quanto a Allied contra-propôs a menos (ou
 * a mais) em relação ao que foi enviado no orçamento —
 * (Valor recebido − Valor enviado) ÷ Valor enviado × 100. Negativo
 * significa que veio menor do que o enviado (o caso normal de uma
 * contra proposta). null enquanto não tem valor recebido da Allied
 * ainda, ou se o orçamento enviado for zero (não dá pra dividir). */
function percDifDe(a: AparelhoContraPropostaLista): number | null {
  if (a.contra_proposta_valor_recebido_allied == null) return null;
  const enviado = valorEnviadoDe(a);
  if (enviado === 0) return null;
  return ((a.contra_proposta_valor_recebido_allied - enviado) / enviado) * 100;
}

export type AparelhoContraPropostaLista = {
  id: string;
  nf_remessa_allied: string;
  os_reparadora: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  contra_proposta_pecas: PecaContraProposta[] | null;
  contra_proposta_mao_de_obra: number | null;
  contra_proposta_ajustado: boolean;
  /** snapshot congelado em Validação de Orçamentos — usado como
   * fallback pra montar peças/mão de obra "efetivas" enquanto ninguém
   * salvou nenhum ajuste de Contra Proposta ainda (contra_proposta_pecas
   * só é gravado quando alguém confirma uma alteração no pop-up — ver
   * montarPecasContraPropostaIniciais em lib/orcamentos.ts). Sem esse
   * fallback, um aparelho recém-chegado em Ag. Contra Proposta aparecia
   * sem nenhuma peça/custo/imposto ao clicar. Também é a fonte do
   * "Orçamento Enviado" (venda de peças + mão de obra original, o que
   * de fato foi mandado pra Allied).
   */
  validacao_snapshot: DetalheValidacaoOrcamento | null;
  /** valor total (peças + mão de obra) que a Allied contra-propôs,
   * lido da coluna BS do upload de aprovação de orçamentos (pedido
   * explícito) — null enquanto nenhum arquivo com esse valor foi
   * importado ainda. Só referência, ao lado do ajuste manual. */
  contra_proposta_valor_recebido_allied: number | null;
  /** decisão da equipe sobre essa Contra Proposta (migration 0060) — null
   * até alguém clicar Aprovado/Reprovado. Só quando todo aparelho do lote
   * tiver decisão é que "Enviar Contra Proposta" libera. */
  contra_proposta_decisao: "Aprovado" | "Reprovado" | null;
  contra_proposta_motivo_recusa: string | null;
};

/** Valor original enviado à Allied (venda de peças + mão de obra,
 * congelado em Validação de Orçamentos) — referência fixa, nunca muda
 * com o ajuste manual da Contra Proposta. */
function valorEnviadoDe(a: AparelhoContraPropostaLista): number {
  return (a.validacao_snapshot?.vendaTotalPecas ?? 0) + (a.validacao_snapshot?.maoDeObra ?? 0);
}

/** Peças "efetivas" de um aparelho pra Contra Proposta: usa o que já foi
 * salvo (contra_proposta_pecas) quando existir; senão monta a partir do
 * snapshot de Validação de Orçamentos — mesmo custo/imposto/venda
 * original já calculado lá (ver comentário do campo acima). */
function pecasEfetivasDe(a: AparelhoContraPropostaLista): PecaContraProposta[] {
  if (a.contra_proposta_pecas && a.contra_proposta_pecas.length > 0) return a.contra_proposta_pecas;
  return a.validacao_snapshot ? montarPecasContraPropostaIniciais(a.validacao_snapshot) : [];
}

/** Mesma lógica de fallback pra mão de obra — fica null até alguém
 * ajustar e salvar. */
function maoDeObraEfetivaDe(a: AparelhoContraPropostaLista): number {
  return a.contra_proposta_mao_de_obra ?? a.validacao_snapshot?.maoDeObra ?? 0;
}

// "Ag. Contra Proposta" — aparelhos que a Allied respondeu com Contra
// Proposta em "3 - Ag. Resposta de Orçamento". Cada um precisa ser
// aberto e ter o valor de peça/mão de obra ajustado (fica com a flag
// azul depois); só quando TODO aparelho do lote selecionado estiver
// ajustado é que "Enviar Contra Proposta" libera.
export default function PainelContraProposta({
  aparelhos,
  perfil,
  topo,
  solucoesPorPartNumber = {},
  mensagemVazia = "Nenhum aparelho em Ag. Contra Proposta no momento.",
}: {
  aparelhos: AparelhoContraPropostaLista[];
  perfil: { cargo: string; is_master: boolean } | null;
  topo: React.ReactNode;
  /** "Peça Solução" (BID) de cada código — pedido explícito, mostrada no
   * pop-up de peças (ver buscarSolucoesPorPartNumber em lib/bid.ts). */
  solucoesPorPartNumber?: Record<string, string>;
  mensagemVazia?: string;
}) {
  const router = useRouter();
  const [loteSelecionado, setLoteSelecionado] = useState("");
  const [editando, setEditando] = useState<AparelhoContraPropostaLista | null>(null);
  const [mostrarEnvio, setMostrarEnvio] = useState(false);
  // id do aparelho com um "Aprovado" em andamento (spinner no botão da
  // lista) — Reprovado não precisa disso, ele abre o pop-up de motivo
  // (mostrarMotivoDe) e o loading fica dentro daquele componente.
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [mostrarMotivoDe, setMostrarMotivoDe] = useState<AparelhoContraPropostaLista | null>(null);
  const [erroDecisao, setErroDecisao] = useState<string | null>(null);
  const [mostrarAvisoAllied, setMostrarAvisoAllied] = useState(false);

  const podeAjustar = podeConfirmarAprovacaoOrcamento(perfil);
  // Operacional (sem is_master) só tem função em Ag. Abertura — clicar
  // numa linha aqui ainda abre o pop-up (pra poder ver o registro), mas
  // sem poder editar nem confirmar nada.
  const apenasVisualizacao = operacionalRestrito(perfil);
  // Login ALLIED (pedido explícito): não pode ver o detalhe peça a peça
  // dessa etapa — clicar numa linha mostra um aviso em vez de abrir o
  // pop-up de ajuste; a versão final só fica disponível no menu
  // "Contra Propostas" depois que a equipe decidir tudo e enviar.
  const allied = isAllied(perfil);

  async function aprovarDireto(a: AparelhoContraPropostaLista) {
    setDecidindo(a.id);
    setErroDecisao(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${a.id}/decidir-contra-proposta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisao: "Aprovado", pecas: pecasEfetivasDe(a), mao_de_obra: maoDeObraEfetivaDe(a) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroDecisao(data?.error || "Não foi possível aprovar esse aparelho.");
        setDecidindo(null);
        return;
      }
      router.refresh();
    } catch {
      setErroDecisao("Falha de conexão. Tente novamente.");
    }
    setDecidindo(null);
  }

  useEffect(() => {
    if (!editando) return;
    const atualizado = aparelhos.find((a) => a.id === editando.id);
    setEditando(atualizado ?? null);
  }, [aparelhos, editando]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // "Enviar Contra Proposta" só libera quando TODO aparelho do lote já
  // tiver uma decisão (Aprovado ou Reprovado) — antes era "todo mundo
  // ajustado", agora é "todo mundo decidido" (pedido explícito).
  const todosDecididos = filtrados.length > 0 && filtrados.every((a) => a.contra_proposta_decisao != null);

  // resumo agregado do lote selecionado (mão de obra total, peça total,
  // lucro%) — mesma conta usada no pop-up individual, só somando todos.
  const resumoLote = useMemo(() => {
    const todasPecas: PecaContraProposta[] = filtrados.flatMap(pecasEfetivasDe);
    const maoDeObraTotal = filtrados.reduce((soma, a) => soma + maoDeObraEfetivaDe(a), 0);
    return calcularResumoContraProposta(todasPecas, maoDeObraTotal);
  }, [filtrados]);

  return (
    <div className="space-y-4">
      <div className="flex items-center flex-wrap gap-3">{topo}</div>

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

        {!allied && (
          <button
            type="button"
            onClick={() => setMostrarEnvio(true)}
            disabled={!loteSelecionado || !todosDecididos || !podeAjustar}
            title={
              !loteSelecionado
                ? "Selecione um lote específico pra enviar."
                : !todosDecididos
                  ? "Ainda existem aparelhos desse lote sem decisão (Aprovado/Reprovado)."
                  : !podeAjustar
                    ? "Seu cargo não tem permissão pra enviar a Contra Proposta."
                    : undefined
            }
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)" }}
          >
            <Send size={13} />
            Enviar Contra Proposta
          </button>
        )}
      </div>

      {loteSelecionado && !todosDecididos && !allied && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: "#ea580c" }}>
          <Clock size={13} />
          {filtrados.filter((a) => a.contra_proposta_decisao == null).length} aparelho(s) desse lote ainda sem decisão
          — abra cada um e aprove ou reprove antes de enviar.
        </p>
      )}

      {erroDecisao && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{erroDecisao}</p>
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
              <th className="px-4 py-2.5 font-medium text-right">Custo</th>
              <th className="px-4 py-2.5 font-medium text-right">Orçamento Enviado</th>
              <th className="px-4 py-2.5 font-medium text-right">Contra Proposta</th>
              <th className="px-4 py-2.5 font-medium text-right">
                <span
                  className="inline-flex items-center justify-end gap-1 cursor-help"
                  title="Percentual entre o valor enviado no orçamento e o valor recebido na Contra Proposta: (Valor recebido − Valor enviado) ÷ Valor enviado × 100. Negativo significa que a Allied contra-propôs um valor menor do que o enviado."
                >
                  % Dif.
                  <Info size={12} />
                </span>
              </th>
              <th className="px-4 py-2.5 font-medium">Ajuste</th>
              {!allied && <th className="px-4 py-2.5 font-medium text-right">Ação</th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => {
              // "Custo" à direita (pedido explícito) — mesma conta do
              // pop-up (calcularResumoContraProposta), com fallback pro
              // snapshot de Validação enquanto o aparelho ainda não teve
              // nenhum ajuste salvo (ver pecasEfetivasDe). A coluna
              // "Contra Proposta" da lista agora é o valor recebido da
              // Allied (contra_proposta_valor_recebido_allied) — a antiga
              // coluna com o total calculado peça a peça foi removida por
              // ser redundante com ela (pedido explícito).
              const pecas = pecasEfetivasDe(a);
              const maoDeObra = maoDeObraEfetivaDe(a);
              const resumo = calcularResumoContraProposta(pecas, maoDeObra);
              return (
              <tr
                key={a.id}
                onClick={() => (allied ? setMostrarAvisoAllied(true) : setEditando(a))}
                className="border-t cursor-pointer transition hover:brightness-110"
                style={{
                  // decisão (Aprovado/Reprovado) manda mais que o "Ajuste"
                  // laranja — verde/vermelho, mesma opacidade baixa pra
                  // não atropelar o texto claro do tema escuro.
                  borderColor:
                    a.contra_proposta_decisao === "Aprovado"
                      ? "#22c55e"
                      : a.contra_proposta_decisao === "Reprovado"
                        ? "#ef4444"
                        : a.contra_proposta_ajustado
                          ? "#f97316"
                          : "var(--line)",
                  background:
                    a.contra_proposta_decisao === "Aprovado"
                      ? "rgba(34, 197, 94, 0.12)"
                      : a.contra_proposta_decisao === "Reprovado"
                        ? "rgba(239, 68, 68, 0.10)"
                        : a.contra_proposta_ajustado
                          ? "rgba(250, 204, 21, 0.12)"
                          : "var(--surface)",
                }}
                title={allied ? "Clique pra saber mais" : "Clique pra ajustar peça a peça e mão de obra"}
              >
                <td className="px-4 py-2.5 font-mono" style={{ color: "var(--muted)" }}>
                  {a.nf_remessa_allied}
                </td>
                <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                  {a.os_reparadora || "—"}
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
                <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                  {formatarReal(resumo.custoTotalPecas)}
                </td>
                <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                  {formatarReal(valorEnviadoDe(a))}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "#16a34a" }}>
                  {a.contra_proposta_valor_recebido_allied != null
                    ? formatarReal(a.contra_proposta_valor_recebido_allied)
                    : "—"}
                </td>
                <td
                  className="px-4 py-2.5 text-right font-semibold"
                  style={{ color: percDifDe(a) == null ? "var(--muted)" : percDifDe(a)! < 0 ? "#dc2626" : "#16a34a" }}
                >
                  {percDifDe(a) != null ? formatarPercentual(percDifDe(a)!) : "—"}
                </td>
                <td className="px-4 py-2.5">
                  {a.contra_proposta_ajustado ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
                      style={{ color: "#ea580c", background: "rgba(250, 204, 21, 0.18)" }}
                    >
                      <CheckCircle2 size={11} />
                      Ajustado
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
                      style={{ color: "var(--muted)", background: "var(--surface2)" }}
                    >
                      <Clock size={11} />
                      Pendente
                    </span>
                  )}
                </td>
                {!allied && (
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    {podeAjustar ? (
                      a.contra_proposta_decisao ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold"
                          style={{ color: a.contra_proposta_decisao === "Aprovado" ? "#16a34a" : "#ef4444" }}
                        >
                          {a.contra_proposta_decisao === "Aprovado" ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <XCircle size={13} />
                          )}
                          {a.contra_proposta_decisao === "Aprovado" ? "APROVADO" : "REPROVADO"}
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Aprovado"
                            onClick={() => aprovarDireto(a)}
                            disabled={decidindo === a.id}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[#16a34a] disabled:opacity-60"
                            style={{ borderColor: "var(--line)", color: "#16a34a" }}
                          >
                            {decidindo === a.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                          </button>
                          <button
                            type="button"
                            title="Reprovado"
                            onClick={() => setMostrarMotivoDe(a)}
                            disabled={decidindo === a.id}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[#ef4444] disabled:opacity-60"
                            style={{ borderColor: "var(--line)", color: "#ef4444" }}
                          >
                            <XCircle size={15} />
                          </button>
                        </div>
                      )
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                )}
              </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={allied ? 10 : 11} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  {aparelhos.length === 0 ? mensagemVazia : "Nenhum aparelho encontrado nesse lote."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <PopupPecasContraProposta
          aparelho={{
            id: editando.id,
            nf_remessa_allied: editando.nf_remessa_allied,
            os_reparadora: editando.os_reparadora,
            trade_allied: editando.trade_allied,
            pecasIniciais: pecasEfetivasDe(editando),
            maoDeObraInicial: maoDeObraEfetivaDe(editando),
            jaAjustado: editando.contra_proposta_ajustado,
            valorEnviado: valorEnviadoDe(editando),
            valorRecebidoAllied: editando.contra_proposta_valor_recebido_allied,
            decisaoAtual: editando.contra_proposta_decisao,
            motivoRecusaAtual: editando.contra_proposta_motivo_recusa,
          }}
          podeEditar={!apenasVisualizacao}
          solucoesPorPartNumber={solucoesPorPartNumber}
          onAtualizado={() => {
            setEditando(null);
            router.refresh();
          }}
          onFechar={() => setEditando(null)}
        />
      )}

      {mostrarEnvio && loteSelecionado && (
        <PopupEnviarContraProposta
          loteNf={loteSelecionado}
          quantidade={filtrados.length}
          resumo={resumoLote}
          onFechar={() => setMostrarEnvio(false)}
          onEnviado={() => {
            setMostrarEnvio(false);
            setLoteSelecionado("");
            router.refresh();
          }}
        />
      )}

      {mostrarMotivoDe && (
        <PopupMotivoReprovaContraProposta
          aparelhoId={mostrarMotivoDe.id}
          trade={mostrarMotivoDe.trade_allied}
          osReparadora={mostrarMotivoDe.os_reparadora}
          // (pedido explícito) já vem preenchido com a frase padrão —
          // continua editável, só que agora normalmente é só confirmar.
          motivoInicial={MOTIVO_PADRAO_CONTRA_PROPOSTA_RECUSADA}
          onFechar={() => setMostrarMotivoDe(null)}
          onReprovado={() => {
            setMostrarMotivoDe(null);
            router.refresh();
          }}
        />
      )}

      {mostrarAvisoAllied && (
        <PopupAviso
          titulo="Contra Proposta em análise"
          mensagem="A equipe da J.Macedo está revisando as propostas recebidas da Allied. Quando a decisão estiver completa, a versão final fica disponível no menu Contra Propostas."
          onFechar={() => setMostrarAvisoAllied(false)}
        />
      )}
    </div>
  );
}
