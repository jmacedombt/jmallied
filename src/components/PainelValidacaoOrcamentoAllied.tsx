"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

type Usuario = { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;

function nomeUsuario(usuarios: Usuario): string {
  const u = Array.isArray(usuarios) ? usuarios[0] : usuarios;
  return u ? `${u.nome} ${u.sobrenome}` : "—";
}

type ResumoNf = {
  nf_remessa_allied: string;
  total: number;
  aprovados: number;
  contra_proposta: number;
  reprovados: number;
};

type Upload = {
  id: string;
  nome_arquivo: string;
  arquivo_path: string | null;
  enviado_em: string;
  linhas_no_arquivo: number;
  linhas_nao_reconhecidas: number;
  casadas: number;
  nao_encontradas: number;
  aprovados: number;
  contra_proposta: number;
  reprovados: number;
  resumo_por_nf: ResumoNf[];
  usuarios: Usuario;
};

function formatarPercentual(parte: number, total: number): string {
  if (total === 0) return "—";
  return `${((parte / total) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// Tela "Validação de Orçamento (Allied)" (menu Operacional, pedido
// explícito) — histórico de cada arquivo de resultado (Aprovado/Contra
// Proposta/Reprovado) que a Allied manda de volta e é subido em
// "3 - Ag. Resposta de Orçamento" > Upload (aprovação de orçamentos): o
// arquivo original + um resumo (quantidade e percentual de cada
// resultado), detalhado por NF Remessa, já que um único arquivo
// normalmente mistura vários lotes. Também visível pro login ALLIED
// (pedido explícito).
export default function PainelValidacaoOrcamentoAllied() {
  const [uploads, setUploads] = useState<Upload[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/operacional/orcamentos/aprovacoes-uploads");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível carregar o histórico.");
      } else {
        setUploads(data.uploads);
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function baixar(upload: Upload) {
    setBaixando(upload.id);
    try {
      const res = await fetch(`/api/operacional/orcamentos/aprovacoes-uploads/${upload.id}/download`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErro(data?.error || "Não foi possível baixar esse arquivo.");
        setBaixando(null);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = upload.nome_arquivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Falha de conexão ao baixar o arquivo.");
    }
    setBaixando(null);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Toda vez que um arquivo de resultado da Allied é subido em &quot;3 - Ag. Resposta de Orçamento&quot; (Upload
        aprovação de orçamentos), fica registrado aqui com data e hora, mais um resumo já calculado — quantidade e
        percentual de aprovados, recusados e contra proposta, detalhado por NF Remessa (um arquivo costuma misturar
        vários lotes).
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
        ) : !uploads || uploads.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: "var(--muted)" }}>
            Nenhum arquivo de aprovação subido ainda.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-4 py-2.5 font-medium"></th>
                <th className="px-4 py-2.5 font-medium">Data/hora</th>
                <th className="px-4 py-2.5 font-medium">Quem</th>
                <th className="px-4 py-2.5 font-medium text-right">Linhas</th>
                <th className="px-4 py-2.5 font-medium text-right">Aprovados</th>
                <th className="px-4 py-2.5 font-medium text-right">Contra Proposta</th>
                <th className="px-4 py-2.5 font-medium text-right">Recusados</th>
                <th className="px-4 py-2.5 font-medium text-right">Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => {
                const total = u.casadas;
                const aberto = expandido === u.id;
                return (
                  <>
                    <tr
                      key={u.id}
                      className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                      style={{ borderColor: "var(--line)" }}
                      onClick={() => setExpandido(aberto ? null : u.id)}
                    >
                      <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                        {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                        {formatarDataHoraBrasilia(u.enviado_em)}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                        {nomeUsuario(u.usuarios)}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                        {u.linhas_no_arquivo}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ color: "#16a34a" }}>
                        {u.aprovados}{" "}
                        <span style={{ color: "var(--muted)" }}>({formatarPercentual(u.aprovados, total)})</span>
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ color: "var(--accent2)" }}>
                        {u.contra_proposta}{" "}
                        <span style={{ color: "var(--muted)" }}>({formatarPercentual(u.contra_proposta, total)})</span>
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ color: "#ef4444" }}>
                        {u.reprovados}{" "}
                        <span style={{ color: "var(--muted)" }}>({formatarPercentual(u.reprovados, total)})</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {u.arquivo_path ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              baixar(u);
                            }}
                            disabled={baixando === u.id}
                            title="Baixar o arquivo original desse upload"
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
                            style={{ color: "var(--accent2)" }}
                          >
                            {baixando === u.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                            Baixar
                          </button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs"
                            style={{ color: "var(--muted)" }}
                            title="O arquivo não ficou salvo no momento desse upload"
                          >
                            <AlertTriangle size={11} />
                            Indisponível
                          </span>
                        )}
                      </td>
                    </tr>
                    {aberto && (
                      <tr style={{ background: "var(--surface2)" }}>
                        <td colSpan={8} className="px-4 py-3">
                          {u.linhas_nao_reconhecidas > 0 || u.nao_encontradas > 0 ? (
                            <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                              <AlertTriangle size={12} />
                              {u.linhas_nao_reconhecidas > 0 && `${u.linhas_nao_reconhecidas} linha(s) não reconhecida(s) no arquivo. `}
                              {u.nao_encontradas > 0 && `${u.nao_encontradas} OS Reparadora não encontrada(s) no sistema.`}
                            </p>
                          ) : null}
                          {u.resumo_por_nf.length === 0 ? (
                            <p className="text-xs" style={{ color: "var(--muted)" }}>
                              Nenhuma linha casada com um NF Remessa.
                            </p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left" style={{ color: "var(--muted)" }}>
                                  <th className="px-2 py-1.5 font-medium">NF Remessa</th>
                                  <th className="px-2 py-1.5 font-medium text-right">Total</th>
                                  <th className="px-2 py-1.5 font-medium text-right">Aprovados</th>
                                  <th className="px-2 py-1.5 font-medium text-right">Contra Proposta</th>
                                  <th className="px-2 py-1.5 font-medium text-right">Recusados</th>
                                </tr>
                              </thead>
                              <tbody>
                                {u.resumo_por_nf.map((nf) => (
                                  <tr key={nf.nf_remessa_allied} className="border-t" style={{ borderColor: "var(--line)" }}>
                                    <td className="px-2 py-1.5 font-mono" style={{ color: "var(--ink)" }}>
                                      {nf.nf_remessa_allied}
                                    </td>
                                    <td className="px-2 py-1.5 text-right" style={{ color: "var(--ink)" }}>
                                      {nf.total}
                                    </td>
                                    <td className="px-2 py-1.5 text-right" style={{ color: "#16a34a" }}>
                                      {nf.aprovados} ({formatarPercentual(nf.aprovados, nf.total)})
                                    </td>
                                    <td className="px-2 py-1.5 text-right" style={{ color: "var(--accent2)" }}>
                                      {nf.contra_proposta} ({formatarPercentual(nf.contra_proposta, nf.total)})
                                    </td>
                                    <td className="px-2 py-1.5 text-right" style={{ color: "#ef4444" }}>
                                      {nf.reprovados} ({formatarPercentual(nf.reprovados, nf.total)})
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {uploads && uploads.length > 0 && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <FileSpreadsheet size={12} />
          {uploads.length} arquivo(s) no total. Clique numa linha pra ver o detalhamento por NF Remessa.
        </p>
      )}
    </div>
  );
}
