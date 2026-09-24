import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { definirStatus, type StatusPresenca } from "@/lib/presenca";

const STATUS_VALIDOS: StatusPresenca[] = ["Disponivel", "Ausente", "Ocupado"];

// Status manual do chat interno (Disponível/Ausente/Ocupado, pedido
// explícito, migration 0069) — vale pra qualquer login, inclusive
// ALLIED. Só é levado em conta enquanto a pessoa está online (ver
// statusExibido em ChatWidget.tsx).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status as string | undefined;
  if (!status || !STATUS_VALIDOS.includes(status as StatusPresenca)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  try {
    await definirStatus(supabase, status as StatusPresenca);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível atualizar o status." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
