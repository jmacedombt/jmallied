"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowUpDown, CheckCircle2, Database, Loader2, RefreshCw, Timer, Trash2 } from "lucide-react";
import {
  GRUPOS_ZERAR,
  MESES_COMPACTACAO_PADRAO,
  formatarBytes,
  type GrupoZerar,
  type LinhaCompactacao,
  type TamanhoTabela,
} from "@/lib/manutencao";
import PopupConfirmarZerar from "@/components/PopupConfirmarZerar";
import type { ResultadoCorrecaoOrdem } from "@/lib/corrigirOrdemPlanilhas";

function Cartao({ titulo, icone: Icone, children }: { titulo: string; icone: typeof Database; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <h2 className="text-sm font-semibold flex items-center gap-2 mb-4" style={{ color: "var(--ink)" }}>
        <Icone size={16} style={{ color: "var(--accent2)" }} />
        {titulo}
      </h2>
      {children}
    </div>
  );
}

// Painel de Sistema > Manutenção do Banco: três blocos independentes —
// tamanho de cada tabela (só leitura), zerar por completo um grupo de
// dados de implantação (trava forte, ver PopupConfirmarZerar) e
// compactar histórico/log antigo (apaga por prazo + ANALYZE, não mexe
// em dado operacional/mestre). Ver src/lib/manutencao.ts e a migration
// 0030_manutencao_banco.sql pras regras completas de cada rotina.
export default function PainelManutencaoBanco() {
  const [tamanho, setTamanho] = useState<TamanhoTabela[] | null>(null);
  const [carregandoTamanho, setCarregandoTamanho] = useState(true);
  const [erroTamanho, setErroTamanho] = useState<string | null>(null);

  const [zerando, setZerando] = useState<GrupoZerar | null>(null);
  const [carregandoZerar, setCarregandoZerar] = useState(false);
  const [erroZerar, setErroZerar] = useState<string | null>(null);
  const [sucessoZerar, setSucessoZerar] = useState<GrupoZerar | null>(null);

  const [meses, setMeses] = useState(String(MESES_COMPACTACAO_PADRAO));
  const [carregandoCompactar, setCarregandoCompactar] = useState(false);
  const [erroCompactar, setErroCompactar] = useState<string | null>(null);
  const [resultadoCompactar, setResultadoCompactar] = useState<LinhaCompactacao[] | null>(null);

  const [carregandoOrdem, setCarregandoOrdem] = useState(false);
  const [erroOrdem, setErroOrdem] = useState<string | null>(null);
  const [resultadoOrdem, setResultadoOrdem] = useState<ResultadoCorrecaoOrdem | null>(null);

  const buscarTamanho = useCallback(async () => {
    setCarregandoTamanho(true);
    setErroTamanho(null);
    try {
      const res = await fetch("/api/sistema/manutencao/tamanho");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroTamanho(data?.error || "Não foi possível carregar o tamanho das tabelas.");
        return;
      }
      setTamanho(data.tabelas ?? []);
    } catch {
      setErroTamanho("Falha de conexão. Tente novamente.");
    } finally {
      setCarregandoTamanho(false);
    }
  }, []);

  useEffect(() => {
    buscarTamanho();
  }, [buscarTamanho]);

  async function confirmarZerar(grupo: GrupoZerar) {
    setCarregandoZerar(true);
    setErroZerar(null);
    try {
      const res = await fetch("/api/sistema/manutencao/zerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo, confirmacao: "APAGAR" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroZerar(data?.error || "Não foi possível zerar esse grupo.");
        setCarregandoZerar(false);
        return;
      }
      setZerando(null);
      setCarregandoZerar(false);
      setSucessoZerar(grupo);
      setTimeout(() => setSucessoZerar(null), 5000);
      buscarTamanho();
    } catch {
      setErroZerar("Falha de conexão. Tente novamente.");
      setCarregandoZerar(false);
    }
  }

  async function rodarCompactacao() {
    const mesesNum = Number(meses);
    if (!Number.isFinite(mesesNum) || mesesNum < 1) {
      setErroCompactar("Informe um prazo válido (mínimo 1 mês).");
      return;
    }
    setCarregandoCompactar(true);
    setErroCompactar(null);
    setResultadoCompactar(null);
    try {
      const res = await fetch("/api/sistema/manutencao/compactar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meses: mesesNum }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroCompactar(data?.error || "Não foi possível rodar a compactação.");
        return;
      }
      setResultadoCompactar(data.resultados ?? []);
      buscarTamanho();
    } catch {
      setErroCompactar("Falha de conexão. Tente novamente.");
    } finally {
      setCarregandoCompactar(false);
    }
  }

  async function rodarCorrecaoOrdem() {
    setCarregandoOrdem(true);
    setErroOrdem(null);
    setResultadoOrdem(null);
    try {
      const res = await fetch("/api/sistema/manutencao/corrigir-ordem-planilhas", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroOrdem(data?.error || "Não foi possível rodar a correção.");
        return;
      }
      setResultadoOrdem(data.resultado ?? null);
    } catch {
      setErroOrdem("Falha de conexão. Tente novamente.");
    } finally {
      setCarregandoOrdem(false);
    }
  }

  const totalBytes = (tamanho ?? []).reduce((soma, t) => soma + Number(t.tamanho_total_bytes), 0);
  const totalLinhasRemovidas = (resultadoCompactar ?? []).reduce((soma, r) => soma + Number(r.linhas_removidas), 0);
  const grupoZerandoInfo = GRUPOS_ZERAR.find((g) => g.chave === zerando);

  return (
    <div className="space-y-5 max-w-4xl">
      <Cartao titulo="Espaço em disco por tabela" icone={Database}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {tamanho ? (
              <>
                {tamanho.length} tabela(s) — <strong style={{ color: "var(--ink)" }}>{formatarBytes(totalBytes)}</strong> no
                total (dados + índices)
              </>
            ) : (
              "Carregando..."
            )}
          </p>
          <button
            type="button"
            onClick={buscarTamanho}
            disabled={carregandoTamanho}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent2)] disabled:opacity-50"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            {carregandoTamanho ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Atualizar
          </button>
        </div>

        {erroTamanho && <p className="text-xs text-red-400 mb-3">{erroTamanho}</p>}

        {tamanho && (
          <div className="rounded-xl border overflow-hidden max-h-96 overflow-y-auto" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left sticky top-0" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-3 py-2 font-medium">Tabela</th>
                  <th className="px-3 py-2 font-medium text-right">Linhas (estimado)</th>
                  <th className="px-3 py-2 font-medium text-right">Dados</th>
                  <th className="px-3 py-2 font-medium text-right">Índices</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {tamanho.map((t) => (
                  <tr key={t.tabela} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-3 py-2 font-mono" style={{ color: "var(--ink)" }}>
                      {t.tabela}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>
                      {t.linhas.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>
                      {t.tamanho_dados}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>
                      {t.tamanho_indices}
                    </td>
                    <td className="px-3 py-2 text-right font-medium" style={{ color: "var(--ink)" }}>
                      {t.tamanho_total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Zerar dados de implantação" icone={Trash2}>
        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Apaga por completo um dos grupos abaixo — pensado pra limpar tudo que foi testado antes de ir pra produção.
          Ação permanente e sem volta. Nunca mexe em usuários nem em nenhuma configuração do sistema.
        </p>
        <div className="space-y-2.5">
          {GRUPOS_ZERAR.map((g) => (
            <div
              key={g.chave}
              className="flex items-center justify-between gap-4 rounded-xl border p-3.5"
              style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                  {g.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  {g.descricao}
                </p>
                {sucessoZerar === g.chave && (
                  <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: "#22c55e" }}>
                    <CheckCircle2 size={12} /> Zerado com sucesso.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setErroZerar(null);
                  setZerando(g.chave);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium text-white transition shrink-0"
                style={{ background: "#dc2626" }}
              >
                <Trash2 size={13} />
                Zerar
              </button>
            </div>
          ))}
        </div>
      </Cartao>

      <Cartao titulo="Compactar histórico antigo" icone={Timer}>
        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Apaga registros de histórico/log (variação de valor do BID, status de orçamento, importações, e-mails
          enviados etc.) mais antigos que o prazo abaixo, e atualiza as estatísticas do banco pras consultas
          continuarem rápidas. Nunca apaga orçamento, peça ou aparelho — só o log/histórico em volta deles.
        </p>
        <div className="flex items-end gap-3 flex-wrap mb-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Considerar "antigo" a partir de (meses)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={meses}
              onChange={(e) => setMeses(e.target.value.replace(/\D/g, ""))}
              className="w-28 rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] transition"
              style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
            />
          </div>
          <button
            type="button"
            onClick={rodarCompactacao}
            disabled={carregandoCompactar}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
            style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
          >
            {carregandoCompactar ? <Loader2 size={14} className="animate-spin" /> : <Timer size={14} />}
            Rodar agora
          </button>
        </div>

        {erroCompactar && <p className="text-xs text-red-400 mb-3">{erroCompactar}</p>}

        {resultadoCompactar && (
          <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
            <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "#22c55e" }}>
              <CheckCircle2 size={13} />
              {totalLinhasRemovidas.toLocaleString("pt-BR")} registro(s) removido(s) no total.
            </p>
            <div className="space-y-1">
              {resultadoCompactar
                .filter((r) => r.linhas_removidas > 0)
                .map((r) => (
                  <div key={r.tabela} className="text-xs flex justify-between" style={{ color: "var(--muted)" }}>
                    <span className="font-mono">{r.tabela}</span>
                    <span>{Number(r.linhas_removidas).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              {resultadoCompactar.every((r) => r.linhas_removidas === 0) && (
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Nenhum registro passou do prazo dessa vez.
                </p>
              )}
            </div>
          </div>
        )}
      </Cartao>

      <Cartao titulo="Corrigir ordem das planilhas já geradas" icone={ArrowUpDown}>
        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          As planilhas de &quot;Confirmar Envio&quot; (Histórico de Envios) e &quot;Enviar Contra Proposta&quot; agora sempre
          saem na mesma ordem da planilha original de Base de Orçamentos. Essa correção reordena, sem recalcular nada
          (nenhuma peça, valor ou decisão muda), as que já tinham sido geradas antes dessa mudança. Pode rodar mais de
          uma vez sem problema — o que já estiver certo não muda.
        </p>
        <button
          type="button"
          onClick={rodarCorrecaoOrdem}
          disabled={carregandoOrdem}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
          style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
        >
          {carregandoOrdem ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpDown size={14} />}
          Rodar correção agora
        </button>

        {erroOrdem && (
          <p className="text-xs text-red-400 mt-3 flex items-start gap-1.5">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            {erroOrdem}
          </p>
        )}

        {resultadoOrdem && (
          <div className="rounded-xl border p-3.5 mt-3 space-y-1.5" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
            <p className="text-xs font-medium flex items-center gap-1.5" style={{ color: "#22c55e" }}>
              <CheckCircle2 size={13} />
              Concluído.
            </p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Confirmar Envio: {resultadoOrdem.enviosCorrigidos} de {resultadoOrdem.enviosVerificados} planilha(s) corrigida(s).
            </p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Contra Proposta: {resultadoOrdem.geracoesCorrigidas} de {resultadoOrdem.geracoesVerificadas} geração/gerações corrigida(s).
            </p>
            {resultadoOrdem.geracoesAparelhosAdicionados > 0 && (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {resultadoOrdem.geracoesAparelhosAdicionados} aparelho(s) que só foram reprovados depois da geração original foram adicionados às planilhas.
              </p>
            )}
            {resultadoOrdem.geracoesMotivoCorrigido > 0 && (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {resultadoOrdem.geracoesMotivoCorrigido} linha(s) de Contra Proposta recusada tiveram o motivo atualizado pra frase padrão.
              </p>
            )}
            {resultadoOrdem.geracoesObsAprovadoCorrigido > 0 && (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {resultadoOrdem.geracoesObsAprovadoCorrigido} linha(s) de aprovado inicialmente tiveram o OBS atualizado pra &quot;Allied Aprovou em: ...&quot;.
              </p>
            )}
            {resultadoOrdem.geracoesObsContraPropostaAceitaCorrigido > 0 && (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {resultadoOrdem.geracoesObsContraPropostaAceitaCorrigido} linha(s) de Contra Proposta aceita tiveram o OBS e o destaque da peça atualizados.
              </p>
            )}
            {(resultadoOrdem.enviosComFalha.length > 0 || resultadoOrdem.geracoesComFalha.length > 0) && (
              <div className="pt-1.5 mt-1.5 border-t" style={{ borderColor: "var(--line)" }}>
                <p className="text-xs font-medium mb-1" style={{ color: "#ef4444" }}>
                  Falharam (não foram alteradas):
                </p>
                {[...resultadoOrdem.enviosComFalha, ...resultadoOrdem.geracoesComFalha].map((f) => (
                  <p key={f.id} className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                    NF {f.nf_remessa_allied}: {f.erro}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </Cartao>

      {grupoZerandoInfo && (
        <PopupConfirmarZerar
          titulo={`Zerar ${grupoZerandoInfo.label}`}
          tabelas={grupoZerandoInfo.tabelas}
          carregando={carregandoZerar}
          erro={erroZerar}
          onConfirmar={() => confirmarZerar(grupoZerandoInfo.chave)}
          onFechar={() => !carregandoZerar && setZerando(null)}
        />
      )}
    </div>
  );
}
