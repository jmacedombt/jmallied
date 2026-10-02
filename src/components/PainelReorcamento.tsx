"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Download, Loader2 } from "lucide-react";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

type Usuario = { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;

function nomeUsuario(usuarios: Usuario): string {
  const u = Array.isArray(usuarios) ? usuarios[0] : usuarios;
  return u ? `${u.nome} ${u.sobrenome}` : "—";
}

type Envio = {
  id: string;
  nf_remessa_allied: string;
  quantidade_aparelhos: number;
  arquivo_path: string | null;
  enviado_em: string;
  usuarios: Usuario;
};

// Tela "Reorçamento" (menu Operacional, pedido explícito, 02/10/2026) —
// histórico de toda planilha Complementar já enviada em "4 - Ag. Resposta
// de Reorçamento" > Enviar planilha Complementar, mais recente primeiro
// (mesmo padrão do PainelContraPropostas.tsx). Reaproveita o mesmo
// registro que já existe hoje em orcamento_envios (tipo "reorcamento" —
// ver lib/orcamentoEnvio.ts, persistirEEnviarLote) — por isso qualquer
// planilha Complementar já enviada antes dessa tela existir já aparece
// aqui, sem precisar de nenhum backfill. Diferente de Contra Propostas,
// não tem a quebra de aprovados/aceitos/recusados (a planilha Complementar
// só registra a quantidade total de aparelhos do envio) e "Baixar" pega o
// arquivo real já salvo no Storage (bucket envios-orcamentos), em vez de
// remontar a planilha a partir de um snapshot.
export default function PainelReorcamento() {
  const [envios, setEnvios] = useState<Envio[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/operacional/reorcamento");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível carregar o histórico.");
      } else {
        setEnvios(data.envios);
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function baixar(envio: Envio) {
    setBaixando(envio.id);
    try {
      const res = await fetch(`/api/operacional/reorcamento/${envio.id}/download`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErro(data?.error || "Não foi possível baixar essa planilha.");
        setBaixando(null);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `complementar-${envio.nf_remessa_allied}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Falha de conexão ao baixar a planilha.");
    }
    setBaixando(null);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Toda vez que "Enviar planilha Complementar" é confirmado em 4 - Ag. Resposta de Reorçamento, a planilha fica
        registrada aqui com data e hora — dá pra baixar de novo quando precisar.
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
        ) : !envios || envios.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: "var(--muted)" }}>
            Nenhuma planilha Complementar (Reorçamento) enviada ainda.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-4 py-2.5 font-medium">Data/hora</th>
                <th className="px-4 py-2.5 font-medium">Quem gerou</th>
                <th className="px-4 py-2.5 font-medium">NF Remessa</th>
                <th className="px-4 py-2.5 font-medium text-right">Aparelhos</th>
                <th className="px-4 py-2.5 font-medium text-right">Planilha</th>
              </tr>
            </thead>
            <tbody>
              {envios.map((e) => (
                <tr key={e.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {formatarDataHoraBrasilia(e.enviado_em)}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {nomeUsuario(e.usuarios)}
                  </td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: "var(--ink)" }}>
                    {e.nf_remessa_allied}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                    {e.quantidade_aparelhos}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {e.arquivo_path ? (
                      <button
                        type="button"
                        onClick={() => baixar(e)}
                        disabled={baixando === e.id}
                        title="Baixar essa planilha de novo"
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
                        style={{ color: "var(--accent2)" }}
                      >
                        {baixando === e.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        Baixar
                      </button>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-xs"
                        style={{ color: "var(--muted)" }}
                        title="O arquivo não ficou salvo no momento desse envio"
                      >
                        <AlertTriangle size={11} />
                        Indisponível
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {envios && envios.length > 0 && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <ArrowLeftRight size={12} />
          {envios.length} planilha(s) gerada(s) no total.
        </p>
      )}
    </div>
  );
}
