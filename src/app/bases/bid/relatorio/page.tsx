import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import BotaoGerarRelatorioBid from "@/components/BotaoGerarRelatorioBid";
import BotaoMarcarBidEnviado from "@/components/BotaoMarcarBidEnviado";
import BotaoMarcarVersaoBidEnviado from "@/components/BotaoMarcarVersaoBidEnviado";
import { podeImportarBid } from "@/lib/bid";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

type LogRelatorio = {
  id: string;
  quantidade_part_numbers: number;
  nome_arquivo: string;
  gerado_em: string;
  enviado_em: string | null;
  usuarios: { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;
};

export default async function RelatorioBidPage() {
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

  const podeAcessar = podeImportarBid(perfil);

  const { data: historico } = podeAcessar
    ? await supabase
        .from("bid_relatorio_log")
        .select("id, quantidade_part_numbers, nome_arquivo, gerado_em, enviado_em, usuarios:gerado_por (nome, sobrenome)")
        .order("gerado_em", { ascending: false })
        .limit(100)
        .returns<LogRelatorio[]>()
    : { data: null };

  // último "Marcar como enviado" — só pra mostrar de quando é o envio
  // atualmente travado, como contexto ao lado do botão.
  const { data: ultimoEnvio } = podeAcessar
    ? await supabase
        .from("bid_pecas")
        .select("valor_enviado_em")
        .not("valor_enviado_em", "is", null)
        .order("valor_enviado_em", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <AppShell titulo="Relatório BID" perfil={perfil}>
      <Link
        href="/bases/bid"
        className="inline-flex items-center gap-1.5 text-xs hover:opacity-80 mb-4"
        style={{ color: "var(--muted)" }}
      >
        <ArrowLeft size={14} />
        Voltar para BID
      </Link>

      {!podeAcessar ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Seu cargo não tem permissão para acessar o Relatório BID.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <BotaoGerarRelatorioBid />
            <BotaoMarcarBidEnviado />
            {ultimoEnvio?.valor_enviado_em && (
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Último travamento de preço: {formatarDataHoraBrasilia(ultimoEnvio.valor_enviado_em)}
              </span>
            )}
            <div className="group relative inline-flex">
              <Info size={15} style={{ color: "var(--muted)" }} className="cursor-help" />
              <div
                className="pointer-events-none absolute left-0 top-6 z-20 hidden w-80 rounded-lg border p-3 text-xs shadow-2xl group-hover:block"
                style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }}
              >
                Exporta em Excel só as peças do BID com Modelo, Part Number, Peça Solução, Custo Peça (Allied) e Mão
                de Obra todos preenchidos — peças pendentes de cadastro ficam de fora automaticamente. Colunas: Peças
                (Modelo), Part Number, Peça Solução, Custo Peça e Mão de Obra.
              </div>
            </div>
          </div>

          <p className="text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
            <FileSpreadsheet size={13} /> Histórico de emissões
          </p>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            Cada geração guarda uma cópia (por até 60 dias) que dá pra baixar de novo igual à original. Marque uma
            versão como <strong>enviada</strong> pra ela ficar visível também no login Allied (menu BID).
          </p>

          {!historico || historico.length === 0 ? (
            <p className="text-sm py-8 text-center rounded-xl border" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>
              Nenhum relatório gerado ainda.
            </p>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--surface2)" }}>
                    <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                      Gerado por
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                      Data/hora
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                      Arquivo
                    </th>
                    <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                      Part Numbers exportados
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                      Status
                    </th>
                    <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                      Baixar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((log) => {
                    const usuario = Array.isArray(log.usuarios) ? log.usuarios[0] : log.usuarios;
                    const enviado = !!log.enviado_em;
                    return (
                      <tr
                        key={log.id}
                        className="border-t"
                        style={{
                          borderColor: "var(--line)",
                          background: enviado ? "rgba(34, 197, 94, 0.06)" : undefined,
                        }}
                      >
                        <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                          {usuario ? `${usuario.nome} ${usuario.sobrenome}` : "—"}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                          {formatarDataHoraBrasilia(log.gerado_em)}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                          {log.nome_arquivo}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--ink)" }}>
                          {log.quantidade_part_numbers}
                        </td>
                        <td className="px-4 py-2.5">
                          <BotaoMarcarVersaoBidEnviado id={log.id} enviadoEm={log.enviado_em} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <a
                            href={`/api/bases/bid/relatorio/${log.id}/download`}
                            title="Baixar essa versão de novo"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[var(--accent2)]"
                            style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                          >
                            <Download size={14} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
