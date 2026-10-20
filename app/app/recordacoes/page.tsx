"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EventItem = { id: string; display_name: string; company_id: string };
type BookItem = { id: string; slug: string; title: string; max_message_chars: number };

export default function MemoryBooksAdminPage() {
  const [events,setEvents]=useState<EventItem[]>([]);
  const [eventId,setEventId]=useState("");
  const [title,setTitle]=useState("");
  const [maxChars,setMaxChars]=useState("500");
  const [book,setBook]=useState<BookItem|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{(async()=>{
    const supabase=createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const [{data:memberships},{data:platform}]=await Promise.all([
      supabase.from("memberships").select("company_id,role").eq("user_id",user.id).eq("active",true),
      supabase.from("platform_roles").select("role,active").eq("user_id",user.id).maybeSingle()
    ]);
    const privileged=Boolean(platform?.active&&platform.role==="developer");
    let query=supabase.from("events").select("id,display_name,company_id").order("event_date",{ascending:false});
    if(!privileged) {
      const ids=(memberships||[]).filter(m=>["company_admin","event_manager","developer"].includes(m.role)).map(m=>m.company_id);
      if(!ids.length){setError("Seu usuário não possui permissão para criar livros de recordações.");return;}
      query=query.in("company_id",ids);
    }
    const {data,error:loadError}=await query.limit(100);
    if(loadError){setError("Não foi possível carregar os eventos.");return;}
    setEvents(data||[]);
    if(data?.[0]){setEventId(data[0].id);setTitle("Livro de recordações — "+data[0].display_name);}
  })()},[]);

  async function createBook(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError("");setBook(null);
    try {
      const response=await fetch("/api/memory-book/create",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventId,title,maxChars:Number(maxChars)})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Falha ao criar livro.");
      setBook(result.book);
    } catch(e) {setError(e instanceof Error?e.message:"Falha ao criar livro.");}
    finally {setBusy(false);}
  }

  const guestUrl=book&&typeof window!=="undefined"?new URL("/recordacoes/"+book.slug,window.location.origin).toString():"";
  const qrUrl=guestUrl?"https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data="+encodeURIComponent(guestUrl):"";
  return <section className="page-content">
    <div className="page-heading"><div><span className="eyebrow">ITEM 10</span><h1>Livro de recordações</h1><p>Crie o acesso do convidado e gere um QR Code para colocar nas mesas.</p></div></div>
    <div className="panel" style={{maxWidth:760}}>
      <form onSubmit={createBook} style={{display:"grid",gap:16}}>
        <label>Evento<select required value={eventId} onChange={e=>{setEventId(e.target.value);const ev=events.find(x=>x.id===e.target.value);if(ev)setTitle("Livro de recordações — "+ev.display_name)}} style={{display:"block",width:"100%",padding:12,marginTop:6}}><option value="">Selecione um evento</option>{events.map(e=><option key={e.id} value={e.id}>{e.display_name}</option>)}</select></label>
        <label>Título do livro<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} style={{display:"block",width:"100%",padding:12,marginTop:6}}/></label>
        <label>Máximo de caracteres<input type="number" min={50} max={2000} step={1} value={maxChars} onChange={e=>setMaxChars(e.target.value)} style={{display:"block",width:160,padding:12,marginTop:6}}/><small>O padrão recomendado é 500 caracteres.</small></label>
        {error&&<p role="alert" className="form-error">{error}</p>}
        <button className="primary-button" disabled={busy||!events.length}>{busy?"Criando...":"Criar livro e QR Code"}</button>
      </form>
    </div>
    {book&&<div className="panel" style={{maxWidth:760,marginTop:24}}>
      <h2>{book.title}</h2><p>Limite de mensagem: {book.max_message_chars} caracteres</p>
      <p><a href={guestUrl} target="_blank" rel="noreferrer">{guestUrl}</a></p>
      <img src={qrUrl} alt={"QR Code para "+book.title} width={260} height={260} style={{display:"block",margin:"16px auto",maxWidth:"100%"}}/>
      <p>Imprima este QR Code e coloque nas mesas. O QR é gerado por um serviço externo e contém somente o link público do livro.</p>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}><button type="button" className="secondary-button" onClick={()=>navigator.clipboard.writeText(guestUrl)}>Copiar link do livro</button><a className="primary-button" href={"/app/recordacoes/"+book.slug}>Abrir mensagens e fotos</a></div>
    </div>}
    {!events.length&&!error&&<div className="empty">Nenhum evento disponível para seu perfil.</div>}
  </section>;
}
