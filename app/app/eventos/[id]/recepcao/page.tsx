import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import ReceptionConsole from "./reception-console";
export const dynamic="force-dynamic";
export default async function ReceptionPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const sb=await createClient();const {data:event}=await sb.from("events").select("id,display_name,event_date").eq("id",id).maybeSingle();if(!event)notFound();
 return <section className="page-content"><div className="page-heading"><div><Link className="back-link" href={"/app/eventos/"+id}>← Evento</Link><span className="eyebrow">RECEPÇÃO</span><h1>{event.display_name}</h1><p>Validação de ingressos individuais e controle de entrada em tempo real.</p></div></div><ReceptionConsole eventId={id}/></section>
}
