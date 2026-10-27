import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  podeImportarOrcamentos,
  conferirCabecalhoOrcamentos,
  textoOuNull,
  COL_NF_REMESSA_ALLIED,
  COL_TRADE_ALLIED,
} from "@/lib/orcamentos";
import { conferirParPreOrdem, aplicarPreOrdemNaNf, linhasDaPlanilha } from "@/lib/preOrdemAplicar";

export const maxDuration = 30;

// "Definir NF definitiva" (pedido explícito, 27/10/2026 — migration
// 0080): pra NF que entrou como TEMPORÁRIA (TEMP-...) porque a Base de
// Orçamentos veio sem a NF Remessa. Recebe a Base de Orçamentos
// DEFINITIVA (com a NF) e, opcionalmente, a Pré-Ordem. Confere TUDO antes
// de mudar qualquer coisa:
//   - cabeçalho no padrão;
//   - uma NF só, preenchida, que ainda não existe no sistema;
//   - os MESMOS aparelhos (Trade Allied) da NF temporária — nem a mais,
//     nem a menos (lista as diferenças);
//   - se veio Pré-Ordem: mesma regra de sempre (quantidade, lote, SKU).
// Passando: troca a NF temporária pela definitiva em todas as tabelas
// (função renomear_nf_remessa), guarda o arquivo definitivo como o
// arquivo da NF e preenche a Pré-Ordem. Não mexe em nenhum outro dado dos
// aparelhos (análise, peças, valores) — o serviço já andou.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();
  if (!podeImportarOrcamentos(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para atualizar a Base de Orçamentos." }, { status: 403 });
  }

  const { data: lote } = await admin
    .from("orcamentos_lotes")
    .select("id, nf_remessa_allied, nf_temporaria")
    .eq("id", params.id)
    .single();
  if (!lote) return NextResponse.json({ error: "NF não encontrada no histórico." }, { status: 404 });
  if (!lote.nf_temporaria) return NextResponse.json({ error: "Essa NF já é definitiva." }, { status: 409 });
  const nfTemp = lote.nf_remessa_allied as string;

  const formData = await request.formData();
  const arquivo = formData.get("arquivo");
  const arquivoPreOrdemBruto = formData.get("arquivoPreOrdem");
  const arquivoPreOrdem = arquivoPreOrdemBruto instanceof File && arquivoPreOrdemBruto.size > 0 ? arquivoPreOrdemBruto : null;
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Escolha a Base de Orçamentos definitiva (com a NF Remessa)." }, { status: 400 });
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const bytesPre = arquivoPreOrdem ? Buffer.from(await arquivoPreOrdem.arrayBuffer()) : null;
  let base: { cabecalho: unknown[]; linhas: unknown[][] };
  let pre: { cabecalho: unknown[]; linhas: unknown[][] } | null = null;
  try {
    base = linhasDaPlanilha(XLSX, bytes);
    if (bytesPre) pre = linhasDaPlanilha(XLSX, bytesPre);
  } catch {
    return NextResponse.json({ error: "Não consegui ler um dos arquivos. Confirme que são planilhas válidas." }, { status: 400 });
  }

  const divergencias = conferirCabecalhoOrcamentos(base.cabecalho);
  if (divergencias.length > 0) {
    const lista = divergencias
      .slice(0, 8)
      .map((d) => `coluna ${d.coluna}: deveria ser "${d.esperado}", veio "${d.encontrado}"`)
      .join("; ");
    return NextResponse.json(
      { error: `A Base de Orçamentos está fora do padrão — arrume o arquivo antes. ${lista}. Nada foi alterado.` },
      { status: 400 }
    );
  }

  const nfs = Array.from(new Set(base.linhas.map((l) => textoOuNull(l[COL_NF_REMESSA_ALLIED]) ?? "")));
  if (nfs.length !== 1 || !nfs[0]) {
    return NextResponse.json(
      { error: "A Base definitiva tem que ter UMA NF Remessa preenchida em todas as linhas (coluna B). Nada foi alterado." },
      { status: 400 }
    );
  }
  const nfNova = nfs[0];
  if (nfNova.toUpperCase().startsWith("TEMP-")) {
    return NextResponse.json({ error: "A NF definitiva não pode começar com TEMP-." }, { status: 400 });
  }

  const [{ data: loteMesmaNf }, { count: aparelhosMesmaNf }] = await Promise.all([
    admin.from("orcamentos_lotes").select("id").eq("nf_remessa_allied", nfNova).maybeSingle(),
    admin.from("orcamentos").select("id", { count: "exact", head: true }).eq("nf_remessa_allied", nfNova),
  ]);
  if (loteMesmaNf || (aparelhosMesmaNf ?? 0) > 0) {
    return NextResponse.json(
      { error: `A NF ${nfNova} já existe no sistema — confira se o arquivo definitivo é mesmo dessa NF temporária. Nada foi alterado.` },
      { status: 409 }
    );
  }

  // os MESMOS aparelhos (Trade Allied) dos dois lados
  const tradesArquivo = new Set(base.linhas.map((l) => textoOuNull(l[COL_TRADE_ALLIED])).filter((t): t is string => !!t));
  const { data: aparelhos, error: erroAparelhos } = await admin
    .from("orcamentos")
    .select("trade_allied")
    .eq("nf_remessa_allied", nfTemp);
  if (erroAparelhos) return NextResponse.json({ error: erroAparelhos.message }, { status: 400 });
  const tradesSistema = new Set(((aparelhos ?? []) as { trade_allied: string }[]).map((a) => a.trade_allied));
  const faltam = Array.from(tradesSistema).filter((t) => !tradesArquivo.has(t));
  const sobram = Array.from(tradesArquivo).filter((t) => !tradesSistema.has(t));
  if (faltam.length > 0 || sobram.length > 0) {
    const partes: string[] = [];
    if (faltam.length > 0) partes.push(`${faltam.length} aparelho(s) da ${nfTemp} não estão no arquivo (ex.: ${faltam.slice(0, 10).join(", ")})`);
    if (sobram.length > 0) partes.push(`${sobram.length} Trade(s) do arquivo não estão na ${nfTemp} (ex.: ${sobram.slice(0, 10).join(", ")})`);
    return NextResponse.json(
      { error: `O arquivo definitivo não tem os mesmos aparelhos da NF temporária: ${partes.join("; ")}. Nada foi alterado.` },
      { status: 400 }
    );
  }

  if (pre) {
    const erroPar = conferirParPreOrdem(base.linhas, pre.linhas, nfNova);
    if (erroPar) return NextResponse.json({ error: erroPar }, { status: 400 });
  }

  // ---- tudo conferido: aplica ----
  const { data: trocas, error: erroTroca } = await admin.rpc("renomear_nf_remessa", { p_antiga: nfTemp, p_nova: nfNova });
  if (erroTroca) {
    return NextResponse.json(
      { error: `Não consegui trocar a NF (a migration 0080 foi rodada?): ${erroTroca.message}` },
      { status: 400 }
    );
  }

  const agora = new Date().toISOString();
  const caminhoArquivo = `${lote.id}/${arquivo.name}`;
  const { error: erroUpload } = await admin.storage.from("bases-orcamentos").upload(caminhoArquivo, bytes, {
    contentType: arquivo.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });

  let resultadoPreOrdem = null;
  let caminhoPre: string | null = null;
  if (pre && arquivoPreOrdem && bytesPre) {
    const aplicado = await aplicarPreOrdemNaNf(admin, nfNova, base.linhas, pre.linhas);
    if (!aplicado.ok) {
      return NextResponse.json(
        { error: `A NF foi trocada para ${nfNova}, mas a Pré-Ordem falhou: ${aplicado.erro} Use "Subir Pré-Ordem" na linha da NF.` },
        { status: 400 }
      );
    }
    resultadoPreOrdem = aplicado.resultado;
    caminhoPre = `${lote.id}/pre-ordem-${arquivoPreOrdem.name}`;
    await admin.storage.from("bases-orcamentos").upload(caminhoPre, bytesPre, {
      contentType: arquivoPreOrdem.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
  }

  await admin
    .from("orcamentos_lotes")
    .update({
      nf_temporaria: false,
      arquivo_nome: arquivo.name,
      ...(erroUpload ? {} : { arquivo_path: caminhoArquivo }),
      ...(resultadoPreOrdem
        ? { pre_ordem_pendente: false, pre_ordem_atualizada_em: agora, pre_ordem_atualizada_por: user.id, arquivo_pre_ordem_path: caminhoPre }
        : {}),
    })
    .eq("id", lote.id);

  return NextResponse.json({
    nfTemporaria: nfTemp,
    nfDefinitiva: nfNova,
    aparelhos: tradesSistema.size,
    trocas,
    preOrdem: resultadoPreOrdem,
  });
}
