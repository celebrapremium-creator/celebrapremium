import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
const dateBR=(v:string|null)=>v?new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(new Date(v+"T12:00:00")):"Sem data";
const statusLabel:Record<string,string>={draft:"Rascunho",planning:"Planejamento",invitations:"Convites",confirmations:"Confirmações",live:"Em realização",completed:"Concluído",archived:"Arquivado",cancelled:"Cancelado"};
export default async function AppHome(){
 const supabase=await createClient(); const {data:claimsData}=await supabase.auth.getClaims(); const userId=claimsData?.claims?.sub;
 const [{data:memberships},{data:events},{count:companyCount}]=await Promise.all([
  supabase.from("memberships").select("company_id,role").eq("user_id",userId).eq("active",true),
  supabase.from("events").select("id,display_name,event_date,status,companies(name)").order("event_date",{ascending:true,nullsFirst:false}).limit(8),
  supabase.from("companies").select("id",{count:"exact",head:true})
 ]);
 const upcoming=(events??[]).filter(e=>e.status!=="archived"&&e.status!=="cancelled").slice(0,5);
 return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">CENTRAL DE GESTÃO</span><h1>Dashboard</h1><p>Visão operacional das empresas e eventos autorizados.</p></div><a className="primary-button" href="/app/eventos/novo">Novo evento</Link></div><div className="metric-grid"><div className="metric-card"><span>Empresas</span><strong>{companyCount??0}</strong><small>escopos ativos</small></div><div className="metric-card"><span>Vínculos</span><strong>{memberships?.length??0}</strong><small>participações empresariais</small></div><div className="metric-card"><span>Eventos</span><strong>{events?.length??0}</strong><small>registros visíveis</small></div></div><div className="content-grid"><section className="panel"><div className="panel-heading"><div><h2>Próximos eventos</h2><p>Dados reais protegidos por RLS.</p></div><Link href="/app/eventos">Ver todos</Link></div>{upcoming.length?<div className="event-list">{upcoming.map(e=><a className="event-row" href={"/app/eventos/"+e.id} key={e.id}><div><strong>{e.display_name}</strong><span>{e.companies?.name??"Empresa"} · {dateBR(e.event_date)}</span></div><b>{statusLabel[e.status]??e.status}</b></Link>)}</div>:<div className="empty">Nenhum evento cadastrado.</div>}</section><section className="panel"><div className="panel-heading"><div><h2>Atalhos</h2><p>Operações da Etapa 3.</p></div></div><div className="shortcut-grid"><Link href="/app/empresas">Gerenciar empresas</Link><Link href="/app/eventos/novo">Cadastrar evento</Link><Link href="/admin/access-requests">Revisar acessos</Link></div></section></div></section>;
}