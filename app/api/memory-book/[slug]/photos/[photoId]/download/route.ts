import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeFilename(value: string) {
  const cleaned = value.replace(/[\\/\\r\\n\\0]/g, "_").trim();
  return cleaned || "recordacao";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; photoId: string }> }
) {
  const { slug, photoId } = await params;
  const session = await createClient();
  const { data: claimsData } = await session.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  }

  const [{ data: memberships }, { data: platform }] = await Promise.all([
    session.from("memberships").select("company_id,role").eq("user_id", userId).eq("active", true),
    session.from("platform_roles").select("role,active").eq("user_id", userId).maybeSingle()
  ]);
  const privileged = Boolean(platform?.active && platform.role === "developer");
  const roles = new Set((memberships || [])
    .filter(m => ["company_admin", "event_manager", "developer"].includes(m.role))
    .map(m => m.company_id));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Serviço não configurado." }, { status: 503 });
  }

  const admin = createSupabaseAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: book } = await admin.from("memory_books")
    .select("id,company_id").eq("slug", slug).maybeSingle();
  if (!book || (!privileged && (!book.company_id || !roles.has(book.company_id)))) {
    return NextResponse.json({ error: "Livro não encontrado ou acesso não autorizado." }, { status: 404 });
  }

  const { data: photo, error: photoError } = await admin.from("memory_photos")
    .select("storage_path,original_name,content_type")
    .eq("id", photoId).eq("book_id", book.id).maybeSingle();
  if (photoError || !photo) {
    return NextResponse.json({ error: "Foto não encontrada neste livro." }, { status: 404 });
  }

  const { data: file, error: downloadError } = await admin.storage
    .from("memory-photos").download(photo.storage_path);
  if (downloadError || !file) {
    return NextResponse.json({ error: "Não foi possível baixar esta foto." }, { status: 502 });
  }

  const filename = safeFilename(photo.original_name || "recordacao");
  const encodedFilename = encodeURIComponent(filename);
  return new Response(file.stream(), {
    status: 200,
    headers: {
      "Content-Type": photo.content_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="recordacao"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
