import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import GiftManager from "./gift-manager";
export const dynamic="force-dynamic";
export default async function GiftsPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const sb=await createClient();const {data:event}=await sb.from("events").select("id,display_name").eq("id",id).maybeSingle();if(!event)notFound();
 return <section className="page-content"><div className="page-heading"><div><Link className="back-link" href={"/app/eventos/"+id}>← Evento</Link><span className="eyebrow">PRESENTES & FINANCEIRO</span><h1>{event.display_name}</h1><p>Lista de presentes, reservas e acompanhamento das contribuições.</p></div></div><GiftManager eventId={id}/></section>
}
