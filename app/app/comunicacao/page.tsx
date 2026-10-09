import { createClient } from "@/lib/supabase/server";
import CommunicationManager from "./communication-manager";

export const dynamic = "force-dynamic";

type Membership = { company_id: string; role: string; active: boolean };

export default async function CommunicationPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: memberships } = await supabase
    .from("memberships")
    .select("company_id,role,active")
    .eq("user_id", userId)
    .eq("active", true);

  const permitted = ((memberships ?? []) as Membership[]).filter((m) =>
    ["company_admin", "event_manager", "developer"].includes(m.role)
  );
  const companyIds = [...new Set(permitted.map((m) => m.company_id))];
  if (!companyIds.length) {
    return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">RELACIONAMENTO</span><h1>Comunicação</h1><p>Modelos, canais e histórico operacional.</p></div></div><div className="panel"><h2>Acesso restrito</h2><p className="muted">A configuração de comunicação exige perfil de administrador da empresa ou gestor de evento.</p></div></section>;
  }

  const { data: companies } = await supabase.from("companies").select("id,name").in("id", companyIds).order("name");
  return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">RELACIONAMENTO</span><h1>Comunicação</h1><p>Organize canais, modelos e a fila de mensagens por empresa.</p></div></div><CommunicationManager companies={(companies ?? []).map((c) => ({ id: c.id, name: c.name }))} /></section>;
}
