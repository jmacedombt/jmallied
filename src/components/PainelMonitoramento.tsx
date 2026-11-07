"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Database, ExternalLink, Github, Loader2, RefreshCcw, Server, Timer } from "lucide-react";
import { INTERVALOS_AUTOMATICOS, INTERVALOS_ANTERIORES_MS, LIMITES, chamadasPorHora } from "@/lib/consumo";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

type Resposta = {
  geradoEm: string;
  supabase: {
    ref: string | null;
    uso: {
      banco_bytes: number;
      storage_bytes: number;
      storage_arquivos: number;
      storage_por_bucket: { bucket: string; bytes: number; arquivos: number }[];
      usuarios_login: number;
      usuarios_ativos_30d: number;
    } | null;
    erro: string | null;
    maioresTabelas: { tabela: string; linhas: number; tamanho_total: string; tamanho_total_bytes: number }[];
  };
  vercel: { ambiente: string | null; regiao: string | null; commit: string | null; mensagemCommit: string | null; url: string | null };
  github: { repo: string; privado: boolean | null; tamanhoKb: number | null; atualizadoEm: string | null; erro: string | null };
};

function formatarBytes(b: number): string {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  return `${(b / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB`;
}

function corUso(p: number): string {
  if (p >= 80) return "#dc2626";
  if (p >= 60) return "#d97706";
  return "#16a34a";
}

function BarraUso({ rotulo, usado, limite, detalhe }: { rotulo: string; usado: number; limite: number; detalhe: string }) {
  const p = limite > 0 ? Math.min(100, (usado / limite) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{ color: "var(--ink)" }}>{rotulo}</span>
        <span className="font-semibold" style={{ color: corUso(p) }}>
          {p.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(p, 1)}%`, background: corUso(p) }} />
      </div>
      <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
        {detalhe}
      </p>
    </div>
  );
}

function Cartao({
  icone: Icone,
  titulo,
  plano,
  cor,
  link,
  rotuloLink,
  children,
}: {
  icone: typeof Server;
  titulo: string;
  plano: string;
  cor: string;
  link: string | null;
  rotuloLink: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-xl border p-5 overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: cor }} />
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="flex items-center gap-2 text-lg font-bold" style={{ color: "var(--ink)" }}>
            <Icone size={20} style={{ color: cor }} />
            {titulo}
          </p>
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            Plano {plano}
          </p>
        </div>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium whitespace-nowrap"
            style={{ borderColor: "var(--line)", color: "var(--accent2)" }}
          >
            {rotuloLink} <ExternalLink size={11} />
          </a>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ListaLimites({ itens }: { itens: readonly { chave: string; rotulo: string; limite: string; cuidado: string }[] }) {
  return (
    <table className="w-full text-xs">
      <tbody>
        {itens.map((i) => (
          <tr key={i.chave} className="border-t align-top" style={{ borderColor: "var(--line)" }}>
            <td className="py-1.5 pr-2 font-medium" style={{ color: "var(--ink)" }}>
              {i.rotulo}
            </td>
            <td className="py-1.5 pr-2 whitespace-nowrap" style={{ color: "var(--ink)" }}>
              {i.limite}
            </td>
            <td className="py-1.5" style={{ color: "var(--muted)" }}>
              {i.cuidado}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Regras({ regras }: { regras: readonly string[] }) {
  return (
    <ul className="space-y-1">
      {regras.map((r) => (
        <li key={r} className="flex gap-1.5 text-[11px]" style={{ color: "#b45309" }}>
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {r}
        </li>
      ))}
    </ul>
  );
}

export default function PainelMonitoramento() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // só consulta ao abrir a tela e no botão "Atualizar" — sem relógio, pra
  // o próprio monitoramento não gastar CPU na Vercel.
  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/sistema/monitoramento", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Não foi possível carregar o monitoramento.");
      setDados(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de conexão.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const uso = dados?.supabase.uso;
  const consumo = (Object.keys(INTERVALOS_AUTOMATICOS) as (keyof typeof INTERVALOS_AUTOMATICOS)[]).map((k) => ({
    chave: k,
    rotulo: INTERVALOS_AUTOMATICOS[k].rotulo,
    antes: chamadasPorHora(INTERVALOS_ANTERIORES_MS[k]),
    visivel: chamadasPorHora(INTERVALOS_AUTOMATICOS[k].visivelMs),
    oculta: chamadasPorHora(INTERVALOS_AUTOMATICOS[k].ocultaMs),
  }));
  const total = consumo.reduce(
    (s, c) => ({ antes: s.antes + c.antes, visivel: s.visivel + c.visivel, oculta: s.oculta + c.oculta }),
    { antes: 0, visivel: 0, oculta: 0 }
  );

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={carregar}
          disabled={carregando}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          {carregando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          Atualizar
        </button>
        {dados && (
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Consultado em {formatarDataHoraBrasilia(dados.geradoEm)}
          </span>
        )}
        {erro && <span className="text-xs text-red-500">{erro}</span>}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ---------------- VERCEL ---------------- */}
        <Cartao
          icone={Server}
          titulo="Vercel"
          plano={LIMITES.vercel.plano}
          cor="#111827"
          link="https://vercel.com/jmacedombt/jmallied"
          rotuloLink="Abrir painel"
        >
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Onde o site fica no ar. O consumo do mês só aparece no painel da Vercel, na aba <strong>Usage</strong>.
            Confira lá pelo menos 1 vez por semana.
          </p>
          {dados && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p style={{ color: "var(--muted)" }}>Versão no ar</p>
                <p className="font-mono font-semibold" style={{ color: "var(--ink)" }}>
                  {dados.vercel.commit ?? "—"}
                </p>
              </div>
              <div>
                <p style={{ color: "var(--muted)" }}>Região</p>
                <p className="font-semibold" style={{ color: "var(--ink)" }}>
                  {dados.vercel.regiao ?? "—"}
                </p>
              </div>
            </div>
          )}
          <ListaLimites itens={LIMITES.vercel.itens} />
          <Regras regras={LIMITES.vercel.regras} />
        </Cartao>

        {/* ---------------- SUPABASE ---------------- */}
        <Cartao
          icone={Database}
          titulo="Supabase"
          plano={LIMITES.supabase.plano}
          cor="#10b981"
          link={dados?.supabase.ref ? `https://supabase.com/dashboard/project/${dados.supabase.ref}` : "https://supabase.com/dashboard"}
          rotuloLink="Abrir painel"
        >
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Banco de dados e arquivos. Números medidos agora, direto no banco.
          </p>
          {dados?.supabase.erro && (
            <p className="text-xs text-red-500">
              {dados.supabase.erro} — confira se a migration 0085 foi rodada.
            </p>
          )}
          {uso && (
            <>
              <BarraUso
                rotulo="Banco de dados"
                usado={uso.banco_bytes}
                limite={LIMITES.supabase.bancoBytes}
                detalhe={`${formatarBytes(uso.banco_bytes)} de 500 MB`}
              />
              <BarraUso
                rotulo="Arquivos (Storage)"
                usado={uso.storage_bytes}
                limite={LIMITES.supabase.storageBytes}
                detalhe={`${formatarBytes(uso.storage_bytes)} de 1 GB · ${uso.storage_arquivos.toLocaleString("pt-BR")} arquivos`}
              />
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Usuários de login: <strong style={{ color: "var(--ink)" }}>{uso.usuarios_login}</strong> · ativos nos
                últimos 30 dias: <strong style={{ color: "var(--ink)" }}>{uso.usuarios_ativos_30d}</strong> (limite
                50.000)
              </p>
              {uso.storage_por_bucket.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
                    Arquivos por pasta
                  </p>
                  <table className="w-full text-xs">
                    <tbody>
                      {uso.storage_por_bucket.map((b) => (
                        <tr key={b.bucket} className="border-t" style={{ borderColor: "var(--line)" }}>
                          <td className="py-1" style={{ color: "var(--ink)" }}>{b.bucket}</td>
                          <td className="py-1 text-right" style={{ color: "var(--muted)" }}>{b.arquivos} arq.</td>
                          <td className="py-1 text-right font-medium" style={{ color: "var(--ink)" }}>{formatarBytes(b.bytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {dados && dados.supabase.maioresTabelas.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
                    Maiores tabelas
                  </p>
                  <table className="w-full text-xs">
                    <tbody>
                      {dados.supabase.maioresTabelas.map((t) => (
                        <tr key={t.tabela} className="border-t" style={{ borderColor: "var(--line)" }}>
                          <td className="py-1 font-mono" style={{ color: "var(--ink)" }}>{t.tabela}</td>
                          <td className="py-1 text-right" style={{ color: "var(--muted)" }}>
                            {Number(t.linhas).toLocaleString("pt-BR")} linhas
                          </td>
                          <td className="py-1 text-right font-medium" style={{ color: "var(--ink)" }}>{t.tamanho_total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          <ListaLimites itens={LIMITES.supabase.itens} />
          <Regras regras={LIMITES.supabase.regras} />
        </Cartao>

        {/* ---------------- GITHUB ---------------- */}
        <Cartao
          icone={Github}
          titulo="GitHub"
          plano={LIMITES.github.plano}
          cor="#6e40c9"
          link="https://github.com/jmacedombt/jmallied"
          rotuloLink="Abrir repositório"
        >
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Guarda o código-fonte e o histórico de versões. O publicar.bat envia pra cá e a Vercel atualiza o site.
          </p>
          {dados && (
            <div className="text-xs space-y-1">
              <p style={{ color: "var(--muted)" }}>
                Repositório: <strong style={{ color: "var(--ink)" }}>{dados.github.repo}</strong>
              </p>
              {dados.github.privado ? (
                <p style={{ color: "var(--muted)" }}>
                  Repositório privado — o tamanho só aparece no próprio GitHub (Settings).
                </p>
              ) : dados.github.tamanhoKb != null ? (
                <BarraUso
                  rotulo="Tamanho do repositório"
                  usado={dados.github.tamanhoKb * 1024}
                  limite={1024 ** 3}
                  detalhe={`${formatarBytes(dados.github.tamanhoKb * 1024)} de 1 GB recomendado`}
                />
              ) : (
                <p style={{ color: "var(--muted)" }}>{dados.github.erro ?? "—"}</p>
              )}
              {dados.github.atualizadoEm && (
                <p style={{ color: "var(--muted)" }}>
                  Último envio: <strong style={{ color: "var(--ink)" }}>{formatarDataHoraBrasilia(dados.github.atualizadoEm)}</strong>
                </p>
              )}
            </div>
          )}
          <ListaLimites itens={LIMITES.github.itens} />
          <Regras regras={LIMITES.github.regras} />
        </Cartao>
      </div>

      {/* ---------------- CONSUMO AUTOMÁTICO ---------------- */}
      <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <p className="flex items-center gap-2 text-base font-bold mb-1" style={{ color: "var(--ink)" }}>
          <Timer size={18} style={{ color: "#7c3aed" }} />
          Consultas automáticas por aba aberta
        </p>
        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          Cada consulta é uma chamada de função na Vercel e gasta CPU. Ajustado em 07/11/2026 depois da pausa por
          excesso de &quot;Active CPU&quot;. Quanto mais abas abertas, mais consumo — feche as abas que não estiver usando.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead style={{ color: "var(--muted)" }}>
              <tr>
                <th className="text-left py-1.5">Consulta</th>
                <th className="text-right py-1.5">Antes (por hora)</th>
                <th className="text-right py-1.5">Agora, aba visível</th>
                <th className="text-right py-1.5">Agora, aba escondida</th>
              </tr>
            </thead>
            <tbody>
              {consumo.map((c) => (
                <tr key={c.chave} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="py-1.5" style={{ color: "var(--ink)" }}>{c.rotulo}</td>
                  <td className="py-1.5 text-right" style={{ color: "var(--muted)" }}>{c.antes}</td>
                  <td className="py-1.5 text-right" style={{ color: "var(--ink)" }}>{c.visivel}</td>
                  <td className="py-1.5 text-right" style={{ color: "var(--ink)" }}>{c.oculta}</td>
                </tr>
              ))}
              <tr className="border-t font-semibold" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
                <td className="py-1.5">Total por aba</td>
                <td className="py-1.5 text-right" style={{ color: "#dc2626" }}>{total.antes}</td>
                <td className="py-1.5 text-right" style={{ color: "#16a34a" }}>{total.visivel}</td>
                <td className="py-1.5 text-right" style={{ color: "#16a34a" }}>{total.oculta}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          Também foi retirada a atualização automática a cada 1 minuto do Financeiro e de Notas Fiscais — agora elas
          atualizam quando você volta pra aba.
        </p>
      </div>

      {/* ---------------- CHECKLIST ---------------- */}
      <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <p className="text-base font-bold mb-2" style={{ color: "var(--ink)" }}>
          Rotina de cuidados
        </p>
        <ul className="text-xs space-y-1.5" style={{ color: "var(--ink)" }}>
          <li>• <strong>Toda semana:</strong> abrir a Vercel → Usage e ver se algum item passou de 60% do mês.</li>
          <li>• <strong>Toda semana:</strong> olhar as barras do Supabase aqui (banco e arquivos abaixo de 60%).</li>
          <li>• <strong>Todo dia:</strong> fechar abas do sistema que não estiver usando, principalmente no fim do expediente.</li>
          <li>• <strong>Ao publicar:</strong> conferir se o publicar.bat terminou sem erro e se a &quot;Versão no ar&quot; mudou.</li>
          <li>• <strong>Senhas e códigos:</strong> recuperação da Vercel (2FA) guardada fora do computador; nunca enviar chaves por chat.</li>
        </ul>
      </div>
    </div>
  );
}
