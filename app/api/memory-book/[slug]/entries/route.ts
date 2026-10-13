import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await createClient();
  const { data: claimsData } = await session.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });

  const [{ data: memberships }, { data: platform }] = await Promise.all([
    session.from("memberships").select("company_id,role").eq("user_id", userId).eq("active", true),
    session.from("platform_roles").select("role,active").eq("user_id", userId).maybeSingle()
  ]);
  const privileged = Boolean(platform?.active && platform.role === "developer");
  const roles = new Set((memberships || []).filter(m => ["company_admin","event_manager","developer"].includes(m.role)).map(m => m.company_id));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Serviço não configurado." }, { status: 503 });
  const admin = createSupabaseAdmin(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: book } = await admin.from("memory_books").select("id,title,company_id,event_id").eq("slug", slug).maybeSingle();
  if (!book || (!privileged && (!book.company_id || !roles.has(book.company_id)))) {
    return NextResponse.json({ error: "Livro não encontrado ou acesso não autorizado." }, { status: 404 });
  }
  const { data: entries, error } = await admin.from("memory_entries")
    .select("id,message,moderation_status,created_at,memory_guests(id,first_name,last_name,phone),memory_photos(id,storage_path,original_name,content_type,size_bytes,created_at)")
    .eq("book_id", book.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Não foi possível carregar as recordações." }, { status: 500 });
  const result = await Promise.all((entries || []).map(async (entry: any) => {
    const photos = await Promise.all((entry.memory_photos || []).map(async (photo: any) => {
      const { data } = await admin.storage.from("memory-photos").createSignedUrl(photo.storage_path, 60 * 10);
      return { ...photo, signed_url: data?.signedUrl || null };
    }));
    return { ...entry, memory_photos: photos };
  }));
  return NextResponse.json({ book, entries: result });
}
