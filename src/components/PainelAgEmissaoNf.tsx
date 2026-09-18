"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  Hammer,
  Loader2,
  Package,
  PackageCheck,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import PopupDetalheGrupoNf from "@/components/PopupDetalheGrupoNf";
import PopupNfEmissao from "@/components/PopupNfEmissao";
import PopupConfirmarProdutoEntregue, { type LinhaResumoEnvio } from "@/components/PopupConfirmarProdutoEntregue";
import {
  STATUS_AG_NF_RETORNO_RECUSADOS,
  STATUS_AG_NF_SERVICO_VENDA_RETORNO,
  podeLancarNfProdutoEntregue,
  lerInfoNotaFiscal,
  type InfoNotaFiscal,
  type CamposNotaFiscal,
  type CamposPecasComCusto,
  type CamposValorVigente,
} from "@/lib/orcamentos";
import { gerarExcelExportacaoN3, type ItemExportacaoN3 } from "@/lib/exportN3";
import { gerarExcelPreOrdem } from "@/lib/preOrdemExport";
import { gerarExcelModeloRetorno, type ItemModeloRetorno } from "@/lib/modeloRetorno";
import { extrairOsReparadoraDoAllPending } from "@/lib/allPending";

type Perfil = { cargo: string; is_master: boolean } | null;

export type AparelhoAgEmissaoNf = CamposPecasComCusto &
  CamposValorVigente &
  CamposNotaFiscal & {
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
    /** usados só na planilha "Modelo de Retorno" (ver lib/modeloRetorno.ts). */
    imei_allied: string | null;
    motivo_reprova: string | null;
    observacao_tecnica_reparadora: string | null;
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

type Bloco = "aprovados" | "recusados";

/** Popup de lançar NF aberto no momento — carrega tudo que
 * PopupNfEmissao precisa pra salvar (ids afetados + de onde vem o valor
 * inicial), ver abaixo. */
type PopupNfAberto = {
  tipo: "mao_de_obra" | "pecas" | "retorno";
  titulo: string;
  escopo: string;
  ids: string[];
  valorInicial: InfoNotaFiscal | null;
  /** só pra NF Mão de Obra/Peças — total já calculado (soma vigente do
   * bloco Aprovados), mostrado só leitura no pop-up e é ele que é
   * salvo (pedido explícito: nunca digitar valor à mão). Omitido pra NF
   * Retorno, que não tem valor. */
  valorAutomatico?: number;
  /** só pro tipo "retorno" — chave do grupo (ver chaveGrupo) onde salvar
   * o override local ao confirmar (ver salvarPopupNf). */
  chaveRetorno?: string;
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

function chaveGrupo(bloco: Bloco, nfRemessa: string): string {
  return `${bloco}:${nfRemessa}`;
}

function BotaoIconeNf({
  icone: Icone,
  rotulo,
  preenchido,
  habilitado,
  titulo,
  onClick,
}: {
  icone: typeof Hammer;
  rotulo: string;
  preenchido: boolean;
  habilitado: boolean;
  titulo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!habilitado) return;
        onClick();
      }}
      disabled={!habilitado}
      title={titulo}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      style={{
        borderColor: preenchido ? "#22c55e" : "var(--line)",
        color: preenchido ? "#22c55e" : "var(--ink)",
        background: preenchido ? "rgba(34,197,94,0.08)" : undefined,
      }}
    >
      {preenchido ? <Check size={13} /> : <Icone size={13} />}
      {rotulo}
    </button>
  );
}

function TabelaGrupos({
  titulo,
  cor,
  grupos,
  onAbrirDetalhe,
  onExportar,
  rotuloExportar = "Exportar",
  exportarLiberado,
  acoesTopo,
  renderAcaoLinha,
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
  /** ícones de NF que valem pro bloco inteiro (Mão de Obra/Peças) — só
   * no bloco Aprovados, aparecem uma vez ao lado do título. */
  acoesTopo?: React.ReactNode;
  /** ícone de NF Retorno de cada linha (um por NF Remessa, nos dois
   * blocos). */
  renderAcaoLinha: (grupo: GrupoNfRemessa) => React.ReactNode;
}) {
  const totalQuantidade = grupos.reduce((soma, g) => soma + g.quantidade, 0);
  const totalMaoDeObra = grupos.reduce((soma, g) => soma + g.maoDeObra, 0);
  const totalVendaPecas = grupos.reduce((soma, g) => soma + g.vendaPecas, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: cor }} />
          {titulo}
        </p>
        {acoesTopo && <div className="flex items-center gap-2">{acoesTopo}</div>}
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">NF Remessa</th>
              <th className="px-4 py-2.5 font-medium">Quantidade</th>
              <th className="px-4 py-2.5 font-medium text-right">Mão de Obra</th>
              <th className="px-4 py-2.5 font-medium text-right">Venda Peças</th>
              <th className="px-4 py-2.5 font-medium" />
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
                <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  {renderAcaoLinha(g)}
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
  const [osCopiada, setOsCopiada] = useState<string | null>(null);

  const semCoincidencia = resultado != null && resultado.coincidencias.length === 0;
  const comCoincidencia = resultado != null && resultado.coincidencias.length > 0;

  async function copiarOs(os: string) {
    try {
      await navigator.clipboard.writeText(os);
      setOsCopiada(os);
      setTimeout(() => setOsCopiada((atual) => (atual === os ? null : atual)), 1200);
    } catch {
      // clipboard indisponível — ignora silenciosamente
    }
  }

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
            {resultado!.coincidencias.map((os) => {
              const copiada = osCopiada === os;
              return (
                <span
                  key={os}
                  className="inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-1 text-xs font-mono"
                  style={{ background: "rgba(239,68,68,0.16)", color: "#ef4444" }}
                >
                  {os}
                  <button
                    type="button"
                    onClick={() => copiarOs(os)}
                    title={copiada ? "Copiado!" : "Copiar OS Reparadora"}
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full transition hover:bg-red-500/25"
                    style={{ color: copiada ? "#22c55e" : "#ef4444" }}
                  >
                    {copiada ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </span>
              );
            })}
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
//
// Depois de exportar um lote, libera lançar as NFs daquele lote (ver
// migration 0048): NF Mão de Obra e NF Peças valem pro bloco Aprovados
// INTEIRO de uma vez só (ícone único, no topo do bloco, some depois que
// todo lote de Aprovados já tiver sido exportado); NF Retorno é por NF
// Remessa, nos dois blocos (ícone em cada linha). Quando tudo que um
// bloco precisa já foi lançado, aparece o botão "Enviar para Produto
// Entregue" daquele bloco — Aprovados precisa das 3 NFs, Recusados só
// da NF Retorno de cada lote.
export default function PainelAgEmissaoNf({
  aparelhos,
  topo,
  perfil = null,
  mensagemVazia = "Nenhum aparelho aguardando emissão de Nota Fiscal no momento.",
  solucoesPorPartNumber = {},
}: {
  aparelhos: AparelhoAgEmissaoNf[];
  topo: React.ReactNode;
  perfil?: Perfil;
  mensagemVazia?: string;
  /** "Peça Solução" de cada Part Number (BID) — usado só pra formatar
   * "Part Number - Peça Solução" na planilha "Modelo de Retorno" (ver
   * lib/modeloRetorno.ts e operacional/[slug]/page.tsx). */
  solucoesPorPartNumber?: Record<string, string>;
}) {
  const router = useRouter();
  const [detalheGrupo, setDetalheGrupo] = useState<{ bloco: Bloco; grupo: GrupoNfRemessa } | null>(null);

  const [resultadoConferencia, setResultadoConferencia] = useState<ResultadoConferencia | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [erroConferencia, setErroConferencia] = useState<string | null>(null);

  // "já exportado" e os valores de NF lançados nessa sessão — ver reset
  // abaixo sempre que `aparelhos` mudar de verdade (ex.: depois de
  // mandar um bloco pra Produto Entregue, ver enviarProdutoEntregue).
  const [exportadosSessao, setExportadosSessao] = useState<Set<string>>(new Set());
  const [nfLocalAprovados, setNfLocalAprovados] = useState<{ maoDeObra?: InfoNotaFiscal; pecas?: InfoNotaFiscal }>({});
  const [nfLocalRetorno, setNfLocalRetorno] = useState<Record<string, InfoNotaFiscal>>({});

  const [popupNf, setPopupNf] = useState<PopupNfAberto | null>(null);
  // popup único do "resumo + Enviar para Produto Entregue" (gate no
  // painel INTEIRO, não mais por bloco — ver prontoParaFinalizar abaixo).
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const podeLancarNf = podeLancarNfProdutoEntregue(perfil);

  // se a lista de aparelhos mudar (voltou pra tela, um lote saiu daqui,
  // router.refresh de qualquer ação), a conferência anterior e o que foi
  // exportado/lançado só nessa sessão não valem mais — já está refletido
  // nos dados novos vindos do servidor.
  useEffect(() => {
    setResultadoConferencia(null);
    setErroConferencia(null);
    setExportadosSessao(new Set());
    setNfLocalAprovados({});
    setNfLocalRetorno({});
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

  function estaExportado(bloco: Bloco, grupo: GrupoNfRemessa): boolean {
    if (exportadosSessao.has(chaveGrupo(bloco, grupo.nfRemessa))) return true;
    return grupo.itens.length > 0 && grupo.itens.every((i) => i.nf_exportado_em != null);
  }

  function infoRetorno(bloco: Bloco, grupo: GrupoNfRemessa): InfoNotaFiscal | null {
    const local = nfLocalRetorno[chaveGrupo(bloco, grupo.nfRemessa)];
    if (local) return local;
    const primeiro = grupo.itens[0];
    return primeiro ? lerInfoNotaFiscal(primeiro.nf_retorno_numero, primeiro.nf_retorno_valor) : null;
  }

  const infoMaoDeObraAprovados: InfoNotaFiscal | null =
    nfLocalAprovados.maoDeObra ??
    (aprovados[0] ? lerInfoNotaFiscal(aprovados[0].nf_mao_de_obra_numero, aprovados[0].nf_mao_de_obra_valor) : null);
  const infoPecasAprovados: InfoNotaFiscal | null =
    nfLocalAprovados.pecas ??
    (aprovados[0] ? lerInfoNotaFiscal(aprovados[0].nf_pecas_numero, aprovados[0].nf_pecas_valor) : null);

  // o pop-up de detalhe (PopupDetalheGrupoNf) lê os campos nf_* direto
  // de cada item — sem isso aqui, uma NF lançada nessa sessão (ainda sem
  // vir do servidor, ver comentário no useEffect acima) apareceria como
  // "—" lá mesmo já salva de verdade no banco. Aplica os mesmos
  // overrides usados nos ícones (infoRetorno/infoMaoDeObraAprovados/
  // infoPecasAprovados) em cima dos itens antes de abrir o detalhe.
  function itensComNfAtual(bloco: Bloco, grupo: GrupoNfRemessa): AparelhoAgEmissaoNf[] {
    const retorno = infoRetorno(bloco, grupo);
    const maoDeObra = bloco === "aprovados" ? infoMaoDeObraAprovados : null;
    const pecas = bloco === "aprovados" ? infoPecasAprovados : null;
    if (!retorno && !maoDeObra && !pecas) return grupo.itens;
    return grupo.itens.map((item) => ({
      ...item,
      ...(maoDeObra ? { nf_mao_de_obra_numero: maoDeObra.numero, nf_mao_de_obra_valor: maoDeObra.valor } : {}),
      ...(pecas ? { nf_pecas_numero: pecas.numero, nf_pecas_valor: pecas.valor } : {}),
      ...(retorno ? { nf_retorno_numero: retorno.numero, nf_retorno_valor: retorno.valor } : {}),
    }));
  }

  /** Mesmos overrides de itensComNfAtual, só que pra TODOS os itens de
   * uma lista de grupos de uma vez — usado só pra montar a planilha
   * "Modelo de Retorno" (ver emitirPlanilhaRetorno abaixo). */
  function itensParaModeloRetorno(bloco: Bloco, grupos: GrupoNfRemessa[]): ItemModeloRetorno[] {
    return grupos.flatMap((g) => itensComNfAtual(bloco, g));
  }

  /** Resumo combinado (Aprovados + Recusados) mostrado no pop-up de
   * confirmação — uma linha por NF Remessa de cada bloco (pedido
   * explícito: NF Remessa, Quantidade, Mão de Obra, Vendas Peças, NF
   * Retorno, NF Mão de Obra, NF Peça). */
  function linhasResumoEnvio(): LinhaResumoEnvio[] {
    const linhasAprovados: LinhaResumoEnvio[] = gruposAprovados.map((g) => ({
      bloco: "aprovados",
      nfRemessa: g.nfRemessa,
      quantidade: g.quantidade,
      maoDeObra: g.maoDeObra,
      vendaPecas: g.vendaPecas,
      nfRetorno: infoRetorno("aprovados", g)?.numero ?? null,
      nfMaoDeObra: infoMaoDeObraAprovados?.numero ?? null,
      nfPecas: infoPecasAprovados?.numero ?? null,
    }));
    const linhasRecusados: LinhaResumoEnvio[] = gruposRecusados.map((g) => ({
      bloco: "recusados",
      nfRemessa: g.nfRemessa,
      quantidade: g.quantidade,
      maoDeObra: g.maoDeObra,
      vendaPecas: g.vendaPecas,
      nfRetorno: infoRetorno("recusados", g)?.numero ?? null,
      nfMaoDeObra: null,
      nfPecas: null,
    }));
    return [...linhasAprovados, ...linhasRecusados];
  }

  async function emitirPlanilhaRetorno() {
    const aprovadosPlanilha = itensParaModeloRetorno("aprovados", gruposAprovados);
    const recusadosPlanilha = itensParaModeloRetorno("recusados", gruposRecusados);
    const { nomeArquivo, dataReferencia } = await gerarExcelModeloRetorno(
      aprovadosPlanilha,
      recusadosPlanilha,
      solucoesPorPartNumber
    );
    // Registra a emissão no histórico (menu Operacional > Modelo de
    // Retorno — ver migration 0049) — best-effort: se falhar, a
    // planilha já foi baixada normalmente, só não fica registrada.
    try {
      const res = await fetch("/api/operacional/modelo-retorno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aprovados: aprovadosPlanilha,
          recusados: recusadosPlanilha,
          solucoesPorPartNumber,
          nomeArquivo,
          dataReferencia,
        }),
      });
      if (!res.ok) {
        setErroAcao("A planilha foi baixada, mas não deu pra registrar no histórico de Modelo de Retorno.");
      }
    } catch {
      setErroAcao("A planilha foi baixada, mas não deu pra registrar no histórico de Modelo de Retorno.");
    }
  }

  async function exportarGrupo(bloco: Bloco, grupo: GrupoNfRemessa) {
    if (bloco === "aprovados") {
      await gerarExcelExportacaoN3(grupo.itens as ItemExportacaoN3[]);
    } else {
      await gerarExcelPreOrdem(grupo.itens, `NF_${grupo.nfRemessa}_Recusados`);
    }
    try {
      const res = await fetch("/api/operacional/orcamentos/marcar-exportado-nf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: grupo.itens.map((i) => i.id) }),
      });
      if (res.ok) {
        setExportadosSessao((prev) => new Set(prev).add(chaveGrupo(bloco, grupo.nfRemessa)));
      } else {
        setErroAcao("A planilha foi gerada, mas não deu pra registrar a exportação — os ícones de NF desse lote continuam bloqueados.");
      }
    } catch {
      setErroAcao("A planilha foi gerada, mas não deu pra registrar a exportação — os ícones de NF desse lote continuam bloqueados.");
    }
  }

  function abrirPopupMaoDeObra() {
    setErroAcao(null);
    const total = aprovados.reduce((soma, a) => soma + a.maoDeObra, 0);
    setPopupNf({
      tipo: "mao_de_obra",
      titulo: "NF Mão de Obra",
      escopo: `Vale pra todos os ${aprovados.length} aparelho(s) do bloco Aprovados de uma vez.`,
      ids: aprovados.map((a) => a.id),
      valorInicial: infoMaoDeObraAprovados,
      valorAutomatico: total,
    });
  }

  function abrirPopupPecas() {
    setErroAcao(null);
    const total = aprovados.reduce((soma, a) => soma + a.vendaPecas, 0);
    setPopupNf({
      tipo: "pecas",
      titulo: "NF Peças",
      escopo: `Vale pra todos os ${aprovados.length} aparelho(s) do bloco Aprovados de uma vez.`,
      ids: aprovados.map((a) => a.id),
      valorInicial: infoPecasAprovados,
      valorAutomatico: total,
    });
  }

  function abrirPopupRetorno(bloco: Bloco, grupo: GrupoNfRemessa) {
    setErroAcao(null);
    setPopupNf({
      tipo: "retorno",
      titulo: "NF Retorno",
      escopo: `Vale só pra NF Remessa ${grupo.nfRemessa} (${grupo.quantidade} aparelho(s)).`,
      ids: grupo.itens.map((i) => i.id),
      valorInicial: infoRetorno(bloco, grupo),
      chaveRetorno: chaveGrupo(bloco, grupo.nfRemessa),
    });
  }

  async function salvarPopupNf(info: InfoNotaFiscal) {
    if (!popupNf) return;
    const res = await fetch("/api/operacional/orcamentos/salvar-nf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: popupNf.ids, tipo: popupNf.tipo, numero: info.numero, valor: info.valor }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || "Não foi possível salvar essa NF.");
    }
    if (popupNf.tipo === "mao_de_obra") {
      setNfLocalAprovados((prev) => ({ ...prev, maoDeObra: info }));
    } else if (popupNf.tipo === "pecas") {
      setNfLocalAprovados((prev) => ({ ...prev, pecas: info }));
    } else if (popupNf.chaveRetorno) {
      const chave = popupNf.chaveRetorno;
      setNfLocalRetorno((prev) => ({ ...prev, [chave]: info }));
    }
    setPopupNf(null);
  }

  const aprovadosProntoParaEnviar =
    aprovados.length > 0 &&
    infoMaoDeObraAprovados != null &&
    infoPecasAprovados != null &&
    gruposAprovados.every((g) => infoRetorno("aprovados", g) != null);

  const recusadosProntoParaEnviar =
    recusados.length > 0 && gruposRecusados.every((g) => infoRetorno("recusados", g) != null);

  // Gate ÚNICO pro painel inteiro (pedido explícito) — só libera o botão
  // "Enviar para Produto Entregue" quando os dois blocos que existirem
  // na tela já tiverem todas as NFs lançadas (bloco vazio não trava).
  const prontoParaFinalizar =
    podeLancarNf &&
    (aprovados.length > 0 || recusados.length > 0) &&
    (gruposAprovados.length === 0 || aprovadosProntoParaEnviar) &&
    (gruposRecusados.length === 0 || recusadosProntoParaEnviar);

  async function enviarBloco(bloco: Bloco) {
    const itens = bloco === "aprovados" ? aprovados : recusados;
    if (itens.length === 0) return;
    const rota =
      bloco === "aprovados"
        ? "/api/operacional/orcamentos/enviar-produto-entregue-aprovados-em-massa"
        : "/api/operacional/orcamentos/enviar-produto-entregue-recusados-em-massa";
    const res = await fetch(rota, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: itens.map((i) => i.id) }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || "Não foi possível enviar pra Produto Entregue.");
    }
  }

  // Manda os dois blocos que existirem na tela de uma vez só (pedido
  // explícito: gate no painel inteiro) — cada rota já revalida no
  // servidor que as NFs daquele bloco estão todas preenchidas.
  async function enviarProdutoEntregue() {
    await enviarBloco("aprovados");
    await enviarBloco("recusados");
    setConfirmandoEnvio(false);
    router.refresh();
  }

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

      {erroAcao && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {erroAcao}
        </p>
      )}

      {gruposAprovados.length > 0 && (
        <div className="space-y-2">
          <TabelaGrupos
            titulo="Aprovados — vindos de 7 - Reparo Finalizado"
            cor="#34d399"
            grupos={gruposAprovados}
            onAbrirDetalhe={(g) => setDetalheGrupo({ bloco: "aprovados", grupo: g })}
            onExportar={(g) => exportarGrupo("aprovados", g)}
            exportarLiberado={exportarLiberado}
            acoesTopo={
              <>
                <BotaoIconeNf
                  icone={Hammer}
                  rotulo="NF Mão de Obra"
                  preenchido={infoMaoDeObraAprovados != null}
                  habilitado={podeLancarNf && exportarLiberado && gruposAprovados.every((g) => estaExportado("aprovados", g))}
                  titulo={
                    !podeLancarNf
                      ? "Seu cargo não tem permissão pra lançar NF."
                      : !gruposAprovados.every((g) => estaExportado("aprovados", g))
                        ? "Exporte todos os lotes de Aprovados antes de lançar a NF Mão de Obra."
                        : !exportarLiberado
                          ? "Confira o All Pending do GSPN antes de lançar a NF."
                          : "Lançar NF Mão de Obra (vale pra todo o bloco Aprovados)"
                  }
                  onClick={abrirPopupMaoDeObra}
                />
                <BotaoIconeNf
                  icone={Package}
                  rotulo="NF Peças"
                  preenchido={infoPecasAprovados != null}
                  habilitado={podeLancarNf && exportarLiberado && gruposAprovados.every((g) => estaExportado("aprovados", g))}
                  titulo={
                    !podeLancarNf
                      ? "Seu cargo não tem permissão pra lançar NF."
                      : !gruposAprovados.every((g) => estaExportado("aprovados", g))
                        ? "Exporte todos os lotes de Aprovados antes de lançar a NF Peças."
                        : !exportarLiberado
                          ? "Confira o All Pending do GSPN antes de lançar a NF."
                          : "Lançar NF Peças (vale pra todo o bloco Aprovados)"
                  }
                  onClick={abrirPopupPecas}
                />
              </>
            }
            renderAcaoLinha={(g) => (
              <BotaoIconeNf
                icone={RotateCcw}
                rotulo="NF Retorno"
                preenchido={infoRetorno("aprovados", g) != null}
                habilitado={podeLancarNf && exportarLiberado && estaExportado("aprovados", g)}
                titulo={
                  !podeLancarNf
                    ? "Seu cargo não tem permissão pra lançar NF."
                    : !estaExportado("aprovados", g)
                      ? "Exporte esse lote antes de lançar a NF Retorno."
                      : !exportarLiberado
                        ? "Confira o All Pending do GSPN antes de lançar a NF."
                        : "Lançar NF Retorno desse lote"
                }
                onClick={() => abrirPopupRetorno("aprovados", g)}
              />
            )}
          />
        </div>
      )}

      {gruposRecusados.length > 0 && (
        <div className="space-y-2">
          <TabelaGrupos
            titulo="Recusados — vindos de 8 - Orçamento Reprovado"
            cor="#f87171"
            grupos={gruposRecusados}
            onAbrirDetalhe={(g) => setDetalheGrupo({ bloco: "recusados", grupo: g })}
            onExportar={(g) => exportarGrupo("recusados", g)}
            exportarLiberado={exportarLiberado}
            renderAcaoLinha={(g) => (
              <BotaoIconeNf
                icone={RotateCcw}
                rotulo="NF Retorno"
                preenchido={infoRetorno("recusados", g) != null}
                habilitado={podeLancarNf && exportarLiberado && estaExportado("recusados", g)}
                titulo={
                  !podeLancarNf
                    ? "Seu cargo não tem permissão pra lançar NF."
                    : !estaExportado("recusados", g)
                      ? "Exporte esse lote antes de lançar a NF Retorno."
                      : !exportarLiberado
                        ? "Confira o All Pending do GSPN antes de lançar a NF."
                        : "Lançar NF Retorno desse lote"
                }
                onClick={() => abrirPopupRetorno("recusados", g)}
              />
            )}
          />
        </div>
      )}

      {prontoParaFinalizar && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setConfirmandoEnvio(true)}
            className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-4 py-2.5 transition"
            style={{ background: "#22c55e" }}
          >
            <PackageCheck size={15} />
            Enviar para Produto Entregue
          </button>
        </div>
      )}

      {detalheGrupo && (
        <PopupDetalheGrupoNf
          nfRemessa={detalheGrupo.grupo.nfRemessa}
          itens={itensComNfAtual(detalheGrupo.bloco, detalheGrupo.grupo)}
          mostrarNfMaoDeObraEPecas={detalheGrupo.bloco === "aprovados"}
          onFechar={() => setDetalheGrupo(null)}
        />
      )}

      {popupNf && (
        <PopupNfEmissao
          titulo={popupNf.titulo}
          escopo={popupNf.escopo}
          valorInicial={popupNf.valorInicial}
          valorAutomatico={popupNf.valorAutomatico}
          onFechar={() => setPopupNf(null)}
          onSalvar={salvarPopupNf}
        />
      )}

      {confirmandoEnvio && (
        <PopupConfirmarProdutoEntregue
          linhas={linhasResumoEnvio()}
          onFechar={() => setConfirmandoEnvio(false)}
          onEmitirPlanilha={emitirPlanilhaRetorno}
          onConfirmar={enviarProdutoEntregue}
        />
      )}
    </div>
  );
}
