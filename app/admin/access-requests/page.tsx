"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row={id:string;full_name:string;email:string;event_name_snapshot:string;requested_role:string|null};

export default function AccessRequests(){
 const supabase=createClient();
 const [rows,setRows]=useState<Row[]>([]);
 const [selected,setSelected]=useState("");
 const [role,setRole]=useState("event_manager");
 const [message,setMessage]=useState("");

 async function load(){
  const {data:user}=await supabase.auth.getUser();
  const {data:platform}=await supabase.from("platform_roles").select("role,active").eq("user_id",user.user?.id||"").maybeSingle();
  if(!platform?.active||platform.role!=="developer"){window.location.href="/app";return}
  const {data}=await supabase.from("access_requests").select("id,full_name,email,event_name_snapshot,requested_role").eq("status","pending").order("created_at",{ascending:true});
  setRows((data||[]) as Row[]);
 }
 useEffect(()=>{load()},[]);

 async function review(decision:"approved"|"rejected"){
  if(!selected)return;
  const {error}=await supabase.rpc("review_access_request",{p_request_id:selected,p_decision:decision,p_granted_role:decision==="approved"?role:null});
  setMessage(error?"Não foi possível concluir a análise.":decision==="approved"?"Acesso aprovado.":"Solicitação recusada.");
  if(!error){setSelected("");await load();}
 }

 return <main className="app-shell"><header className="app-topbar"><div className="brand-wordmark">CELEBRA <strong>PREMIUM</strong></div><a href="/app">Voltar</a></header><section className="app-content"><span className="eyebrow">DESENVOLVEDOR</span><h1>Solicitações de acesso</h1><p>Somente o Desenvolvedor libera nível e vínculo.</p>{message&&<div className="notice">{message}</div>}<div className="request-list">{rows.length===0?<div className="empty">Nenhuma solicitação pendente.</div>:rows.map(r=><article className={"request-item "+(selected===r.id?"selected":"")} key={r.id} onClick={()=>setSelected(r.id)}><div><strong>{r.full_name}</strong><span>{r.email}</span><span>Evento: {r.event_name_snapshot}</span><small>Função pretendida: {r.requested_role||"não informada"}</small></div>{selected===r.id&&<div className="request-actions"><select value={role} onChange={e=>setRole(e.target.value)}>{["company_admin","event_manager","contractor","ceremonialist","finance","receptionist","viewer"].map(v=><option key={v} value={v}>{v}</option>)}</select><button className="primary-button" onClick={e=>{e.stopPropagation();review("approved")}}>Aprovar</button><button className="danger-button" onClick={e=>{e.stopPropagation();review("rejected")}}>Recusar</button></div>}</article>)}</div></section></main>
}
