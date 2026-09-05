"use client";

import { useState } from "react";
import { ChevronLeft, History } from "lucide-react";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

type Usuario = { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;

type RecalculoResumo = {
  id: string;
  executado_em: string;
  pecas_verificadas: number;
  pecas_alteradas: number;
  usuarios: Usuario;
};

type PecaDetalhe = {
  id: string;
  custo_peca_samsung_anterior: number | null;
  custo_peca_samsung_novo: number | null;
  valor_com_margem_anterior: number | null;
  valor_com_margem_novo: number | null;
  custo_peca_allied_anterior: number | null;
  custo_peca_allied_novo: number | null;
  valor_imposto_anterior: number | null;
  valor_imposto_novo: number | null;
  bid_pecas: { modelo: string; part_number: string } | { modelo: string; part_number: string }[] | null;
};

function nomeUsuario(usuarios: Usuario): string {
  const u = Array.isArray(usuarios) ? usuarios[0] : usuarios;
  return u ? `${u.nome} ${u.sobrenome}` : "—";
}

function formatarMoeda(valor: number | null): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function HistoricoRecalculosBid() {
  const [aberto, setAberto] = useState(false);

  const [carregandoLista, setCarregandoLista] = useState(false);
  const [lista, setLista] = useState<RecalculoResumo[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [paginaLista, setPaginaLista] = useState(1);
  const [totalPaginasLista, setTotalPaginasLista] = useState(1);

  const [selecionado, setSelecionado] = useState<RecalculoResumo | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [pecas, setPecas] = useState<PecaDetalhe[] | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [paginaDetalhe, setPaginaDetalhe] = useState(1);
  const [totalPaginasDetalhe, setTotalPaginasDetalhe] = useState(1);

  async function abrir() {
    setAberto(true);
    setSelecionado(null);
    setPecas(null);
    setCarregandoLista(true);
    setErroLista(null);
    try {
      const res = await fetch("/api/bases/bid/recalculos?pagina=1");
      const data = await res.json();
      if (!res.ok) {
        setErroLista(data.error || "Não foi possível carregar o histórico.");
      } else {
        setLista(data.recalculos);
        setPaginaLista(1);
        setTotalPaginasLista(data.totalPaginas);
      }
    } catch {
      setErroLista("Falha de conexão. Tente novamente.");
    }
    setCarregandoLista(false);
  }

  async function carregarMaisLista() {
    const proxima = paginaLista + 1;
    setCarregandoLista(true);
    try {
      const res = await fetch(`/api/bases/bid/recalculos?pagina=${proxima}`);
      const data = await res.json();
      if (res.ok) {
        setLista((atual) => [...(atual ?? []), ...data.recalculos]);
        setPaginaLista(proxima);
        setTotalPaginasLista(data.totalPaginas);
      }
    } catch {
      // silencioso — o usuário pode tentar "carregar mais" de novo
    }
    setCarregandoLista(false);
  }

  async function abrirDetalhe(recalculo: RecalculoResumo) {
    setSelecionado(recalculo);
    setPecas(null);
    setCarregandoDetalhe(true);
    setErroDetalhe(null);
    try {
      const res = await fetch(`/api/bases/bid/recalculos/${recalculo.id}?pagina=1`);
      const data = await res.json();
      if (!res.ok) {
        setErroDetalhe(data.error || "Não foi possível carregar o detalhe desse recálculo.");
      } else {
        setPecas(data.pecas);
        setPaginaDetalhe(1);
        setTotalPaginasDetalhe(data.totalPaginas);
      }
    } catch {
      setErroDetalhe("Falha de conexão. Tente novamente.");
    }
    setCarregandoDetalhe(false);
  }

  async function carregarMaisDetalhe() {
    if (!selecionado) return;
    const proxima = paginaDetalhe + 1;
    setCarregandoDetalhe(true);
    try {
      const res = await fetch(`/api/bases/bid/recalculos/${selecionado.id}?pagina=${proxima}`);
      const data = await res.json();
      if (res.ok) {
        setPecas((atual) => [...(atual ?? []), ...data.pecas]);
        setPaginaDetalhe(proxima);
        setTotalPaginasDetalhe(data.totalPaginas);
      }
    } catch {
      // silencioso
    }
    setCarregandoDetalhe(false);
  }

  function fechar() {
    setAberto(false);
    setSelecionado(null);
    setPecas(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition hover:border-[var(--accent2)]"
        style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }}
      >
        <History size={13} />
        Ver histórico de recálculos
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={fechar}
        >
          <div
            className="w-full rounded-2xl border shadow-2xl p-5 flex flex-col"
            style={{
              background: "var(--surface)",
              borderColor: "var(--line)",
              maxWidth: selecionado ? "56rem" : "32rem",
              maxHeight: "min(640px, calc(100vh - 2rem))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {!selecionado ? (
              <>
                <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>
                  Histórico de recálculos do BID
                </h3>
                <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
                  Cada clique em &quot;Recalcular&quot; que mudou pelo menos uma peça fica registrado aqui. Clique num
                  item pra ver, peça a peça, o valor que era e o valor que passou a ser.
                </p>

                <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
                  {carregandoLista && !lista && (
                    <p className="text-xs py-8 text-center" style={{ color: "var(--muted)" }}>
                      Carregando...
                    </p>
                  )}
                  {erroLista && (
                    <p className="text-xs p-3 text-red-400">{erroLista}</p>
                  )}
                  {lista && lista.length === 0 && (
                    <p className="text-xs py-8 text-center" style={{ color: "var(--muted)" }}>
                      Nenhum recálculo registrado ainda.
                    </p>
                  )}
                  {lista && lista.length > 0 && (
                    <ul>
                      {lista.map((r) => (
                        <li key={r.id} className="border-t first:border-t-0" style={{ borderColor: "var(--line)" }}>
                          <button
                            type="button"
                            onClick={() => abrirDetalhe(r)}
                            className="w-full text-left px-3.5 py-2.5 text-xs transition hover:bg-[var(--surface2)]"
                          >
                            <p style={{ color: "var(--ink)" }}>
                              <strong>{r.pecas_alteradas}</strong> de {r.pecas_verificadas} peça(s) atualizada(s)
                            </p>
                            <p className="mt-0.5" style={{ color: "var(--muted)" }}>
                              {formatarDataHoraBrasilia(r.executado_em)} · {nomeUsuario(r.usuarios)}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {lista && paginaLista < totalPaginasLista && (
                  <button
                    type="button"
                    onClick={carregarMaisLista}
                    disabled={carregandoLista}
                    className="mt-3 text-xs rounded-lg border px-3 py-1.5 self-center transition hover:border-[var(--accent2)] disabled:opacity-50"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  >
                    {carregandoLista ? "Carregando..." : "Carregar mais"}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelecionado(null);
                    setPecas(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs mb-2 self-start transition hover:text-[var(--accent2)]"
                  style={{ color: "var(--muted)" }}
                >
                  <ChevronLeft size={14} /> Voltar
                </button>

                <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>
                  Recálculo de {formatarDataHoraBrasilia(selecionado.executado_em)}
                </h3>
                <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
                  Executado por {nomeUsuario(selecionado.usuarios)} — {selecionado.pecas_alteradas} de{" "}
                  {selecionado.pecas_verificadas} peça(s) tiveram o valor atualizado.
                </p>

                <div className="flex-1 min-h-0 overflow-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
                  {carregandoDetalhe && !pecas && (
                    <p className="text-xs py-8 text-center" style={{ color: "var(--muted)" }}>
                      Carregando...
                    </p>
                  )}
                  {erroDetalhe && <p className="text-xs p-3 text-red-400">{erroDetalhe}</p>}
                  {pecas && (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                          <th className="px-3 py-1.5 font-medium sticky top-0" style={{ background: "var(--surface2)" }}>
                            Modelo / Part Number
                          </th>
                          <th className="px-3 py-1.5 font-medium text-right sticky top-0" style={{ background: "var(--surface2)" }}>
                            Custo Samsung
                          </th>
                          <th className="px-3 py-1.5 font-medium text-right sticky top-0" style={{ background: "var(--surface2)" }}>
                            Custo Peça (Allied)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pecas.map((p) => {
                          const peca = Array.isArray(p.bid_pecas) ? p.bid_pecas[0] : p.bid_pecas;
                          const anterior = p.custo_peca_allied_anterior ?? p.valor_com_margem_anterior;
                          const novo = p.custo_peca_allied_novo ?? p.valor_com_margem_novo;
                          const aumentou = anterior != null && novo != null && novo > anterior;
                          const diminuiu = anterior != null && novo != null && novo < anterior;
                          return (
                            <tr key={p.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                              <td className="px-3 py-1.5" style={{ color: "var(--ink)" }}>
                                {peca ? `${peca.modelo} — ${peca.part_number}` : "—"}
                              </td>
                              <td className="px-3 py-1.5 text-right" style={{ color: "var(--muted)" }}>
                                {formatarMoeda(p.custo_peca_samsung_anterior)} → {formatarMoeda(p.custo_peca_samsung_novo)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-medium" style={{ color: "var(--ink)" }}>
                                {formatarMoeda(anterior)} → {formatarMoeda(novo)}{" "}
                                {aumentou && <span style={{ color: "#ef4444" }}>▲</span>}
                                {diminuiu && <span style={{ color: "#22c55e" }}>▼</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {pecas && paginaDetalhe < totalPaginasDetalhe && (
                  <button
                    type="button"
                    onClick={carregarMaisDetalhe}
                    disabled={carregandoDetalhe}
                    className="mt-3 text-xs rounded-lg border px-3 py-1.5 self-center transition hover:border-[var(--accent2)] disabled:opacity-50"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  >
                    {carregandoDetalhe ? "Carregando..." : "Carregar mais"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
