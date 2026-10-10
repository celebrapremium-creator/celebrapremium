import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await createClient();
  const { data: claimsData } = await session.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });

  const body = await request.json().catch(() => null) as { eventId?: string; title?: string; maxChars?: number } | null;
  if (!body?.eventId || !body.title?.trim()) return NextResponse.json({ error: "Selecione um evento e informe o título." }, { status: 400 });
  const maxChars = Number(body.maxChars ?? 500);
  if (!Number.isInteger(maxChars) || maxChars < 50 || maxChars > 2000) return NextResponse.json({ error: "O limite deve ficar entre 50 e 2.000 caracteres." }, { status: 400 });

  const [{ data: memberships }, { data: platform }, { data: event }] = await Promise.all([
    session.from("memberships").select("company_id,role").eq("user_id", userId).eq("active", true),
    session.from("platform_roles").select("role,active").eq("user_id", userId).maybeSingle(),
    session.from("events").select("id,display_name,company_id").eq("id", body.eventId).maybeSingle()
  ]);
  const privileged = Boolean(platform?.active && platform.role === "developer");
  const allowed = Boolean(event && (privileged || memberships?.some(m =>
    m.company_id === event.company_id && ["company_admin", "event_manager", "developer"].includes(m.role)
  )));
  if (!allowed || !event) return NextResponse.json({ error: "Você não tem permissão para administrar esse evento." }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor." }, { status: 503 });
  const admin = createSupabaseAdmin(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const baseSlug = (body.title.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "recordacoes");
  const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await admin.from("memory_books").insert({
    slug, title: body.title.trim().slice(0, 120), event_id: event.id,
    company_id: event.company_id, active: true, max_message_chars: maxChars
  }).select("id,slug,title,max_message_chars").single();
  if (error || !data) return NextResponse.json({ error: "Não foi possível criar o livro. Verifique se a migração foi aplicada." }, { status: 500 });
  return NextResponse.json({ book: data }, { status: 201 });
}
