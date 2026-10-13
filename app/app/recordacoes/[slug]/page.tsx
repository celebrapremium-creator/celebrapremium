"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Photo={id:string;original_name:string;size_bytes:number;signed_url:string|null};
type Entry={id:string;message:string;moderation_status:string;created_at:string;memory_guests:{first_name:string;last_name:string;phone:string};memory_photos:Photo[]};

export default function MemoryBookDetailPage(){
 const params=useParams<{slug:string}>(); const slug=params.slug;
 const [book,setBook]=useState<{title:string}|null>(null);const [entries,setEntries]=useState<Entry[]>([]);
 const [error,setError]=useState("");const [busy,setBusy]=useState(true);const [moderating,setModerating]=useState<string|null>(null);
 const load=useCallback(async ()=>{
   try {
     const res=await fetch("/api/memory-book/"+encodeURIComponent(slug)+"/entries");
     const data=await res.json();
     if(!res.ok)throw new Error(data.error||"Falha ao carregar.");
     setBook(data.book);setEntries(data.entries||[]);setError("");
   } catch(e) {
     setError(e instanceof Error?e.message:"Falha ao carregar recordações.");
   } finally {
     setBusy(false);
   }
 },[slug]);
 const moderate=useCallback(async (entryId:string,status:"approved"|"rejected"|"pending")=>{setModerating(entryId);setError("");try{const res=await fetch("/api/memory-book/"+encodeURIComponent(slug)+"/moderate",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({entryId,status})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Não foi possível atualizar a moderação.");await load();}catch(e){setError(e instanceof Error?e.message:"Falha na moderação.");}finally{setModerating(null);}},[slug,load]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- data loading is asynchronous and guarded by the request lifecycle.
 useEffect(()=>{void load()},[load]);
 return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">ITEM 10 · GALERIA PRIVADA</span><h1>{book?.title||"Recordações recebidas"}</h1><p>Mensagens e fotos enviadas pelos convidados, organizadas por pessoa.</p></div><button className="secondary-button" onClick={()=>void load()} disabled={busy}>Atualizar</button></div>
 {error&&<p role="alert" className="form-error">{error}</p>}{busy&&<div className="empty">Carregando recordações...</div>}
 {!busy&&!error&&!entries.length&&<div className="empty">Ainda não há recordações enviadas para este livro.</div>}
 <div style={{display:"grid",gap:18}}>{entries.map(entry=><article className="panel" key={entry.id}>
   <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><h2 style={{marginBottom:4}}>{entry.memory_guests.first_name} {entry.memory_guests.last_name}</h2><small>{entry.memory_guests.phone} · {new Date(entry.created_at).toLocaleString("pt-BR")}</small></div><div style={{display:"grid",gap:8,justifyItems:"end"}}><span className="eyebrow">{entry.moderation_status==="approved"?"Aprovada":entry.moderation_status==="rejected"?"Rejeitada":"Aguardando revisão"}</span><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><button className="secondary-button" disabled={moderating===entry.id||entry.moderation_status==="approved"} onClick={()=>void moderate(entry.id,"approved")}>{moderating===entry.id?"Salvando...":"Aprovar"}</button><button className="secondary-button" disabled={moderating===entry.id||entry.moderation_status==="rejected"} onClick={()=>void moderate(entry.id,"rejected")}>Rejeitar</button></div></div></div>
   <blockquote style={{whiteSpace:"pre-wrap",lineHeight:1.7,margin:"18px 0",paddingLeft:16,borderLeft:"3px solid #c6a7c9"}}>{entry.message}</blockquote>
   {entry.memory_photos.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:12}}>{entry.memory_photos.map(photo=><div key={photo.id}>{photo.signed_url?<a href={photo.signed_url} target="_blank" rel="noreferrer"><img src={photo.signed_url} alt={photo.original_name} style={{width:"100%",height:130,objectFit:"cover",borderRadius:10}}/></a>:<p>Foto indisponível</p>}<a href={photo.signed_url||"#"} download={photo.original_name} target="_blank" rel="noreferrer" style={{fontSize:12,overflowWrap:"anywhere"}}>{photo.original_name}</a><small style={{display:"block"}}>{(photo.size_bytes/1024/1024).toFixed(1)} MB</small></div>)}</div>}
 </article>)}</div></section>;
}
