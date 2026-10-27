import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarOrcamentos } from "@/lib/orcamentos";
import { conferirParPreOrdem, aplicarPreOrdemNaNf } from "@/lib/preOrdemAplicar";

export const maxDuration = 30;

// "Subir Pré-Ordem" depois (pedido explícito, 27/10/2026) — pra NF que
// entrou só com a Base de Orçamentos ("Pré-Ordem pendente"). Casa por
// sequência com o MESMO arquivo de orçamentos que foi guardado no Storage
// na importação dessa NF (orcamentos_lotes.arquivo_path), com a MESMA
// regra de sempre (validarParPreOrdem: quantidade de linhas, lote e SKU
// linha a linha). Qualquer divergência recusa TUDO e lista as linhas.
// Passando, preenche a Pré-Ordem de todos os aparelhos da NF, em qualquer
// etapa — o valor do arquivo substitui o que já estiver gravado (lista
// quem mudou).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();
  if (!podeImportarOrcamentos(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para subir a Pré-Ordem." }, { status: 403 });
  }

  const formData = await request.formData();
  const loteId = String(formData.get("loteId") ?? "");
  const arquivoPreOrdem = formData.get("arquivoPreOrdem");
  if (!loteId || !(arquivoPreOrdem instanceof File)) {
    return NextResponse.json({ error: "Escolha o arquivo de Pré-Ordem dessa NF." }, { status: 400 });
  }

  const { data: lote } = await admin
    .from("orcamentos_lotes")
    .select("id, nf_remessa_allied, arquivo_path, nf_temporaria")
    .eq("id", loteId)
    .single();
  if (!lote) return NextResponse.json({ error: "NF não encontrada no histórico." }, { status: 404 });
  if (!lote.arquivo_path) {
    return NextResponse.json(
      { error: "O arquivo de orçamentos dessa NF não ficou guardado — suba a Base de Orçamentos de novo junto com a Pré-Ordem." },
      { status: 409 }
    );
  }

  // arquivo de orçamentos guardado na importação da NF
  const { data: blob, error: erroDownload } = await admin.storage.from("bases-orcamentos").download(lote.arquivo_path);
  if (erroDownload || !blob) {
    return NextResponse.json({ error: "Não consegui abrir o arquivo de orçamentos guardado dessa NF." }, { status: 400 });
  }

  let linhasOrcamento: unknown[][];
  let linhasPreOrdem: unknown[][];
  try {
    const wbOrc = XLSX.read(Buffer.from(await blob.arrayBuffer()), { type: "buffer", cellDates: true });
    linhasOrcamento = (XLSX.utils.sheet_to_json(wbOrc.Sheets[wbOrc.SheetNames[0]], { header: 1, blankrows: false }) as unknown[][]).slice(1);
    const wbPre = XLSX.read(Buffer.from(await arquivoPreOrdem.arrayBuffer()), { type: "buffer", cellDates: true });
    linhasPreOrdem = (XLSX.utils.sheet_to_json(wbPre.Sheets[wbPre.SheetNames[0]], { header: 1, blankrows: false }) as unknown[][]).slice(1);
  } catch {
    return NextResponse.json({ error: "Não consegui ler o arquivo de Pré-Ordem. Confirme que é uma planilha válida." }, { status: 400 });
  }

  if (lote.nf_temporaria) {
    return NextResponse.json(
      { error: "Essa NF ainda é temporária — use \"Definir NF definitiva\" e suba a Pré-Ordem junto com a Base definitiva." },
      { status: 409 }
    );
  }

  const erroPar = conferirParPreOrdem(linhasOrcamento, linhasPreOrdem, lote.nf_remessa_allied);
  if (erroPar) return NextResponse.json({ error: erroPar }, { status: 400 });

  const aplicado = await aplicarPreOrdemNaNf(admin, lote.nf_remessa_allied, linhasOrcamento, linhasPreOrdem);
  if (!aplicado.ok) return NextResponse.json({ error: aplicado.erro }, { status: 400 });

  const agora = new Date().toISOString();
  const caminhoPreOrdem = `${lote.id}/pre-ordem-${arquivoPreOrdem.name}`;
  const { error: erroUpload } = await admin.storage
    .from("bases-orcamentos")
    .upload(caminhoPreOrdem, Buffer.from(await arquivoPreOrdem.arrayBuffer()), {
      contentType: arquivoPreOrdem.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });

  await admin
    .from("orcamentos_lotes")
    .update({
      pre_ordem_pendente: false,
      pre_ordem_atualizada_em: agora,
      pre_ordem_atualizada_por: user.id,
      ...(erroUpload ? {} : { arquivo_pre_ordem_path: caminhoPreOrdem }),
    })
    .eq("id", lote.id);

  return NextResponse.json({ nfRemessa: lote.nf_remessa_allied, ...aplicado.resultado });
}
