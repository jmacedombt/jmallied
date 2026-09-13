"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import PopupDetalheGrupoNf from "@/components/PopupDetalheGrupoNf";
import { STATUS_AG_NF_RETORNO_RECUSADOS, STATUS_AG_NF_SERVICO_VENDA_RETORNO } from "@/lib/orcamentos";

export type AparelhoAgEmissaoNf = {
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
}: {
  titulo: string;
  cor: string;
  grupos: GrupoNfRemessa[];
  onAbrirDetalhe: (grupo: GrupoNfRemessa) => void;
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
            </tr>
          </tfoot>
        </table>
      </div>
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
// orçamentos daquele lote.
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

      {gruposAprovados.length > 0 && (
        <TabelaGrupos
          titulo="Aprovados — vindos de 7 - Reparo Finalizado"
          cor="#34d399"
          grupos={gruposAprovados}
          onAbrirDetalhe={setDetalheGrupo}
        />
      )}

      {gruposRecusados.length > 0 && (
        <TabelaGrupos
          titulo="Recusados — vindos de 8 - Orçamento Reprovado"
          cor="#f87171"
          grupos={gruposRecusados}
          onAbrirDetalhe={setDetalheGrupo}
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
