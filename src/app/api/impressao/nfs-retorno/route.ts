import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Lista das NFs de Retorno JÁ EMITIDAS (orcamentos.nf_retorno_numero
// preenchido — migration 0048), pra lista suspensa da Etiqueta Avulsa NF
// Retorno (pedido explícito, 23/11/2026). Desde 25/11/2026 (etiqueta no
// padrão Allied) cada NF vem quebrada em GRUPOS de caixa — NF Remessa +
// Aprovado/Reprovado + Reparo/Reincidência (flag RRR: validacao_rrr ??
// reincidente) — com quantidade, NF Peça/Serviço e reparadora. Só leitura.
type Linha = {
  nf_retorno_numero: string;
  nf_remessa_allied: string | null;
  nf_mao_de_obra_numero: string | null;
  nf_pecas_numero: string | null;
  reparador_terceiro: string | null;
  reincidente: boolean | null;
  validacao_rrr: boolean | null;
  updated_at: string | null;
};

type Grupo = {
  nfEnvio: string;
  status: "APROVADO" | "REPROVADO";
  tipo: "REPARO" | "REINCIDÊNCIA";
  quantidade: number;
  nfPeca: string;
  nfServico: string;
  reparadora: string;
};

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createAdminClient();
  const linhas: Linha[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await admin
      .from("orcamentos")
      .select(
        "nf_retorno_numero, nf_remessa_allied, nf_mao_de_obra_numero, nf_pecas_numero, reparador_terceiro, reincidente, validacao_rrr, updated_at"
      )
      .not("nf_retorno_numero", "is", null)
      .range(inicio, inicio + 999);
    if (error) return NextResponse.json({ error: "Não consegui buscar as NFs de Retorno." }, { status: 500 });
    linhas.push(...((data ?? []) as Linha[]));
    if (!data || data.length < 1000) break;
  }

  const mapa = new Map<string, { numero: string; aparelhos: number; ultima: string; grupos: Map<string, Grupo> }>();
  for (const l of linhas) {
    const numero = l.nf_retorno_numero.trim();
    if (!numero) continue;
    const item = mapa.get(numero) ?? { numero, aparelhos: 0, ultima: "", grupos: new Map() };
    item.aparelhos += 1;
    if ((l.updated_at ?? "") > item.ultima) item.ultima = l.updated_at ?? "";

    const aprovado = !!(l.nf_mao_de_obra_numero || l.nf_pecas_numero);
    const status = aprovado ? "APROVADO" : "REPROVADO";
    const tipo = (l.validacao_rrr ?? !!l.reincidente) ? "REINCIDÊNCIA" : "REPARO";
    const nfEnvio = l.nf_remessa_allied ?? "";
    const chave = `${nfEnvio}|${status}|${tipo}`;
    const g =
      item.grupos.get(chave) ??
      ({
        nfEnvio,
        status,
        tipo,
        quantidade: 0,
        nfPeca: aprovado ? l.nf_pecas_numero ?? "" : "",
        nfServico: aprovado ? l.nf_mao_de_obra_numero ?? "" : "",
        reparadora: (l.reparador_terceiro || "J MACEDO").toUpperCase(),
      } as Grupo);
    g.quantidade += 1;
    item.grupos.set(chave, g);
    mapa.set(numero, item);
  }

  const nfs = Array.from(mapa.values())
    .sort((a, b) => b.ultima.localeCompare(a.ultima))
    .map((i) => {
      const grupos = Array.from(i.grupos.values());
      return {
        numero: i.numero,
        aparelhos: i.aparelhos,
        remessas: Array.from(new Set(grupos.map((g) => g.nfEnvio))),
        grupos,
      };
    });

  return NextResponse.json({ nfs });
}
