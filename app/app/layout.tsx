import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
 const supabase=await createClient(); const {data:claimsData}=await supabase.auth.getClaims(); const userId=claimsData?.claims?.sub;
 if(!userId) redirect("/login");
 const [{data:memberships},{data:platform}]=await Promise.all([
  supabase.from("memberships").select("id,company_id,role,active,companies(name)").eq("user_id",userId).eq("active",true),
  supabase.from("platform_roles").select("role,active").eq("user_id",userId).maybeSingle()
 ]);
 if(!platform?.active && !memberships?.length) redirect("/acesso-pendente");
 const canManageCommunication = Boolean(platform?.active) || Boolean(memberships?.some((m) => ["company_admin","event_manager","developer"].includes(m.role)));
 return <div className="product-shell"><aside className="product-sidebar"><Link className="sidebar-brand" href="/app"><Image src="/brand/celebra-premium-logo.svg" alt="CELEBRA PREMIUM" width={210} height={140} priority /></Link><nav className="sidebar-nav"><Link href="/app">Dashboard</Link><Link href="/app/empresas">Empresas</Link><Link href="/app/eventos">Eventos</Link>{canManageCommunication&&<Link href="/app/comunicacao">Comunicação</Link>}{canManageCommunication&&<Link href="/app/ia">Celebra Memories AI</Link>}{platform?.active&&<Link href="/admin/access-requests">Solicitações</Link>}</nav><div className="sidebar-footer"><span>{platform?.active?"Desenvolvedor":memberships?.[0]?.role?.replace("_"," ")}</span><Link href="/logout">Sair</Link></div></aside><main className="product-main">{children}</main></div>;
}
