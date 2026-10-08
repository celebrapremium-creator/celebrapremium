import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import InvitationManager from "./invitation-manager";
export const dynamic="force-dynamic";
export default async function InvitationsPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const sb=await createClient();const {data:event}=await sb.from("events").select("id,display_name,event_date").eq("id",id).maybeSingle();if(!event)notFound();
 return <section className="page-content"><div className="page-heading"><div><Link className="back-link" href={"/app/eventos/"+id}>← Evento</Link><span className="eyebrow">CONVITES</span><h1>{event.display_name}</h1><p>Convites individuais e confirmação em três etapas.</p></div></div><InvitationManager eventId={id}/></section>
}
