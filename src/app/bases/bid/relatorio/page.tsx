import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import BotaoGerarRelatorioBid from "@/components/BotaoGerarRelatorioBid";
import { podeImportarBid } from "@/lib/bid";

type LogRelatorio = {
  id: string;
  quantidade_part_numbers: number;
  nome_arquivo: string;
  gerado_em: string;
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
        .select("id, quantidade_part_numbers, nome_arquivo, gerado_em, usuarios:gerado_por (nome, sobrenome)")
        .order("gerado_em", { ascending: false })
        .limit(100)
        .returns<LogRelatorio[]>()
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
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <BotaoGerarRelatorioBid />
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
                  </tr>
                </thead>
                <tbody>
                  {historico.map((log) => {
                    const usuario = Array.isArray(log.usuarios) ? log.usuarios[0] : log.usuarios;
                    return (
                      <tr key={log.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                        <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                          {usuario ? `${usuario.nome} ${usuario.sobrenome}` : "—"}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                          {new Date(log.gerado_em).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                          {log.nome_arquivo}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--ink)" }}>
                          {log.quantidade_part_numbers}
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
