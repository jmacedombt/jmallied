import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ImportarBasePecasForm from "@/components/ImportarBasePecasForm";
import GraficoPecasPorPeriodo from "@/components/GraficoPecasPorPeriodo";
import { formatarDataBr, podeImportarBasePecas } from "@/lib/pecas";

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

  const [{ data: resumo }, { data: porMes }, { data: porSemana }, { data: porAno }, { data: ultimaImportacao }] =
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

      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }}
        >
          Atualizada em{" "}
          <strong style={{ color: "var(--ink)" }}>
            {ultimaImportacao
              ? new Date(ultimaImportacao.importado_em).toLocaleString("pt-BR")
              : "—"}
          </strong>{" "}
          por{" "}
          <strong style={{ color: "var(--ink)" }}>
            {nomeUsuarioImportacao
              ? `${nomeUsuarioImportacao.nome} ${nomeUsuarioImportacao.sobrenome}`
              : "—"}
          </strong>
        </div>
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }}
        >
          Peça mais recente da base:{" "}
          <strong style={{ color: "var(--ink)" }}>{formatarDataBr(resumo?.data_mais_recente)}</strong>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div
          className="rounded-xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <p className="text-xs uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>
            Peças únicas (códigos)
          </p>
          <p className="text-3xl font-semibold" style={{ color: "var(--ink)" }}>
            {resumo?.pecas_unicas ?? 0}
          </p>
        </div>
        <div
          className="rounded-xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <p className="text-xs uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>
            Peças registradas (soma da quantidade)
          </p>
          <p className="text-3xl font-semibold" style={{ color: "var(--ink)" }}>
            {resumo?.pecas_registradas ?? 0}
          </p>
        </div>
      </div>

      <GraficoPecasPorPeriodo
        porMes={normalizar(porMes)}
        porSemana={normalizar(porSemana)}
        porAno={normalizar(porAno)}
      />
    </AppShell>
  );
}
