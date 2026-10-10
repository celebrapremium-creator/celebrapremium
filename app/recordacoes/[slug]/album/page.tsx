import { notFound } from "next/navigation";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type AlbumEntry = {
  id: string;
  message: string;
  created_at: string;
  memory_guests: { first_name: string; last_name: string } | null;
  memory_photos: { id: string; original_name: string; storage_path: string }[];
};

export default async function PublicMemoryAlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) notFound();

  const admin = createSupabaseAdmin(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: book } = await admin.from("memory_books").select("id,title,active").eq("slug", slug).eq("active", true).maybeSingle();
  if (!book) notFound();

  const { data } = await admin.from("memory_entries")
    .select("id,message,created_at,memory_guests(first_name,last_name),memory_photos(id,original_name,storage_path)")
    .eq("book_id", book.id).eq("moderation_status", "approved").order("created_at", { ascending: true });

  const entries: AlbumEntry[] = await Promise.all((data || []).map(async (entry: any) => {
    const photos = await Promise.all((entry.memory_photos || []).map(async (photo: any) => {
      const { data: signed } = await admin.storage.from("memory-photos").createSignedUrl(photo.storage_path, 60 * 60);
      return { id: photo.id, original_name: photo.original_name, signed_url: signed?.signedUrl || null };
    }));
    return { ...entry, memory_photos: photos };
  }));

  return <main style={{minHeight:"100vh",padding:"36px 16px",background:"linear-gradient(145deg,#fff8f2,#f8f3ff)",color:"#2b2430"}}>
    <section style={{maxWidth:1000,margin:"0 auto"}}>
      <p style={{letterSpacing:".16em",fontSize:12,fontWeight:700,color:"#9b6c58"}}>CELEBRA PREMIUM · ÁLBUM VIRTUAL</p>
      <h1 style={{fontSize:36,lineHeight:1.15,margin:"12px 0"}}>{book.title}</h1>
      <p style={{color:"#6d6470",lineHeight:1.6}}>Recordações aprovadas para compartilhar os melhores momentos desta celebração.</p>
      {entries.length===0 ? <div style={{background:"#fff",borderRadius:18,padding:24,marginTop:24}}>O álbum ainda não tem recordações aprovadas para exibição.</div> :
      <div style={{display:"grid",gap:20,marginTop:24}}>{entries.map(entry=><article key={entry.id} style={{background:"#fff",borderRadius:18,padding:22,boxShadow:"0 12px 36px #2b243010"}}>
        <h2 style={{fontSize:18,margin:"0 0 12px"}}>{entry.memory_guests ? entry.memory_guests.first_name+" "+entry.memory_guests.last_name : "Convidado"}</h2>
        <blockquote style={{whiteSpace:"pre-wrap",lineHeight:1.7,margin:"0 0 16px",paddingLeft:14,borderLeft:"3px solid #c6a7c9"}}>{entry.message}</blockquote>
        {entry.memory_photos.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>{entry.memory_photos.map(photo=><div key={photo.id}>{photo.signed_url ? <a href={photo.signed_url} target="_blank" rel="noreferrer"><img src={photo.signed_url} alt={photo.original_name} style={{width:"100%",height:180,objectFit:"cover",borderRadius:10}}/></a> : <p>Foto indisponível</p>} {photo.signed_url&&<a href={photo.signed_url} target="_blank" rel="noreferrer" style={{fontSize:13,overflowWrap:"anywhere"}}>Abrir foto</a>}</div>)}</div>}
      </article>)}</div>}
      <p style={{fontSize:12,color:"#817783",marginTop:28}}>Somente mensagens aprovadas pela organização aparecem neste álbum.</p>
    </section>
  </main>;
}
