import { Download, FileSpreadsheet, Tags } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { buscarVersoesBidEnviadasAllied } from "@/lib/allied";
import { isAllied } from "@/lib/usuarios";
import { podeImportarBid } from "@/lib/bid";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

// Menu "BID" do login ALLIED (pedido explícito) — só as versões do
// Relatório BID marcadas como "enviadas" (ver Bases > Relatório BID,
// migration 0056), com data/hora do envio e o link pra baixar de novo.
// Liberado também pra equipe interna conferir o que o Allied está
// vendo, sem precisar logar como ele.
export default async function VersoesBidEnviadasPage() {
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

  const podeAcessar = isAllied(perfil) || podeImportarBid(perfil);

  const versoes = podeAcessar ? await buscarVersoesBidEnviadasAllied(supabase) : [];

  return (
    <AppShell
      titulo="BID"
      tituloInfo="Versões do Relatório BID marcadas como enviadas — cada uma fica disponível por até 60 dias a partir da geração."
      perfil={perfil}
    >
      <h1 className="text-xl font-semibold mb-1 flex items-center gap-2" style={{ color: "var(--ink)" }}>
        <Tags size={20} style={{ color: "var(--accent2)" }} />
        BID
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Versões do Relatório BID já enviadas, com data e hora.
      </p>

      {!podeAcessar ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Seu cargo não tem permissão para acessar essa tela.
        </p>
      ) : versoes.length === 0 ? (
        <p className="text-sm py-8 text-center rounded-xl border" style={{ color: "var(--muted)", borderColor: "var(--line)" }}>
          Nenhuma versão enviada no momento.
        </p>
      ) : (
        <div className="rounded-xl border overflow-hidden max-w-2xl" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface2)" }}>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                  Enviado em
                </th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                  Arquivo
                </th>
                <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                  Part Numbers
                </th>
                <th className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--muted)" }}>
                  Baixar
                </th>
              </tr>
            </thead>
            <tbody>
              {versoes.map((v) => (
                <tr key={v.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    {formatarDataHoraBrasilia(v.enviadoEm)}
                  </td>
                  <td className="px-4 py-2.5 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                    <FileSpreadsheet size={13} />
                    {v.nomeArquivo}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium" style={{ color: "var(--ink)" }}>
                    {v.quantidadePartNumbers}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <a
                      href={`/api/bases/bid/relatorio/${v.id}/download`}
                      title="Baixar essa versão"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[var(--accent2)]"
                      style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                    >
                      <Download size={14} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
