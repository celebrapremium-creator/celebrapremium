import "./ai.css";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MemoriesAIManager from "./memories-ai-manager";

export const dynamic = "force-dynamic";

export default async function MemoriesAIPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ data: memberships }, { data: platform }] = await Promise.all([
    supabase.from("memberships").select("company_id,role,companies(id,name)").eq("user_id", userId).eq("active", true),
    supabase.from("platform_roles").select("role,active").eq("user_id", userId).maybeSingle(),
  ]);
  const canManage = Boolean(platform?.active) || Boolean(memberships?.some((m) =>
    ["company_admin", "event_manager", "developer"].includes(m.role)));
  if (!canManage) redirect("/acesso-pendente");

  const companies = (memberships || [])
    .filter((m) => ["company_admin", "event_manager", "developer"].includes(m.role) || platform?.active)
    .map((m) => {
      const joined = m.companies as unknown as { id: string; name: string } | { id: string; name: string }[] | null;
      const company = Array.isArray(joined) ? joined[0] : joined;
      return company ? { id: company.id, name: company.name } : null;
    })
    .filter((item): item is { id: string; name: string } => Boolean(item))
    .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index);

  const companyIds = companies.map((c) => c.id);
  if (!companyIds.length) {
    return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">CELEBRA MEMORIES AI</span><h1>IA editorial</h1><p>Não há empresa com permissão de gestão disponível para esta conta.</p></div></div></section>;
  }

  const { data: eventRows } = await supabase.from("events").select("id,company_id,display_name,event_date").in("company_id", companyIds).order("event_date", { ascending: false });
  const eventIds = (eventRows || []).map((e) => e.id);
  const [{ data: policies }, { data: settings }, { data: jobs }] = await Promise.all([
    supabase.from("ai_company_policies").select("company_id,enabled,monthly_request_limit,monthly_budget_usd,max_input_chars").in("company_id", companyIds),
    eventIds.length ? supabase.from("event_album_settings").select("event_id,ai_enabled").in("event_id", eventIds) : Promise.resolve({ data: [] }),
    supabase.from("ai_editorial_jobs").select("id,company_id,event_id,status,output_document,model,input_tokens,output_tokens,estimated_cost_usd,review_note,created_at").in("company_id", companyIds).order("created_at", { ascending: false }).limit(50),
  ]);

  return <MemoriesAIManager
    companies={companies}
    events={(eventRows || []).map((e) => ({ id: e.id, companyId: e.company_id, name: e.display_name, date: e.event_date }))}
    policies={(policies || []).map((p) => ({ companyId: p.company_id, enabled: p.enabled, monthlyRequestLimit: p.monthly_request_limit, monthlyBudgetUsd: Number(p.monthly_budget_usd), maxInputChars: p.max_input_chars }))}
    settings={(settings || []).map((s) => ({ eventId: s.event_id, enabled: s.ai_enabled }))}
    jobs={(jobs || []).map((j) => ({ id: j.id, companyId: j.company_id, eventId: j.event_id, status: j.status, output: j.output_document, model: j.model, inputTokens: j.input_tokens, outputTokens: j.output_tokens, cost: Number(j.estimated_cost_usd), reviewNote: j.review_note, createdAt: j.created_at }))}
  />;
}
