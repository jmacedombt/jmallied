"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, CircleDollarSign, Landmark, Pencil, Plus, Receipt } from "lucide-react";
import GraficoBarrasMensal, { type PontoBarra } from "@/components/GraficoBarrasMensal";
import PopupLancamentoFinanceiro, { type DadosLancamentoFinanceiro } from "@/components/PopupLancamentoFinanceiro";
import PopupReceberValor from "@/components/PopupReceberValor";
import type { LinhaFinanceiro } from "@/lib/financeiro";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataCurta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Tela principal do módulo Financeiro (pedido explícito, com print de
 * referência): KPIs no topo, os 2 gráficos ("Notas Emitidas" e "Valores
 * Recebidos", últimos 12 meses) e a tabela de lançamentos, com o botão
 * "+ Novo lançamento" e as ações de cada linha (editar / mudar status).
 * A grande maioria das linhas chega sozinha (ver salvar-nf/route.ts →
 * registrarLancamentoFinanceiro) — o formulário aqui é o complemento
 * manual + a correção de qualquer campo.
 */
export default function PainelFinanceiro({
  linhas,
  pontosEmitidas,
  pontosRecebidas,
}: {
  linhas: LinhaFinanceiro[];
  pontosEmitidas: PontoBarra[];
  pontosRecebidas: PontoBarra[];
}) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<LinhaFinanceiro | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState<LinhaFinanceiro | null>(null);

  const totalEmitido = linhas.reduce((soma, l) => soma + (l.nfMaoDeObraValor ?? 0) + (l.nfPecasValor ?? 0), 0);
  const totalRecebido = linhas
    .filter((l) => l.status === "Vlr. Recebido")
    .reduce((soma, l) => soma + (l.nfMaoDeObraValor ?? 0) + (l.nfPecasValor ?? 0), 0);
  const totalEmAberto = totalEmitido - totalRecebido;
  const percentualRecebido = totalEmitido > 0 ? (totalRecebido / totalEmitido) * 100 : 0;
  const percentualEmAberto = totalEmitido > 0 ? (totalEmAberto / totalEmitido) * 100 : 0;

  async function salvarNovoLancamento(dados: DadosLancamentoFinanceiro) {
    const res = await fetch("/api/financeiro/notas-fiscais", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? "Não foi possível salvar esse lançamento.");
    setCriando(false);
    router.refresh();
  }

  async function salvarEdicaoLancamento(dados: DadosLancamentoFinanceiro) {
    if (!editando) return;
    const res = await fetch(`/api/financeiro/notas-fiscais/${editando.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? "Não foi possível salvar essa edição.");
    setEditando(null);
    router.refresh();
  }

  async function confirmarRecebimento(dataRecebimento: string) {
    if (!alterandoStatus) return;
    const res = await fetch(`/api/financeiro/notas-fiscais/${alterandoStatus.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Vlr. Recebido", data_recebimento: dataRecebimento }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? "Não foi possível confirmar o recebimento.");
    setAlterandoStatus(null);
    router.refresh();
  }

  async function reverterParaEmAberto() {
    if (!alterandoStatus) return;
    const res = await fetch(`/api/financeiro/notas-fiscais/${alterandoStatus.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Em Aberto" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? "Não foi possível reverter esse lançamento.");
    setAlterandoStatus(null);
    router.refresh();
  }

  return (
    <>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <CardKpi
          icone={Receipt}
          cor="#0d9488"
          rotulo="Valor total de notas emitidas"
          valor={formatarReal(totalEmitido)}
        />
        <CardKpi
          icone={CircleDollarSign}
          cor="#f59e0b"
          rotulo="Valores em aberto"
          valor={formatarReal(totalEmAberto)}
          sublinha={totalEmitido > 0 ? `${percentualEmAberto.toFixed(1)}% do total` : undefined}
        />
        <CardKpi
          icone={CalendarCheck2}
          cor="#16a34a"
          rotulo="Valores recebidos"
          valor={formatarReal(totalRecebido)}
          sublinha={totalEmitido > 0 ? `${percentualRecebido.toFixed(1)}% do total` : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <GraficoBarrasMensal
          titulo="Notas emitidas por mês (Mão de Obra + Peças)"
          pontos={pontosEmitidas}
          cor="#0d9488"
          mensagemVazia="Nenhuma NF emitida nos últimos 12 meses."
        />
        <GraficoBarrasMensal
          titulo="Valores recebidos por mês"
          pontos={pontosRecebidas}
          cor="#16a34a"
          mensagemVazia="Nenhum recebimento confirmado nos últimos 12 meses."
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Lançamentos
        </h2>
        <button
          type="button"
          onClick={() => setCriando(true)}
          className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-4 py-2 transition"
          style={{ background: "var(--accent2)" }}
        >
          <Plus size={15} />
          Novo lançamento
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden overflow-x-auto" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Data emissão</th>
              <th className="px-4 py-2.5 font-medium">NF Mão de Obra</th>
              <th className="px-4 py-2.5 font-medium">NF Peças</th>
              <th className="px-4 py-2.5 font-medium text-right">Total</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Data recebimento</th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const total = (l.nfMaoDeObraValor ?? 0) + (l.nfPecasValor ?? 0);
              const recebido = l.status === "Vlr. Recebido";
              return (
                <tr key={l.id} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {formatarDataCurta(l.dataEmissao)}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {l.nfMaoDeObraNumero ? (
                      <>
                        <span style={{ color: "var(--ink)" }}>{l.nfMaoDeObraNumero}</span>
                        {l.nfMaoDeObraValor != null && <span className="ml-1.5">({formatarReal(l.nfMaoDeObraValor)})</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {l.nfPecasNumero ? (
                      <>
                        <span style={{ color: "var(--ink)" }}>{l.nfPecasNumero}</span>
                        {l.nfPecasValor != null && <span className="ml-1.5">({formatarReal(l.nfPecasValor)})</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--ink)" }}>
                    {formatarReal(total)}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setAlterandoStatus(l)}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition"
                      style={
                        recebido
                          ? { background: "rgba(22, 163, 74, 0.12)", color: "#16a34a" }
                          : { background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }
                      }
                      title="Clique para alterar o status"
                    >
                      <Landmark size={12} />
                      {l.status}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {formatarDataCurta(l.dataRecebimento)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setEditando(l)}
                      title="Editar lançamento"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[var(--accent2)]"
                      style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  Nenhum lançamento ainda — as NFs de Mão de Obra e Peças entram aqui sozinhas ao serem emitidas em Ag.
                  Emissão de Nota Fiscal, ou use "Novo lançamento" pra cadastrar na mão.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {criando && (
        <PopupLancamentoFinanceiro linha={null} onFechar={() => setCriando(false)} onSalvar={salvarNovoLancamento} />
      )}

      {editando && (
        <PopupLancamentoFinanceiro linha={editando} onFechar={() => setEditando(null)} onSalvar={salvarEdicaoLancamento} />
      )}

      {alterandoStatus && (
        <PopupReceberValor
          linha={alterandoStatus}
          onFechar={() => setAlterandoStatus(null)}
          onConfirmarRecebimento={confirmarRecebimento}
          onReverterParaEmAberto={reverterParaEmAberto}
        />
      )}
    </>
  );
}

function CardKpi({
  icone: Icone,
  cor,
  rotulo,
  valor,
  sublinha,
}: {
  icone: typeof Receipt;
  cor: string;
  rotulo: string;
  valor: string;
  sublinha?: string;
}) {
  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icone size={16} style={{ color: cor }} />
        <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          {rotulo}
        </p>
      </div>
      <p className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
        {valor}
      </p>
      {sublinha && (
        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
          {sublinha}
        </p>
      )}
    </div>
  );
}
