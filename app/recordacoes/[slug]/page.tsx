import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MemoryBookForm from "./MemoryBookForm";

export const dynamic = "force-dynamic";

export default async function MemoryBookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: book } = await supabase.from("memory_books")
    .select("slug,title,max_message_chars,active").eq("slug", slug).eq("active", true).maybeSingle();
  if (!book) notFound();

  return <main style={{minHeight:"100vh",padding:"32px 16px",background:"linear-gradient(145deg,#fff8f2,#f8f3ff)",color:"#2b2430"}}>
    <section style={{maxWidth:640,margin:"0 auto",background:"#fff",borderRadius:24,padding:24,boxShadow:"0 18px 60px #2b243014"}}>
      <p style={{letterSpacing:".16em",fontSize:12,fontWeight:700,color:"#9b6c58"}}>CELEBRA PREMIUM · LIVRO DE RECORDAÇÕES</p>
      <h1 style={{fontSize:32,lineHeight:1.15,margin:"12px 0"}}>{book.title}</h1>
      <p style={{color:"#6d6470",lineHeight:1.6}}>Compartilhe uma lembrança deste dia especial. Sua mensagem será revisada antes de aparecer no livro.</p>
      <MemoryBookForm slug={book.slug} maxChars={book.max_message_chars}/>
      <p style={{fontSize:12,color:"#817783",marginTop:24}}>Seus dados e fotos serão usados para organizar as recordações deste evento.</p>
    </section>
  </main>;
}
