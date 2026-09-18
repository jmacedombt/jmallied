"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

type Usuario = { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;

function nomeUsuario(usuarios: Usuario): string {
  const u = Array.isArray(usuarios) ? usuarios[0] : usuarios;
  return u ? `${u.nome} ${u.sobrenome}` : "—";
}

type Geracao = {
  id: string;
  gerado_em: string;
  quantidade_aprovados: number;
  quantidade_recusados: number;
  nfs_remessa: string[];
  nome_arquivo: string;
  usuarios: Usuario;
};

// Tela "Modelo de Retorno" (menu Operacional) — histórico de toda
// planilha "Modelo de Retorno" já emitida em Ag. Emissão de Nota Fiscal
// (botão "Emitir planilha de retorno"), mais recente primeiro. Só
// mostra os últimos 60 dias (retenção — ver migration 0049 e a rota de
// API, que já filtram por data); clicar em "Baixar" remonta a mesma
// planilha de novo, a partir do snapshot salvo na hora da emissão.
export default function PainelModeloRetorno() {
  const [geracoes, setGeracoes] = useState<Geracao[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/operacional/modelo-retorno");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível carregar o histórico.");
      } else {
        setGeracoes(data.geracoes);
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function baixar(geracao: Geracao) {
    setBaixando(geracao.id);
    try {
      const res = await fetch(`/api/operacional/modelo-retorno/${geracao.id}/download`);
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
      link.download = geracao.nome_arquivo;
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
        Toda vez que a planilha "Modelo de Retorno" é emitida em Ag. Emissão de Nota Fiscal, fica registrada aqui
        com data e hora — dá pra baixar de novo quando precisar. Os registros ficam disponíveis por 60 dias.
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
        ) : !geracoes || geracoes.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: "var(--muted)" }}>
            Nenhuma planilha "Modelo de Retorno" emitida nos últimos 60 dias.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-4 py-2.5 font-medium">Data/hora</th>
                <th className="px-4 py-2.5 font-medium">Quem gerou</th>
                <th className="px-4 py-2.5 font-medium">NF Remessa</th>
                <th className="px-4 py-2.5 font-medium text-right">Aprovados</th>
                <th className="px-4 py-2.5 font-medium text-right">Recusados</th>
                <th className="px-4 py-2.5 font-medium text-right">Planilha</th>
              </tr>
            </thead>
            <tbody>
              {geracoes.map((g) => (
                <tr key={g.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {formatarDataHoraBrasilia(g.gerado_em)}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {nomeUsuario(g.usuarios)}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    <span className="truncate block max-w-[320px]" title={g.nfs_remessa.join(", ")}>
                      {g.nfs_remessa.length > 0 ? g.nfs_remessa.join(", ") : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                    {g.quantidade_aprovados}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                    {g.quantidade_recusados}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => baixar(g)}
                      disabled={baixando === g.id}
                      title="Baixar essa planilha de novo"
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
                      style={{ color: "var(--accent2)" }}
                    >
                      {baixando === g.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      Baixar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {geracoes && geracoes.length > 0 && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <FileSpreadsheet size={12} />
          {geracoes.length} planilha(s) nos últimos 60 dias.
        </p>
      )}
    </div>
  );
}
