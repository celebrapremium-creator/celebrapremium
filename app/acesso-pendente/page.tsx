"use client";
import { useEffect,useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PendingAccess(){const supabase=createClient();const params=useSearchParams();const [status,setStatus]=useState(params.get("status")||"pending");
 useEffect(()=>{(async()=>{const {data}=await supabase.from("access_requests").select("status").order("created_at",{ascending:false}).limit(1).maybeSingle();if(data?.status)setStatus(data.status)})()},[supabase]);
 const title=status==="rejected"?"Solicitação não aprovada":status==="suspended"||status==="revoked"?"Acesso suspenso":"Aguardando liberação do desenvolvedor";
 const text=status==="rejected"?"A solicitação não foi liberada. Entre em contato com a operação responsável.":status==="suspended"||status==="revoked"?"Seu acesso está bloqueado no momento. Entre em contato com a operação responsável.":"Sua solicitação foi recebida e permanece restrita até a análise e aprovação.";
 return <main className="simple-state"><div className="state-card"><span className="eyebrow">STATUS DO ACESSO</span><h1>{title}</h1><p>{text}</p><a className="secondary-button" href="/login">Voltar ao login</a></div></main>;
}
