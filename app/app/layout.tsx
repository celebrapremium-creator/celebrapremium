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
 return <div className="product-shell"><aside className="product-sidebar"><a className="sidebar-brand" href="/app"><Image src="/brand/celebra-premium-logo.svg" alt="CELEBRA PREMIUM" width={210} height={140} priority /></a><nav className="sidebar-nav"><a href="/app">Dashboard</a><a href="/app/empresas">Empresas</a><a href="/app/eventos">Eventos</a>{platform?.active&&<a href="/admin/access-requests">Solicitações</a>}</nav><div className="sidebar-footer"><span>{platform?.active?"Desenvolvedor":memberships?.[0]?.role?.replace("_"," ")}</span><a href="/logout">Sair</a></div></aside><main className="product-main">{children}</main></div>;
}