"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarRange, Download, FileSpreadsheet, Loader2, Search } from "lucide-react";
import { formatarDataHoraBrasilia } from "@/lib/tempo";
import { gerarExcelNotasFiscais } from "@/lib/notasFiscaisExport";

type GrupoNotaFiscal = {
  nfRemessa: string;
  quantidade: number;
  nfMaoDeObraNumero: string | null;
  nfMaoDeObraValor: number | null;
  nfPecasNumero: string | null;
  nfPecasValor: number | null;
  nfRetornoNumero: string | null;
  nfRetornoValor: number | null;
  situacao: "Produto Entregue" | "Em andamento";
  ultimaAtualizacao: string;
};

function formatarReal(valor: number | null): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const estiloInput: React.CSSProperties = {
  borderColor: "var(--line)",
  background: "var(--surface2)",
  color: "var(--ink)",
};

// Tela "Notas Fiscais" (menu Operacional, pedido explícito) — relação
// de todo orçamento que já teve NF Mão de Obra, NF Peças ou NF Retorno
// lançada em Ag. Emissão de Nota Fiscal, agrupada por NF Remessa. Não
// filtra pela etapa atual do orçamento: um lote continua aparecendo
// aqui mesmo depois de "Produto Entregue" (ver GET
// /api/operacional/notas-fiscais).
export default function PainelNotasFiscais() {
  const [grupos, setGrupos] = useState<GrupoNotaFiscal[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  async function carregar(filtros: { busca: string; dataInicio: string; dataFim: string }) {
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (filtros.busca) params.set("busca", filtros.busca);
      if (filtros.dataInicio) params.set("dataInicio", filtros.dataInicio);
      if (filtros.dataFim) params.set("dataFim", filtros.dataFim);
      const res = await fetch(`/api/operacional/notas-fiscais?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível carregar a relação de notas fiscais.");
      } else {
        setGrupos(data.grupos);
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar({ busca: "", dataInicio: "", dataFim: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function filtrar() {
    carregar({ busca, dataInicio, dataFim });
  }

  async function exportar() {
    if (!grupos || grupos.length === 0) return;
    setExportando(true);
    try {
      await gerarExcelNotasFiscais(grupos);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Todo orçamento com NF Mão de Obra, NF Peças ou NF Retorno já lançada em Ag. Emissão de Nota Fiscal, agrupado
        por NF Remessa — inclusive depois de "Produto Entregue".
      </p>

      <div className="flex items-center flex-wrap gap-2">
        <Search size={13} style={{ color: "var(--muted)" }} />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && filtrar()}
          placeholder="Buscar por NF Remessa ou nº da NF..."
          className="rounded-lg border px-2.5 py-1.5 text-xs outline-none w-64"
          style={estiloInput}
        />
        <span className="inline-flex items-center gap-1.5 text-xs ml-2" style={{ color: "var(--muted)" }}>
          <CalendarRange size={13} />
          Período (atualização, aproximado):
        </span>
        <input
          type="date"
          value={dataInicio}
          max={dataFim || undefined}
          onChange={(e) => setDataInicio(e.target.value)}
          className="rounded-lg border px-2.5 py-1.5 text-xs outline-none"
          style={estiloInput}
        />
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          até
        </span>
        <input
          type="date"
          value={dataFim}
          min={dataInicio || undefined}
          onChange={(e) => setDataFim(e.target.value)}
          className="rounded-lg border px-2.5 py-1.5 text-xs outline-none"
          style={estiloInput}
        />
        <button
          type="button"
          onClick={filtrar}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
          style={{ background: "var(--accent)" }}
        >
          Buscar
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={exportar}
          disabled={exportando || !grupos || grupos.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
          style={{ color: "var(--accent2)", borderColor: "var(--line)" }}
        >
          {exportando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          Exportar para Excel
        </button>
      </div>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        O período filtra pela última atualização do orçamento — não existe, no banco, uma data específica de quando
        cada NF foi lançada, então esse filtro é aproximado (pode incluir um lote que teve outra alteração além da
        NF, ou deixar de fora um lançamento antigo se o orçamento foi editado de novo depois).
      </p>

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {erro}
        </p>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: "var(--muted)" }}>
            <Loader2 size={16} className="animate-spin" />
            Carregando...
          </div>
        ) : !grupos || grupos.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: "var(--muted)" }}>
            Nenhuma nota fiscal encontrada.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-4 py-2.5 font-medium">NF Remessa</th>
                <th className="px-4 py-2.5 font-medium text-right">Qtd.</th>
                <th className="px-4 py-2.5 font-medium">NF Mão de Obra</th>
                <th className="px-4 py-2.5 font-medium">NF Peças</th>
                <th className="px-4 py-2.5 font-medium">NF Retorno</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
                <th className="px-4 py-2.5 font-medium">Última atualização</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.nfRemessa} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    {g.nfRemessa}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                    {g.quantidade}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    {g.nfMaoDeObraNumero ? (
                      <>
                        {g.nfMaoDeObraNumero}
                        <span className="block text-xs" style={{ color: "var(--muted)" }}>
                          {formatarReal(g.nfMaoDeObraValor)}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    {g.nfPecasNumero ? (
                      <>
                        {g.nfPecasNumero}
                        <span className="block text-xs" style={{ color: "var(--muted)" }}>
                          {formatarReal(g.nfPecasValor)}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    {g.nfRetornoNumero || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={
                        g.situacao === "Produto Entregue"
                          ? { color: "#16a34a", background: "rgba(34, 197, 94, 0.12)" }
                          : { color: "var(--muted)", background: "var(--surface2)" }
                      }
                    >
                      {g.situacao}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {formatarDataHoraBrasilia(g.ultimaAtualizacao)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {grupos && grupos.length > 0 && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <FileSpreadsheet size={12} />
          {grupos.length} NF Remessa encontrada(s).
        </p>
      )}
    </div>
  );
}
