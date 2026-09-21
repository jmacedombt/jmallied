import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBid, gerarBufferRelatorioBid, type LinhaRelatorioBid } from "@/lib/bid";
import { isAllied } from "@/lib/usuarios";

const RETENCAO_DIAS = 60;

function corteRetencaoIso(): string {
  return new Date(Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000).toISOString();
}

// Baixa de novo (remontando a partir do snapshot salvo, não guardando o
// arquivo — mesmo padrão de /api/operacional/modelo-retorno/[id]/download)
// uma versão já gerada do Relatório BID, byte a byte igual à que saiu
// originalmente. Duas portas de entrada:
//   - equipe interna (podeImportarBid): qualquer versão do histórico,
//     dentro dos últimos 60 dias (mesmo corte da listagem);
//   - login ALLIED: só versões marcadas como enviadas (enviado_em não
//     nulo) — confere aqui de novo, mesmo o middleware já limitando a
//     tela que chega até essa rota, porque o id não deixa de ser
//     adivinhável.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  const podeInterno = podeImportarBid(perfil);
  const allied = isAllied(perfil);

  if (!podeInterno && !allied) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra baixar o Relatório BID." }, { status: 403 });
  }

  const { data: registro, error } = await admin
    .from("bid_relatorio_log")
    .select("nome_arquivo, nome_aba, dados, enviado_em")
    .eq("id", params.id)
    .gte("gerado_em", corteRetencaoIso())
    .single();

  if (error || !registro) {
    return NextResponse.json(
      { error: "Registro não encontrado — pode já ter passado dos 60 dias de retenção." },
      { status: 404 }
    );
  }

  if (allied && !podeInterno && !registro.enviado_em) {
    return NextResponse.json({ error: "Essa versão ainda não foi marcada como enviada." }, { status: 403 });
  }

  if (!registro.dados || !registro.nome_aba) {
    return NextResponse.json(
      { error: "Essa versão foi gerada antes do histórico guardar cópia — não dá pra baixar de novo." },
      { status: 404 }
    );
  }

  const buffer = await gerarBufferRelatorioBid(registro.dados as LinhaRelatorioBid[], registro.nome_aba);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${registro.nome_arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
