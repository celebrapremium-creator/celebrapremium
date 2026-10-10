import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const profanity = [
  "caralho", "porra", "puta", "puto", "merda", "buceta", "foder", "fodase",
  "fdp", "cuzao", "arrombado", "desgraca", "vadia", "piranha"
];

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[@4]/g, "a").replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i").replace(/[0]/g, "o").replace(/[$5]/g, "s")
    .replace(/[7]/g, "t").replace(/[^a-z]/g, "");
}

function containsProfanity(value: string) {
  const normalized = normalizeText(value);
  return profanity.some(word => normalized.includes(word));
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "O serviço de recordações ainda não está configurado." }, { status: 503 });
    }
    const form = await request.formData();
    const slug = String(form.get("slug") || "");
    const firstName = String(form.get("firstName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const message = String(form.get("message") || "").trim();
    const photos = form.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0);

    if (!/^[a-z0-9-]{3,80}$/.test(slug)) return NextResponse.json({ error: "Livro inválido." }, { status: 400 });
    if (firstName.length < 1 || firstName.length > 80 || lastName.length < 1 || lastName.length > 100) {
      return NextResponse.json({ error: "Informe nome e sobrenome." }, { status: 400 });
    }
    const normalizedPhone = phoneDigits(phone);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      return NextResponse.json({ error: "Informe um celular válido com DDD." }, { status: 400 });
    }
    if (!message || message.length > 2000) return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
    if (photos.length > 5) return NextResponse.json({ error: "Você pode anexar no máximo 5 fotos." }, { status: 400 });

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: book, error: bookError } = await supabase.from("memory_books")
      .select("id,title,max_message_chars,active").eq("slug", slug).eq("active", true).maybeSingle();
    if (bookError || !book) return NextResponse.json({ error: "Este livro não está disponível." }, { status: 404 });
    if (message.length > book.max_message_chars) {
      return NextResponse.json({ error: `A mensagem deve ter no máximo ${book.max_message_chars} caracteres.` }, { status: 400 });
    }
    if (containsProfanity(message)) return NextResponse.json({ error: "A mensagem contém palavras não permitidas. Revise o texto e tente novamente." }, { status: 400 });

    const { data: guest, error: guestError } = await supabase.from("memory_guests").insert({
      book_id: book.id, first_name: firstName, last_name: lastName,
      phone, phone_normalized: normalizedPhone
    }).select("id").single();
    if (guestError) {
      if (guestError.code === "23505") return NextResponse.json({ error: "Já existe uma recordação enviada por este celular neste evento." }, { status: 409 });
      return NextResponse.json({ error: "Não foi possível registrar seus dados." }, { status: 500 });
    }

    const { data: entry, error: entryError } = await supabase.from("memory_entries").insert({
      book_id: book.id, guest_id: guest.id, message, moderation_status: "pending"
    }).select("id").single();
    if (entryError) {
      await supabase.from("memory_guests").delete().eq("id", guest.id);
      return NextResponse.json({ error: "Não foi possível salvar a mensagem." }, { status: 500 });
    }

    for (const photo of photos) {
      const type = photo.type.toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp"].includes(type) || photo.size > 10 * 1024 * 1024) {
        await supabase.from("memory_entries").delete().eq("id", entry.id);
        await supabase.from("memory_guests").delete().eq("id", guest.id);
        return NextResponse.json({ error: "Cada foto deve ser JPG, PNG ou WebP e ter até 10 MB." }, { status: 400 });
      }
    }

    const uploadedPaths: string[] = [];
    for (const [index, photo] of photos.entries()) {
      const ext = photo.type === "image/jpeg" ? "jpg" : photo.type === "image/png" ? "png" : "webp";
      const storagePath = `${book.id}/${guest.id}/${crypto.randomUUID()}-${index}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("memory-photos")
        .upload(storagePath, await photo.arrayBuffer(), { contentType: photo.type, upsert: false });
      if (uploadError) {
        if (uploadedPaths.length) await supabase.storage.from("memory-photos").remove(uploadedPaths);
        await supabase.from("memory_entries").delete().eq("id", entry.id);
        await supabase.from("memory_guests").delete().eq("id", guest.id);
        return NextResponse.json({ error: "Não foi possível salvar todas as fotos. Tente novamente." }, { status: 500 });
      }
      uploadedPaths.push(storagePath);
      const { error: photoError } = await supabase.from("memory_photos").insert({
        book_id: book.id, guest_id: guest.id, entry_id: entry.id,
        storage_path: storagePath, original_name: photo.name.slice(0, 255),
        content_type: photo.type, size_bytes: photo.size
      });
      if (photoError) {
        await supabase.storage.from("memory-photos").remove(uploadedPaths);
        await supabase.from("memory_entries").delete().eq("id", entry.id);
        await supabase.from("memory_guests").delete().eq("id", guest.id);
        return NextResponse.json({ error: "Não foi possível registrar as fotos." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, message: "Sua recordação foi enviada para revisão. Muito obrigado por compartilhar esse momento!" });
  } catch {
    return NextResponse.json({ error: "Não foi possível concluir o envio. Tente novamente." }, { status: 500 });
  }
}
