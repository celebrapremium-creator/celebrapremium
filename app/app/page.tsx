import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export default async function AppHome(){
 const supabase=await createClient();
 const {data:claimsData}=await supabase.auth.getClaims();
 const claims=claimsData?.claims;
 if(!claims?.sub)redirect("/login");
 const [{data:platform},{data:memberships}]=await Promise.all([
  supabase.from("platform_roles").select("role,active").eq("user_id",claims.sub).maybeSingle(),
  supabase.from("memberships").select("role,active,company_id").eq("user_id",claims.sub).eq("active",true)
 ]);
 if(!platform?.active&&!memberships?.length)redirect("/acesso-pendente");
 return <main className="app-shell"><header className="app-topbar"><div className="brand-wordmark">CELEBRA <strong>PREMIUM</strong></div><nav><a href="/admin/access-requests">Solicitações</a><a href="/logout">Sair</a></nav></header><section className="app-content"><span className="eyebrow">AMBIENTE AUTORIZADO</span><h1>Bem-vindo ao CELEBRA PREMIUM</h1><p>Autenticação, sessões e autorização por empresa/evento estão ativas. Os módulos operacionais entram nas próximas etapas.</p><div className="app-grid"><div><strong>Perfil</strong><p>{platform?.active?"Desenvolvedor":"Usuário autorizado"}</p></div><div><strong>Escopos</strong><p>{memberships?.length??0} empresa(s) autorizada(s)</p></div></div></section></main>;
}
