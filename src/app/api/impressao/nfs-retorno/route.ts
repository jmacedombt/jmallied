import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Lista das NFs de Retorno JÁ EMITIDAS (orcamentos.nf_retorno_numero
// preenchido — migration 0048), pra lista suspensa da Etiqueta Avulsa
// NF Retorno (pedido explícito, 23/11/2026: só pode imprimir NF de
// Retorno que foi emitida). Por NF: lotes (NF Remessa) que ela cobre,
// quantidade de aparelhos e quantos são aprovados (têm NF de Mão de
// Obra/Peças) x reprovados. Só leitura.
type Linha = {
  nf_retorno_numero: string;
  nf_remessa_allied: string | null;
  nf_mao_de_obra_numero: string | null;
  nf_pecas_numero: string | null;
  updated_at: string | null;
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
      .select("nf_retorno_numero, nf_remessa_allied, nf_mao_de_obra_numero, nf_pecas_numero, updated_at")
      .not("nf_retorno_numero", "is", null)
      .range(inicio, inicio + 999);
    if (error) return NextResponse.json({ error: "Não consegui buscar as NFs de Retorno." }, { status: 500 });
    linhas.push(...((data ?? []) as Linha[]));
    if (!data || data.length < 1000) break;
  }

  const mapa = new Map<
    string,
    { numero: string; remessas: Map<string, number>; aparelhos: number; aprovados: number; reprovados: number; ultima: string }
  >();
  for (const l of linhas) {
    const numero = l.nf_retorno_numero.trim();
    if (!numero) continue;
    const item =
      mapa.get(numero) ?? { numero, remessas: new Map(), aparelhos: 0, aprovados: 0, reprovados: 0, ultima: "" };
    item.aparelhos += 1;
    if (l.nf_mao_de_obra_numero || l.nf_pecas_numero) item.aprovados += 1;
    else item.reprovados += 1;
    if (l.nf_remessa_allied) item.remessas.set(l.nf_remessa_allied, (item.remessas.get(l.nf_remessa_allied) ?? 0) + 1);
    if ((l.updated_at ?? "") > item.ultima) item.ultima = l.updated_at ?? "";
    mapa.set(numero, item);
  }

  const nfs = Array.from(mapa.values())
    .sort((a, b) => b.ultima.localeCompare(a.ultima))
    .map((i) => ({
      numero: i.numero,
      remessas: Array.from(i.remessas.entries()).map(([nf, quantidade]) => ({ nf, quantidade })),
      aparelhos: i.aparelhos,
      aprovados: i.aprovados,
      reprovados: i.reprovados,
    }));

  return NextResponse.json({ nfs });
}
