import { Package, Boxes, RefreshCcw, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ImportarBasePecasForm from "@/components/ImportarBasePecasForm";
import GraficoPecasPorPeriodo from "@/components/GraficoPecasPorPeriodo";
import TabelaVariacaoPrecoPecas, { type VariacaoPreco } from "@/components/TabelaVariacaoPrecoPecas";
import { formatarDataBr, podeImportarBasePecas } from "@/lib/pecas";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

// Card de resumo padronizado da linha de cima (ícone destacado + rótulo +
// valor em destaque) — mesmo visual pros 4 indicadores, incluindo os dois
// que antes eram só uma frase corrida ("Atualizada em..." / "Peça mais
// recente..."), pedido pelo Rafael pra ficar num formato mais profissional.
function CardResumo({
  icone: Icone,
  label,
  valor,
  sub,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icone: React.ComponentType<any>;
  label: string;
  valor: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-5 flex items-start gap-3.5"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <div className="rounded-lg p-2.5 shrink-0" style={{ background: "var(--accent-glow)" }}>
        <Icone size={20} style={{ color: "var(--accent2)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide font-medium mb-1" style={{ color: "var(--muted)" }}>
          {label}
        </p>
        <p className="text-xl font-semibold leading-tight truncate" style={{ color: "var(--ink)" }}>
          {valor}
        </p>
        {sub && (
          <p className="text-xs mt-1 truncate" style={{ color: "var(--muted)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

export default async function BasePecasPage() {
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

  type ResumoPecas = { pecas_unicas: number; pecas_registradas: number; data_mais_recente: string | null };
  type PontoPeriodo = { periodo: string; quantidade: number | string };

  const [{ data: resumo }, { data: porMes }, { data: porSemana }, { data: porAno }, { data: ultimaImportacao }, { data: variacaoPreco }] =
    await Promise.all([
      supabase.rpc("pecas_metricas_resumo").single() as unknown as Promise<{ data: ResumoPecas | null }>,
      supabase.rpc("pecas_metricas_periodo", { p_agrupamento: "mes" }) as unknown as Promise<{
        data: PontoPeriodo[] | null;
      }>,
      supabase.rpc("pecas_metricas_periodo", { p_agrupamento: "semana" }) as unknown as Promise<{
        data: PontoPeriodo[] | null;
      }>,
      supabase.rpc("pecas_metricas_periodo", { p_agrupamento: "ano" }) as unknown as Promise<{
        data: PontoPeriodo[] | null;
      }>,
      supabase
        .from("pecas_importacoes")
        .select("importado_em, usuarios:importado_por (nome, sobrenome)")
        .order("importado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.rpc("pecas_variacao_preco_recente", { p_dias: 60 }) as unknown as Promise<{
        data: VariacaoPreco[] | null;
      }>,
    ]);

  const normalizar = (linhas: PontoPeriodo[] | null) =>
    (linhas ?? []).map((l) => ({ periodo: l.periodo, quantidade: Number(l.quantidade) }));

  const usuarioImportacao = ultimaImportacao?.usuarios as
    | { nome: string; sobrenome: string }
    | { nome: string; sobrenome: string }[]
    | null
    | undefined;
  const nomeUsuarioImportacao = Array.isArray(usuarioImportacao)
    ? usuarioImportacao[0]
    : usuarioImportacao;

  return (
    <AppShell titulo="Base Peças" perfil={perfil}>
      {podeImportarBasePecas(perfil) && (
        <div className="mb-6">
          <ImportarBasePecasForm />
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <CardResumo icone={Package} label="Peças únicas (códigos)" valor={resumo?.pecas_unicas ?? 0} />
        <CardResumo
          icone={Boxes}
          label="Peças registradas (soma da quantidade)"
          valor={resumo?.pecas_registradas ?? 0}
        />
        <CardResumo
          icone={RefreshCcw}
          label="Atualizada em"
          valor={ultimaImportacao ? formatarDataHoraBrasilia(ultimaImportacao.importado_em) : "—"}
          sub={
            nomeUsuarioImportacao
              ? `por ${nomeUsuarioImportacao.nome} ${nomeUsuarioImportacao.sobrenome}`
              : undefined
          }
        />
        <CardResumo
          icone={CalendarClock}
          label="Peça mais recente da base"
          valor={formatarDataBr(resumo?.data_mais_recente)}
        />
      </div>

      <GraficoPecasPorPeriodo
        porMes={normalizar(porMes)}
        porSemana={normalizar(porSemana)}
        porAno={normalizar(porAno)}
      />

      <TabelaVariacaoPrecoPecas linhas={variacaoPreco ?? []} />
    </AppShell>
  );
}
