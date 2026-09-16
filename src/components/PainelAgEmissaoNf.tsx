"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import PopupDetalheGrupoNf from "@/components/PopupDetalheGrupoNf";
import {
  STATUS_AG_NF_RETORNO_RECUSADOS,
  STATUS_AG_NF_SERVICO_VENDA_RETORNO,
  type CamposPecasComCusto,
  type CamposValorVigente,
} from "@/lib/orcamentos";
import { gerarExcelExportacaoN3, type ItemExportacaoN3 } from "@/lib/exportN3";
import { gerarExcelPreOrdem } from "@/lib/preOrdemExport";
import { extrairOsReparadoraDoAllPending } from "@/lib/allPending";

export type AparelhoAgEmissaoNf = CamposPecasComCusto &
  CamposValorVigente & {
    id: string;
    os_reparadora: string | null;
    trade_allied: string;
    os_care_allied: string | null;
    modelo_comercial: string | null;
    sku: string | null;
    descricao_completa: string | null;
    pre_ordem: string | null;
    status_operacional: string;
    nf_remessa_allied: string;
    /** valor VIGENTE (mesma prioridade da Previsão de Recebimento) — já
     * calculado no servidor, ver operacional/[slug]/page.tsx. */
    maoDeObra: number;
    vendaPecas: number;
  };

type GrupoNfRemessa = {
  nfRemessa: string;
  quantidade: number;
  maoDeObra: number;
  vendaPecas: number;
  itens: AparelhoAgEmissaoNf[];
};

/** Resultado da conferência contra o All Pending do GSPN (ver
 * ConferenciaAllPending abaixo) — null enquanto ninguém subiu nada
 * ainda nessa sessão. */
type ResultadoConferencia = {
  coincidencias: string[];
  totalConferido: number;
};

function agruparPorNfRemessa(itens: AparelhoAgEmissaoNf[]): GrupoNfRemessa[] {
  const mapa = new Map<string, GrupoNfRemessa>();
  for (const a of itens) {
    const chave = a.nf_remessa_allied || "—";
    const atual = mapa.get(chave) ?? { nfRemessa: chave, quantidade: 0, maoDeObra: 0, vendaPecas: 0, itens: [] };
    atual.quantidade += 1;
    atual.maoDeObra += a.maoDeObra;
    atual.vendaPecas += a.vendaPecas;
    atual.itens.push(a);
    mapa.set(chave, atual);
  }
  return Array.from(mapa.values()).sort((a, b) => b.nfRemessa.localeCompare(a.nfRemessa, "pt-BR", { numeric: true }));
}

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function TabelaGrupos({
  titulo,
  cor,
  grupos,
  onAbrirDetalhe,
  onExportar,
  rotuloExportar = "Exportar",
  exportarLiberado,
}: {
  titulo: string;
  cor: string;
  grupos: GrupoNfRemessa[];
  onAbrirDetalhe: (grupo: GrupoNfRemessa) => void;
  onExportar: (grupo: GrupoNfRemessa) => void;
  rotuloExportar?: string;
  /** false enquanto a conferência com o All Pending do GSPN não deu
   * "tudo certo" (ver ConferenciaAllPending) — o botão fica visível mas
   * desabilitado, com o motivo no title. */
  exportarLiberado: boolean;
}) {
  const totalQuantidade = grupos.reduce((soma, g) => soma + g.quantidade, 0);
  const totalMaoDeObra = grupos.reduce((soma, g) => soma + g.maoDeObra, 0);
  const totalVendaPecas = grupos.reduce((soma, g) => soma + g.vendaPecas, 0);

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: cor }} />
        {titulo}
      </p>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">NF Remessa</th>
              <th className="px-4 py-2.5 font-medium">Quantidade</th>
              <th className="px-4 py-2.5 font-medium text-right">Mão de Obra</th>
              <th className="px-4 py-2.5 font-medium text-right">Venda Peças</th>
              <th className="px-4 py-2.5 font-medium" />
              <th className="px-4 py-2.5 font-medium w-8" />
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <tr
                key={g.nfRemessa}
                onClick={() => onAbrirDetalhe(g)}
                className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                title="Clique pra ver os orçamentos dessa NF Remessa"
              >
                <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                  {g.nfRemessa}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                  {g.quantidade}
                </td>
                <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                  {formatarReal(g.maoDeObra)}
                </td>
                <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                  {formatarReal(g.vendaPecas)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!exportarLiberado) return;
                      onExportar(g);
                    }}
                    disabled={!exportarLiberado}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                    title={
                      exportarLiberado
                        ? rotuloExportar
                        : "Suba o All Pending do GSPN e confira essa tela antes de exportar (ver botão no topo)."
                    }
                  >
                    <FileSpreadsheet size={13} />
                    {rotuloExportar}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                  <ChevronRight size={14} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
              <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                Total
              </td>
              <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                {totalQuantidade}
              </td>
              <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                {formatarReal(totalMaoDeObra)}
              </td>
              <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                {formatarReal(totalVendaPecas)}
              </td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/**
 * Confere as OS Reparadora que estão nessa tela (Aprovados + Recusados,
 * todas as NF Remessa) contra o export "All Pending" do GSPN — se
 * qualquer uma delas ainda aparecer lá (coluna B, "SO Nro."), é sinal de
 * que o aparelho não devia sair daqui ainda, então TODOS os botões
 * Exportar da tela ficam bloqueados até subir um All Pending sem
 * nenhuma coincidência. Checagem só da sessão atual: sai da tela ou
 * atualiza os dados (router.refresh) e precisa subir de novo.
 */
function ConferenciaAllPending({
  aparelhos,
  resultado,
  carregando,
  erro,
  onSelecionarArquivo,
}: {
  aparelhos: AparelhoAgEmissaoNf[];
  resultado: ResultadoConferencia | null;
  carregando: boolean;
  erro: string | null;
  onSelecionarArquivo: (arquivo: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const semCoincidencia = resultado != null && resultado.coincidencias.length === 0;
  const comCoincidencia = resultado != null && resultado.coincidencias.length > 0;

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Conferência com o All Pending (GSPN)
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Confere a OS Reparadora de todos os {aparelhos.length} aparelho(s) dessa tela contra a coluna B ("SO
            Nro.") do arquivo. Libera o Exportar só se nenhum bater.
          </p>
        </div>
        <label
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition hover:border-[var(--accent2)] shrink-0"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          {carregando ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          {carregando ? "Conferindo..." : "Upload All Pending (GSPN)"}
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx,.html,.htm"
            className="hidden"
            disabled={carregando}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) onSelecionarArquivo(arquivo);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </label>
      </div>

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {erro}
        </p>
      )}

      {semCoincidencia && (
        <p
          className="text-sm rounded-lg px-3 py-2 flex items-start gap-2"
          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", color: "#22c55e" }}
        >
          <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          Nenhuma coincidência encontrada — {resultado!.totalConferido} OS Reparadora conferida(s) contra o All
          Pending. Exportação liberada.
        </p>
      )}

      {comCoincidencia && (
        <div
          className="text-sm rounded-lg px-3 py-2.5"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444" }}
        >
          <p className="flex items-start gap-2 font-medium mb-1.5">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {resultado!.coincidencias.length} OS Reparadora ainda aparece(m) como pendente no GSPN — Exportar
            bloqueado nessa tela até resolver:
          </p>
          <div className="flex flex-wrap gap-1.5 pl-[23px]">
            {resultado!.coincidencias.map((os) => (
              <span
                key={os}
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-mono"
                style={{ background: "rgba(239,68,68,0.16)", color: "#ef4444" }}
              >
                {os}
              </span>
            ))}
          </div>
        </div>
      )}

      {resultado == null && !erro && !carregando && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Ainda não foi conferido nessa sessão — suba o All Pending pra liberar o Exportar.
        </p>
      )}
    </div>
  );
}

// Tela "Ag. Emissão de Nota Fiscal" — junta os aparelhos que saíram de
// "7 - Reparo Finalizado" (Aprovados, status "Ag. NF Serviço / Venda /
// Retorno") e de "8 - Orçamento Reprovado" (Recusados, status
// "Ag. NF Retorno (Recusados)"), mas SEPARADOS em 2 blocos (só quando
// tem aparelho dos dois grupos ao mesmo tempo — se só tiver de um,
// mostra só aquele). Dentro de cada bloco, primeiro resume por NF
// Remessa (quantidade + Mão de Obra + Venda Peças vigentes, somadas);
// clicar numa NF Remessa (ou na Quantidade) abre o detalhe dos
// orçamentos daquele lote. O Exportar (de qualquer um dos 2 blocos) só
// libera depois de conferir a tela inteira contra o All Pending do GSPN
// (ver ConferenciaAllPending acima — pedido explícito).
export default function PainelAgEmissaoNf({
  aparelhos,
  topo,
  mensagemVazia = "Nenhum aparelho aguardando emissão de Nota Fiscal no momento.",
}: {
  aparelhos: AparelhoAgEmissaoNf[];
  topo: React.ReactNode;
  mensagemVazia?: string;
}) {
  const [detalheGrupo, setDetalheGrupo] = useState<GrupoNfRemessa | null>(null);

  const [resultadoConferencia, setResultadoConferencia] = useState<ResultadoConferencia | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [erroConferencia, setErroConferencia] = useState<string | null>(null);

  // se a lista de aparelhos mudar (voltou pra tela, um lote saiu daqui,
  // router.refresh de qualquer ação), a conferência anterior não vale
  // mais — precisa subir o All Pending de novo antes de exportar.
  useEffect(() => {
    setResultadoConferencia(null);
    setErroConferencia(null);
  }, [aparelhos]);

  async function conferirComAllPending(arquivo: File) {
    setConferindo(true);
    setErroConferencia(null);
    setResultadoConferencia(null);
    try {
      const pendentesNoGspn = new Set(await extrairOsReparadoraDoAllPending(arquivo));
      const coincidencias = Array.from(
        new Set(
          aparelhos
            .map((a) => (a.os_reparadora ?? "").replace(/\D/g, ""))
            .filter((os) => os && pendentesNoGspn.has(os))
        )
      ).sort();
      setResultadoConferencia({ coincidencias, totalConferido: aparelhos.length });
    } catch (e) {
      setErroConferencia(e instanceof Error ? e.message : "Não foi possível ler esse arquivo.");
    }
    setConferindo(false);
  }

  const exportarLiberado = resultadoConferencia != null && resultadoConferencia.coincidencias.length === 0;

  const aprovados = useMemo(
    () => aparelhos.filter((a) => a.status_operacional === STATUS_AG_NF_SERVICO_VENDA_RETORNO),
    [aparelhos]
  );
  const recusados = useMemo(
    () => aparelhos.filter((a) => a.status_operacional === STATUS_AG_NF_RETORNO_RECUSADOS),
    [aparelhos]
  );

  const gruposAprovados = useMemo(() => agruparPorNfRemessa(aprovados), [aprovados]);
  const gruposRecusados = useMemo(() => agruparPorNfRemessa(recusados), [recusados]);

  return (
    <div className="space-y-6">
      <div className="flex items-center flex-wrap">{topo}</div>

      {aparelhos.length === 0 && (
        <p className="text-sm py-8 text-center rounded-xl border" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>
          {mensagemVazia}
        </p>
      )}

      {aparelhos.length > 0 && (
        <ConferenciaAllPending
          aparelhos={aparelhos}
          resultado={resultadoConferencia}
          carregando={conferindo}
          erro={erroConferencia}
          onSelecionarArquivo={conferirComAllPending}
        />
      )}

      {gruposAprovados.length > 0 && (
        <TabelaGrupos
          titulo="Aprovados — vindos de 7 - Reparo Finalizado"
          cor="#34d399"
          grupos={gruposAprovados}
          onAbrirDetalhe={setDetalheGrupo}
          onExportar={(g) => gerarExcelExportacaoN3(g.itens as ItemExportacaoN3[])}
          exportarLiberado={exportarLiberado}
        />
      )}

      {gruposRecusados.length > 0 && (
        <TabelaGrupos
          titulo="Recusados — vindos de 8 - Orçamento Reprovado"
          cor="#f87171"
          grupos={gruposRecusados}
          onAbrirDetalhe={setDetalheGrupo}
          onExportar={(g) => gerarExcelPreOrdem(g.itens, `NF_${g.nfRemessa}_Recusados`)}
          exportarLiberado={exportarLiberado}
        />
      )}

      {detalheGrupo && (
        <PopupDetalheGrupoNf
          nfRemessa={detalheGrupo.nfRemessa}
          itens={detalheGrupo.itens}
          onFechar={() => setDetalheGrupo(null)}
        />
      )}
    </div>
  );
}
