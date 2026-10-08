import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GuestManager from "./guest-manager";

export const dynamic = "force-dynamic";

export default async function GuestsPage({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  const supabase = await createClient();
  const [{data:event},{data:families},{data:guests}] = await Promise.all([
    supabase.from("events").select("id,display_name,event_date").eq("id",id).maybeSingle(),
    supabase.from("guest_families").select("id,name,primary_contact_name,primary_contact_email,primary_contact_phone,max_invitees,notes,active").eq("event_id",id).order("name"),
    supabase.from("guests").select("id,family_id,full_name,category,is_family_responsible,companions_allowed,max_companions,notes,active,guest_private_details(email,phone,special_needs)").eq("event_id",id).order("full_name")
  ]);
  if (!event) notFound();
  const normalized = (guests ?? []).map((g:any) => ({...g,guest_private_details:Array.isArray(g.guest_private_details) ? g.guest_private_details[0] ?? null : g.guest_private_details}));
  return <section className="page-content">
    <div className="page-heading"><div><Link className="back-link" href={"/app/eventos/"+id}>← Evento</Link><span className="eyebrow">CONVIDADOS</span><h1>{event.display_name}</h1><p>Famílias, convidados, acompanhantes, contatos e importação controlada.</p></div></div>
    <GuestManager eventId={id} initialFamilies={families ?? []} initialGuests={normalized}/>
  </section>;
}