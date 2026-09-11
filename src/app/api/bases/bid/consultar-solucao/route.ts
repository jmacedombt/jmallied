import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarPrecosBidPorPartNumber } from "@/lib/bid";

// Lookup leve de "Peça Solução" por Part Number — usado nas telas onde a
// pessoa DIGITA um código manualmente (Reorçamento em "6 - Ag. Reparo" e
// o ajuste em "4 - Ag. Resposta de Reorçamento") pra mostrar na hora a
// mesma Peça Solução que vai sair na planilha (ver reorcamentoEnvio.ts,
// que faz exatamente essa mesma busca no momento do envio — aqui é só
// um auxílio visual, não muda o que é gravado). Qualquer usuário
// autenticado pode consultar (mesma trava de leitura do resto do BID).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const codigos = Array.isArray(body?.codigos) ? body.codigos.map((c: unknown) => String(c ?? "").trim()).filter(Boolean) : [];

  if (codigos.length === 0) {
    return NextResponse.json({ solucoes: {} });
  }

  const precos = await buscarPrecosBidPorPartNumber(supabase, codigos);
  const solucoes: Record<string, string | null> = {};
  for (const codigo of codigos) {
    solucoes[codigo] = precos[codigo]?.peca_solucao ?? null;
  }

  return NextResponse.json({ solucoes });
}
