import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import MemoryManager from "./memory-manager";
export const dynamic="force-dynamic";
export default async function MemoriesPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const sb=await createClient();const {data:event}=await sb.from("events").select("id,display_name").eq("id",id).maybeSingle();if(!event)notFound();
 return <section className="page-content"><div className="page-heading"><div><Link className="back-link" href={"/app/eventos/"+id}>← Evento</Link><span className="eyebrow">MEMÓRIAS & ÁLBUM</span><h1>{event.display_name}</h1><p>Mensagens, fotos e moderação do álbum do evento.</p></div></div><MemoryManager eventId={id}/></section>
}