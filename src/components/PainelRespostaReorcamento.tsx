"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Clock, Send } from "lucide-react";
import {
  podeConfirmarAprovacaoOrcamento,
  type ConfiguracaoMaoDeObra,
  type DetalheValidacaoOrcamento,
  type PecaContraProposta,
} from "@/lib/orcamentos";
import { podeImportarBid, type FaixaMarkup } from "@/lib/bid";
import PopupReprovarOrcamento, { type AparelhoReprovavel } from "@/components/PopupReprovarOrcamento";
import PopupAtendimentoPecas from "@/components/PopupAtendimentoPecas";
import PopupDetalheReorcamento from "@/components/PopupDetalheReorcamento";
import PopupEnviarReorcamento from "@/components/PopupEnviarReorcamento";
import PopupConfirmar from "@/components/PopupConfirmar";

export type AparelhoRespostaReorcamento = {
  id: string;
  os_reparadora: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  validacao_snapshot: DetalheValidacaoOrcamento | null;
  contra_proposta_pecas: PecaContraProposta[] | null;
  reorcamento_detalhe: DetalheValidacaoOrcamento | null;
  reorcamento_motivo: string | null;
  reorcamento_enviado_em: string | null;
  peca_add_1: string | null;
  peca_add_2: string | null;
  peca_add_3: string | null;
  peca_add_4: string | null;
  peca_add_5: string | null;
  custo_peca_add_1: number | null;
  custo_peca_add_2: number | null;
  custo_peca_add_3: number | null;
  custo_peca_add_4: number | null;
  custo_peca_add_5: number | null;
};

function pendenteDeEnvio(a: AparelhoRespostaReorcamento): boolean {
  return a.reorcamento_detalhe != null && !a.reorcamento_enviado_em;
}

// "4 - Ag. Resposta de Reorçamento" — recebe aparelhos por dois
// caminhos: o Reorçamento pedido pelo técnico em "6 - Ag. Reparo"
// (reorcamento_detalhe preenchido — ainda precisa da planilha
// Complementar ser gerada/enviada pra Allied antes de poder aprovar) e
// a Contra Proposta (já chega aqui com a planilha enviada por lá — o
// Aprovar já fica liberado direto, sem passar pelo botão novo). "Enviar
// planilha Complementar" junta TODOS os pendentes de uma vez, não
// importa o lote.
export default function PainelRespostaReorcamento({
  aparelhos,
  perfil,
  faixasMarkup,
  icmsPercentual,
  configMaoDeObra,
  topo,
  mensagemVazia = "Nenhum aparelho em 4 - Ag. Resposta de Reorçamento no momento.",
}: {
  aparelhos: AparelhoRespostaReorcamento[];
  perfil: { cargo: string; is_master: boolean } | null;
  faixasMarkup: FaixaMarkup[];
  icmsPercentual: number;
  configMaoDeObra: Pick<ConfiguracaoMaoDeObra, "valor_uma_peca" | "valor_mais_de_uma_peca">;
  topo: React.ReactNode;
  mensagemVazia?: string;
}) {
  const router = useRouter();
  const [reprovando, setReprovando] = useState<AparelhoReprovavel | null>(null);
  const [detalheReorcamento, setDetalheReorcamento] = useState<AparelhoRespostaReorcamento | null>(null);
  const [detalheSimples, setDetalheSimples] = useState<AparelhoRespostaReorcamento | null>(null);
  const [mostrarEnvio, setMostrarEnvio] = useState(false);
  const [aprovando, setAprovando] = useState<AparelhoRespostaReorcamento | null>(null);
  const [aprovandoDeVerdade, setAprovandoDeVerdade] = useState(false);
  const [erroAprovar, setErroAprovar] = useState<string | null>(null);

  const podeEnviar = podeConfirmarAprovacaoOrcamento(perfil);
  const podeCadastrarBid = podeImportarBid(perfil);

  const pendentes = useMemo(() => aparelhos.filter(pendenteDeEnvio), [aparelhos]);
  const resumoPendentes = useMemo(
    () =>
      pendentes.reduce(
        (soma, a) => soma + (a.reorcamento_detalhe?.vendaTotalPecas ?? 0) + (a.reorcamento_detalhe?.maoDeObra ?? 0),
        0
      ),
    [pendentes]
  );

  function abrirDetalhe(a: AparelhoRespostaReorcamento) {
    if (a.reorcamento_detalhe) setDetalheReorcamento(a);
    else setDetalheSimples(a);
  }

  async function confirmarAprovar() {
    if (!aprovando) return;
    setAprovandoDeVerdade(true);
    setErroAprovar(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${aprovando.id}/aprovar-reorcamento`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroAprovar(data?.error || "Não foi possível aprovar.");
        setAprovandoDeVerdade(false);
        return;
      }
      setAprovando(null);
      setAprovandoDeVerdade(false);
      router.refresh();
    } catch {
      setErroAprovar("Falha de conexão. Tente novamente.");
      setAprovandoDeVerdade(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center flex-wrap gap-3">{topo}</div>
        <button
          type="button"
          onClick={() => setMostrarEnvio(true)}
          disabled={pendentes.length === 0 || !podeEnviar}
          title={
            pendentes.length === 0
              ? "Nenhum reorçamento pendente de envio no momento."
              : !podeEnviar
                ? "Seu cargo não tem permissão pra enviar a planilha Complementar."
                : undefined
          }
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#f97316" }}
        >
          <Send size={13} />
          Enviar planilha Complementar{pendentes.length > 0 && ` (${pendentes.length})`}
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">OS Reparadora</th>
              <th className="px-4 py-2.5 font-medium">Trade Allied</th>
              <th className="px-4 py-2.5 font-medium">OS Care Allied</th>
              <th className="px-4 py-2.5 font-medium">Modelo comercial</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {aparelhos.map((a) => {
              const pendente = pendenteDeEnvio(a);
              return (
                <tr
                  key={a.id}
                  onClick={() => abrirDetalhe(a)}
                  className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                  style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                  title="Clique pra ver o detalhe"
                >
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    {a.os_reparadora || "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    {a.trade_allied}
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
                  <td className="px-4 py-2.5">
                    {pendente ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
                        style={{ color: "#b45309", background: "rgba(217, 119, 6, 0.12)" }}
                      >
                        <Clock size={11} />
                        Pendente de envio
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
                        style={{ color: "#2563eb", background: "rgba(37, 99, 235, 0.1)" }}
                      >
                        <Clock size={11} />
                        Aguardando aprovação
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      {!pendente && (
                        <button
                          type="button"
                          onClick={() => setAprovando(a)}
                          title="Aprovar orçamento"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[#22c55e]"
                          style={{ borderColor: "var(--line)", color: "#22c55e" }}
                        >
                          <CheckCircle2 size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setReprovando({ id: a.id, trade_allied: a.trade_allied, os_reparadora: a.os_reparadora })}
                        title="Reprovar orçamento"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[#ef4444]"
                        style={{ borderColor: "var(--line)", color: "#ef4444" }}
                      >
                        <Ban size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {aparelhos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  {mensagemVazia}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reprovando && (
        <PopupReprovarOrcamento
          aparelho={reprovando}
          onFechar={() => setReprovando(null)}
          onReprovado={() => {
            setReprovando(null);
            router.refresh();
          }}
        />
      )}

      {detalheSimples && <PopupAtendimentoPecas aparelho={detalheSimples} onFechar={() => setDetalheSimples(null)} />}

      {detalheReorcamento && detalheReorcamento.reorcamento_detalhe && (
        <PopupDetalheReorcamento
          aparelho={{
            id: detalheReorcamento.id,
            trade_allied: detalheReorcamento.trade_allied,
            os_reparadora: detalheReorcamento.os_reparadora,
            os_care_allied: detalheReorcamento.os_care_allied,
            modelo_comercial: detalheReorcamento.modelo_comercial,
            sku: detalheReorcamento.sku,
            descricao_completa: detalheReorcamento.descricao_completa,
            validacao_snapshot: detalheReorcamento.validacao_snapshot,
            reorcamento_detalhe: detalheReorcamento.reorcamento_detalhe,
            reorcamento_motivo: detalheReorcamento.reorcamento_motivo,
            reorcamento_enviado_em: detalheReorcamento.reorcamento_enviado_em,
            pecasAddIniciais: [
              { posicao: "Extra 1", codigo: detalheReorcamento.peca_add_1, custo: detalheReorcamento.custo_peca_add_1 },
              { posicao: "Extra 2", codigo: detalheReorcamento.peca_add_2, custo: detalheReorcamento.custo_peca_add_2 },
              { posicao: "Extra 3", codigo: detalheReorcamento.peca_add_3, custo: detalheReorcamento.custo_peca_add_3 },
              { posicao: "Extra 4", codigo: detalheReorcamento.peca_add_4, custo: detalheReorcamento.custo_peca_add_4 },
              { posicao: "Extra 5", codigo: detalheReorcamento.peca_add_5, custo: detalheReorcamento.custo_peca_add_5 },
            ],
          }}
          faixasMarkup={faixasMarkup}
          icmsPercentual={icmsPercentual}
          configMaoDeObra={configMaoDeObra}
          podeCadastrarBid={podeCadastrarBid}
          onFechar={() => setDetalheReorcamento(null)}
          onAtualizado={() => {
            setDetalheReorcamento(null);
            router.refresh();
          }}
        />
      )}

      {mostrarEnvio && (
        <PopupEnviarReorcamento
          quantidade={pendentes.length}
          valorTotal={resumoPendentes}
          onFechar={() => setMostrarEnvio(false)}
          onEnviado={() => {
            setMostrarEnvio(false);
            router.refresh();
          }}
        />
      )}

      {aprovando && (
        <PopupConfirmar
          titulo="Aprovar orçamento"
          mensagem={
            <>
              {aprovando.trade_allied} vai avançar pra <strong>5 - Ag. Peças</strong>. Confirma a aprovação?
            </>
          }
          rotuloConfirmar="Aprovar"
          carregando={aprovandoDeVerdade}
          erro={erroAprovar}
          onConfirmar={confirmarAprovar}
          onFechar={() => {
            if (aprovandoDeVerdade) return;
            setAprovando(null);
            setErroAprovar(null);
          }}
        />
      )}
    </div>
  );
}
