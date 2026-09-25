"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Package,
  Pencil,
  Search,
  X,
} from "lucide-react";
import PopupConfirmar from "@/components/PopupConfirmar";
import { formatarReal } from "@/lib/metricas";
import { osReparadoraValida } from "@/lib/orcamentos";

type ResultadoBusca = {
  id: string;
  trade_allied: string;
  os_care_allied: string | null;
  os_reparadora: string | null;
  modelo_comercial: string | null;
  status_operacional: string | null;
};

type FichaOrcamento = {
  id: string;
  nf_remessa_allied: string | null;
  os_reparadora: string | null;
  imei_reparadora: string | null;
  atendimento: string | null;
  os_care_allied: string | null;
  trade_allied: string;
  imei_allied: string | null;
  classificacao_allied: string | null;
  sku: string | null;
  descricao_completa: string | null;
  modelo_comercial: string | null;
  status_operacional: string | null;
  observacao_tecnica_reparadora: string | null;
  motivo_reprova: string | null;
  mao_de_obra: number | null;
  valor_total_peca?: number | null;
  valor_total_reparo?: number | null;
} & { [chave: string]: string | number | null | undefined };

const POSICOES_PECA = Array.from({ length: 10 }, (_, i) => i + 1);
const POSICOES_ADD = Array.from({ length: 5 }, (_, i) => i + 1);

function campo(rotulo: string, valor: React.ReactNode) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {rotulo}
      </p>
      <p className="text-sm" style={{ color: "var(--ink)" }}>
        {valor || valor === 0 ? valor : "—"}
      </p>
    </div>
  );
}

/** Peças + custo (quando não é ALLIED) lançadas na ficha — linhas
 * "normais" (1..10) e depois as "Add" (descobertas no reparo), só as
 * posições preenchidas. */
function pecasDaFicha(ficha: FichaOrcamento): { posicao: string; codigo: string; custo: number | null }[] {
  const linhas: { posicao: string; codigo: string; custo: number | null }[] = [];
  for (const n of POSICOES_PECA) {
    const codigo = ficha[`peca_${n}`] as string | null;
    if (codigo) linhas.push({ posicao: `Peça ${n}`, codigo, custo: (ficha[`custo_peca_${n}`] as number | null) ?? null });
  }
  for (const n of POSICOES_ADD) {
    const codigo = ficha[`peca_add_${n}`] as string | null;
    if (codigo)
      linhas.push({ posicao: `Peça Add ${n}`, codigo, custo: (ficha[`custo_peca_add_${n}`] as number | null) ?? null });
  }
  return linhas;
}

// "Consulta/Alteração" (pedido explícito, 25/09/2026, migration 0070) —
// busca um orçamento (OS Reparadora | OS Care | Trade Allied, um campo
// só) e mostra a ficha completa. Só quem pode (podeAlterar, ver
// podeConfirmarAnaliseEmLote) consegue corrigir a OS Reparadora — único
// campo editável. ALLIED (souAllied) nunca vê custo nenhum.
export default function PainelConsultaAlteracao({
  podeAlterar,
  souAllied,
}: {
  podeAlterar: boolean;
  souAllied: boolean;
}) {
  const [termo, setTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null);

  const [ficha, setFicha] = useState<FichaOrcamento | null>(null);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const [erroFicha, setErroFicha] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [novaOsReparadora, setNovaOsReparadora] = useState("");
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function abrirFicha(id: string) {
    setCarregandoFicha(true);
    setErroFicha(null);
    setSucesso(null);
    setEditando(false);
    try {
      const res = await fetch(`/api/operacional/consulta-orcamento/${id}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroFicha(data?.error || "Não foi possível abrir esse orçamento.");
        setFicha(null);
      } else {
        setFicha(data.orcamento);
      }
    } catch {
      setErroFicha("Falha de conexão. Tente novamente.");
      setFicha(null);
    }
    setCarregandoFicha(false);
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const termoLimpo = termo.trim();
    if (termoLimpo.length < 2) {
      setErroBusca("Digite ao menos 2 caracteres pra buscar.");
      return;
    }
    setBuscando(true);
    setErroBusca(null);
    setResultados(null);
    setFicha(null);
    try {
      const res = await fetch(`/api/operacional/consulta-orcamento?busca=${encodeURIComponent(termoLimpo)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroBusca(data?.error || "Não foi possível buscar.");
      } else {
        const lista: ResultadoBusca[] = data.resultados ?? [];
        setResultados(lista);
        if (lista.length === 1) abrirFicha(lista[0].id);
      }
    } catch {
      setErroBusca("Falha de conexão. Tente novamente.");
    }
    setBuscando(false);
  }

  function iniciarEdicao() {
    if (!ficha) return;
    setNovaOsReparadora(ficha.os_reparadora ?? "");
    setErroCampo(null);
    setEditando(true);
  }

  function pedirConfirmacao() {
    const valor = novaOsReparadora.trim();
    if (!osReparadoraValida(valor)) {
      setErroCampo("A OS Reparadora deve ter exatamente 10 números.");
      return;
    }
    setErroCampo(null);
    setConfirmando(true);
  }

  async function salvarOsReparadora() {
    if (!ficha) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      const res = await fetch(`/api/operacional/consulta-orcamento/${ficha.id}/os-reparadora`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ os_reparadora: novaOsReparadora.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroSalvar(data?.error || "Não foi possível salvar a alteração.");
        setSalvando(false);
        return;
      }
      setFicha((atual) => (atual ? { ...atual, os_reparadora: data.os_reparadora } : atual));
      setResultados((atual) =>
        atual ? atual.map((r) => (r.id === ficha.id ? { ...r, os_reparadora: data.os_reparadora } : r)) : atual
      );
      setConfirmando(false);
      setEditando(false);
      setSalvando(false);
      setSucesso("OS Reparadora atualizada.");
    } catch {
      setErroSalvar("Falha de conexão. Tente novamente.");
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={buscar} className="flex items-center gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--muted)" }}
          />
          <input
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="OS Reparadora, OS Care ou Trade Allied"
            className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
          />
        </div>
        <button
          type="submit"
          disabled={buscando}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar
        </button>
      </form>

      {erroBusca && (
        <p className="text-sm text-red-400 flex items-center gap-1.5">
          <AlertTriangle size={13} />
          {erroBusca}
        </p>
      )}

      {resultados && resultados.length === 0 && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Nenhum orçamento encontrado com esse termo.
        </p>
      )}

      {resultados && resultados.length > 1 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-4 py-2.5 font-medium">Trade Allied</th>
                <th className="px-4 py-2.5 font-medium">OS Care</th>
                <th className="px-4 py-2.5 font-medium">OS Reparadora</th>
                <th className="px-4 py-2.5 font-medium">Modelo comercial</th>
                <th className="px-4 py-2.5 font-medium">Etapa</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => abrirFicha(r.id)}
                  className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                  style={{ borderColor: "var(--line)" }}
                >
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    {r.trade_allied}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {r.os_care_allied || "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {r.os_reparadora || "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {r.modelo_comercial || "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {r.status_operacional || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {carregandoFicha && (
        <div className="flex items-center gap-2 text-sm py-6" style={{ color: "var(--muted)" }}>
          <Loader2 size={14} className="animate-spin" />
          Carregando...
        </div>
      )}

      {erroFicha && (
        <p className="text-sm text-red-400 flex items-center gap-1.5">
          <AlertTriangle size={13} />
          {erroFicha}
        </p>
      )}

      {ficha && !carregandoFicha && (
        <div className="rounded-xl border p-5 space-y-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          {sucesso && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: "rgba(34, 197, 94, 0.12)", color: "#16a34a" }}>
              {sucesso}
            </p>
          )}

          <div>
            <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
              OS Reparadora
            </p>
            {!editando ? (
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                  {ficha.os_reparadora || "—"}
                </p>
                {podeAlterar && (
                  <button
                    type="button"
                    onClick={iniciarEdicao}
                    title="Alterar OS Reparadora"
                    aria-label="Alterar OS Reparadora"
                    className="w-7 h-7 flex items-center justify-center rounded-full transition hover:bg-[var(--surface2)]"
                    style={{ color: "var(--accent2)" }}
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={novaOsReparadora}
                  onChange={(e) => setNovaOsReparadora(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10 números"
                  className="w-40 rounded-lg border px-3 py-1.5 text-sm"
                  style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={pedirConfirmacao}
                  title="Salvar"
                  aria-label="Salvar"
                  className="w-8 h-8 flex items-center justify-center rounded-full transition hover:bg-[var(--surface2)]"
                  style={{ color: "#16a34a" }}
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditando(false);
                    setErroCampo(null);
                  }}
                  title="Cancelar"
                  aria-label="Cancelar"
                  className="w-8 h-8 flex items-center justify-center rounded-full transition hover:bg-[var(--surface2)]"
                  style={{ color: "var(--muted)" }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {erroCampo && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle size={11} />
                {erroCampo}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {campo("Trade Allied", ficha.trade_allied)}
            {campo("OS Care Allied", ficha.os_care_allied)}
            {campo("NF Remessa Allied", ficha.nf_remessa_allied)}
            {campo("IMEI Reparadora", ficha.imei_reparadora)}
            {campo("IMEI Allied", ficha.imei_allied)}
            {campo("Atendimento", ficha.atendimento)}
            {campo("SKU", ficha.sku)}
            {campo("Modelo comercial", ficha.modelo_comercial)}
            {campo("Classificação Allied", ficha.classificacao_allied)}
            {campo("Etapa atual", ficha.status_operacional)}
            {campo("Mão de obra", ficha.mao_de_obra != null ? formatarReal(ficha.mao_de_obra) : null)}
            {!souAllied &&
              campo("Total peças (custo)", ficha.valor_total_peca != null ? formatarReal(ficha.valor_total_peca) : null)}
            {!souAllied &&
              campo("Total reparo (custo)", ficha.valor_total_reparo != null ? formatarReal(ficha.valor_total_reparo) : null)}
          </div>

          {ficha.descricao_completa && (
            <div>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Descrição completa
              </p>
              <p className="text-sm" style={{ color: "var(--ink)" }}>
                {ficha.descricao_completa}
              </p>
            </div>
          )}

          {ficha.observacao_tecnica_reparadora && (
            <div>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                Observação da reparadora
              </p>
              <p className="text-sm" style={{ color: "var(--ink)" }}>
                {ficha.observacao_tecnica_reparadora}
              </p>
            </div>
          )}

          {ficha.motivo_reprova && (
            <div>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "#ef4444" }}>
                Motivo de reprova
              </p>
              <p className="text-sm" style={{ color: "var(--ink)" }}>
                {ficha.motivo_reprova}
              </p>
            </div>
          )}

          <div>
            <p className="text-[11px] uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
              <Package size={12} />
              Peças lançadas
            </p>
            {(() => {
              const linhas = pecasDaFicha(ficha);
              if (linhas.length === 0) {
                return (
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    Nenhuma peça lançada nesse orçamento.
                  </p>
                );
              }
              return (
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                        <th className="px-3 py-2 font-medium">Posição</th>
                        <th className="px-3 py-2 font-medium">Código</th>
                        {!souAllied && <th className="px-3 py-2 font-medium">Custo</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l) => (
                        <tr key={l.posicao} className="border-t" style={{ borderColor: "var(--line)" }}>
                          <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                            {l.posicao}
                          </td>
                          <td className="px-3 py-2" style={{ color: "var(--ink)" }}>
                            {l.codigo}
                          </td>
                          {!souAllied && (
                            <td className="px-3 py-2" style={{ color: "var(--ink)" }}>
                              {l.custo != null ? formatarReal(l.custo) : "—"}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {confirmando && (
        <PopupConfirmar
          titulo="Confirmar alteração"
          mensagem={
            <>
              Confirma alterar a OS Reparadora de <strong>{ficha?.trade_allied}</strong> para{" "}
              <strong>{novaOsReparadora}</strong>? Essa alteração fica registrada na Auditoria.
            </>
          }
          rotuloConfirmar="Confirmar"
          carregando={salvando}
          erro={erroSalvar}
          onConfirmar={salvarOsReparadora}
          onFechar={() => {
            if (salvando) return;
            setConfirmando(false);
            setErroSalvar(null);
          }}
        />
      )}
    </div>
  );
}
