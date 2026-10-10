"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Photo={id:string;original_name:string;size_bytes:number;signed_url:string|null};
type Entry={id:string;message:string;moderation_status:string;created_at:string;memory_guests:{first_name:string;last_name:string;phone:string};memory_photos:Photo[]};

export default function MemoryBookDetailPage(){
 const params=useParams<{slug:string}>(); const slug=params.slug;
 const [book,setBook]=useState<{title:string}|null>(null);const [entries,setEntries]=useState<Entry[]>([]);
 const [error,setError]=useState("");const [busy,setBusy]=useState(true);
 async function load(){setBusy(true);setError("");try{const res=await fetch("/api/memory-book/"+encodeURIComponent(slug)+"/entries");const data=await res.json();if(!res.ok)throw new Error(data.error||"Falha ao carregar.");setBook(data.book);setEntries(data.entries||[]);}catch(e){setError(e instanceof Error?e.message:"Falha ao carregar recordações.");}finally{setBusy(false);}}
 useEffect(()=>{void load()},[slug]);
 return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">ITEM 10 · GALERIA PRIVADA</span><h1>{book?.title||"Recordações recebidas"}</h1><p>Mensagens e fotos enviadas pelos convidados, organizadas por pessoa.</p></div><button className="secondary-button" onClick={()=>void load()} disabled={busy}>Atualizar</button></div>
 {error&&<p role="alert" className="form-error">{error}</p>}{busy&&<div className="empty">Carregando recordações...</div>}
 {!busy&&!error&&!entries.length&&<div className="empty">Ainda não há recordações enviadas para este livro.</div>}
 <div style={{display:"grid",gap:18}}>{entries.map(entry=><article className="panel" key={entry.id}>
   <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><h2 style={{marginBottom:4}}>{entry.memory_guests.first_name} {entry.memory_guests.last_name}</h2><small>{entry.memory_guests.phone} · {new Date(entry.created_at).toLocaleString("pt-BR")}</small></div><span className="eyebrow">{entry.moderation_status==="approved"?"Aprovada":entry.moderation_status==="rejected"?"Rejeitada":"Aguardando revisão"}</span></div>
   <blockquote style={{whiteSpace:"pre-wrap",lineHeight:1.7,margin:"18px 0",paddingLeft:16,borderLeft:"3px solid #c6a7c9"}}>{entry.message}</blockquote>
   {entry.memory_photos.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:12}}>{entry.memory_photos.map(photo=><div key={photo.id}>{photo.signed_url?<a href={photo.signed_url} target="_blank" rel="noreferrer"><img src={photo.signed_url} alt={photo.original_name} style={{width:"100%",height:130,objectFit:"cover",borderRadius:10}}/></a>:<p>Foto indisponível</p>}<a href={photo.signed_url||"#"} download={photo.original_name} target="_blank" rel="noreferrer" style={{fontSize:12,overflowWrap:"anywhere"}}>{photo.original_name}</a><small style={{display:"block"}}>{(photo.size_bytes/1024/1024).toFixed(1)} MB</small></div>)}</div>}
 </article>)}</div></section>;
}
