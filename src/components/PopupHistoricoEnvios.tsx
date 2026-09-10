"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, History, Loader2, Search, X } from "lucide-react";
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
  email_enviado: boolean;
  email_erro: string | null;
  usuarios: Usuario;
};

// Pop-up de Histórico — botão em Validação de Orçamentos. Lista todo
// envio já confirmado ("Confirmar Envio"), mais recente primeiro, com
// filtro por NF Remessa; clicar num item baixa de novo o Excel daquele
// envio (mesmo arquivo mandado por e-mail na hora, agora persistido —
// ver lib/orcamentoEnvio.ts). Envios de antes dessa funcionalidade
// existir não aparecem aqui, porque esse registro nunca foi guardado.
export default function PopupHistoricoEnvios({ onFechar }: { onFechar: () => void }) {
  const [envios, setEnvios] = useState<Envio[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroNf, setFiltroNf] = useState("");
  const [baixando, setBaixando] = useState<string | null>(null);

  async function carregar(nf: string) {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/historico-envios?tipo=orcamento${nf ? `&nf=${encodeURIComponent(nf)}` : ""}`);
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
    carregar("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => carregar(filtroNf), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroNf]);

  async function baixar(envio: Envio) {
    setBaixando(envio.id);
    try {
      const res = await fetch(`/api/operacional/orcamentos/historico-envios/${envio.id}/download`);
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
      link.download = `orcamentos-${envio.nf_remessa_allied}.xlsx`;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-xl rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <History size={18} style={{ color: "var(--accent2)" }} />
            Histórico de envios
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input
            type="text"
            value={filtroNf}
            onChange={(e) => setFiltroNf(e.target.value)}
            placeholder="Filtrar por NF Remessa..."
            className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none focus:border-[var(--accent2)] transition"
            style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
          />
        </div>

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{erro}</p>
        )}

        <div className="rounded-xl border overflow-hidden max-h-96 overflow-y-auto" style={{ borderColor: "var(--line)" }}>
          {carregando ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: "var(--muted)" }}>
              <Loader2 size={16} className="animate-spin" />
              Carregando...
            </div>
          ) : !envios || envios.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: "var(--muted)" }}>
              Nenhum envio confirmado ainda.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-3 py-2 font-medium">NF Remessa</th>
                  <th className="px-3 py-2 font-medium">Data/hora</th>
                  <th className="px-3 py-2 font-medium">Quem</th>
                  <th className="px-3 py-2 font-medium text-right">Aparelhos</th>
                  <th className="px-3 py-2 font-medium text-right">Arquivo</th>
                </tr>
              </thead>
              <tbody>
                {envios.map((e) => (
                  <tr key={e.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-3 py-2 font-mono" style={{ color: "var(--ink)" }}>
                      {e.nf_remessa_allied}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                      {formatarDataHoraBrasilia(e.enviado_em)}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                      {nomeUsuario(e.usuarios)}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                      {e.quantidade_aparelhos}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {e.arquivo_path ? (
                        <button
                          type="button"
                          onClick={() => baixar(e)}
                          disabled={baixando === e.id}
                          title="Baixar o Excel desse envio"
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
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
      </div>
    </div>
  );
}
