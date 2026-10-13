import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await createClient();
  const { data: claimsData } = await session.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });

  const body = await request.json().catch(() => null) as { entryId?: string; status?: string } | null;
  if (!body?.entryId || !["approved", "rejected", "pending"].includes(body.status || "")) {
    return NextResponse.json({ error: "Solicitação de moderação inválida." }, { status: 400 });
  }

  const [{ data: memberships }, { data: platform }] = await Promise.all([
    session.from("memberships").select("company_id,role").eq("user_id", userId).eq("active", true),
    session.from("platform_roles").select("role,active").eq("user_id", userId).maybeSingle()
  ]);
  const privileged = Boolean(platform?.active && platform.role === "developer");
  const roles = new Set((memberships || []).filter(m => ["company_admin", "event_manager", "developer"].includes(m.role)).map(m => m.company_id));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Serviço não configurado." }, { status: 503 });
  const admin = createSupabaseAdmin(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: book } = await admin.from("memory_books").select("id,company_id").eq("slug", slug).maybeSingle();
  if (!book || (!privileged && (!book.company_id || !roles.has(book.company_id)))) {
    return NextResponse.json({ error: "Livro não encontrado ou acesso não autorizado." }, { status: 404 });
  }
  const { data, error } = await admin.from("memory_entries").update({ moderation_status: body.status })
    .eq("id", body.entryId).eq("book_id", book.id).select("id,moderation_status").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível atualizar a moderação." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Mensagem não encontrada neste livro." }, { status: 404 });
  return NextResponse.json({ entry: data });
}
