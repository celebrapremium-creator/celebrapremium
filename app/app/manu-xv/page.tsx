import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createTestAdminClient } from "@/lib/supabase/test-admin";

export const dynamic = "force-dynamic";

const stage1Label: Record<string, string> = {
  confirmed: "Confirmado na etapa 1",
  pending: "Pendente na etapa 1",
  declined: "Recusou",
  admin_review_required: "Revisão administrativa",
};
const stage2Label: Record<string, string> = {
  blocked: "Bloqueada",
  awaiting_name: "Aguardando nome",
  name_received: "Nome recebido",
  validated: "Nome validado",
};
const stage3Label: Record<string, string> = {
  blocked: "Bloqueada",
  ready: "Pronta para QR",
  qr_generated: "QR gerado",
  sent: "Enviado",
  invalidated: "Invalidado",
};

export default async function ManuXVPage() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  const { data: platformRole } = await authClient
    .from("platform_roles")
    .select("role,active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!platformRole?.active || platformRole.role !== "developer") {
    redirect("/acesso-pendente");
  }

  const testClient = createTestAdminClient();
  if (!testClient) {
    return <section className="page-content">
      <div className="page-heading"><div><span className="eyebrow">AMBIENTE DE TESTES</span><h1>Convidados · MANU XV</h1><p>O acesso aos dados está protegido e restrito a desenvolvedores.</p></div></div>
      <div className="panel"><h2>Configuração pendente</h2><p>Configure <code>SUPABASE_TEST_URL</code> e <code>SUPABASE_TEST_SERVICE_ROLE_KEY</code> somente no ambiente Preview da Vercel. A chave secreta é usada exclusivamente no servidor e nunca deve ter prefixo <code>NEXT_PUBLIC_</code>.</p></div>
    </section>;
  }

  const { data: imported, error: importError } = await testClient
    .from("test_report_imports")
    .select("id,event_name,source_file,created_at")
    .eq("event_name", "MANU XV")
    .eq("is_test", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (importError) throw new Error("Não foi possível consultar a importação de teste.");
  if (!imported) {
    return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">AMBIENTE DE TESTES</span><h1>Convidados · MANU XV</h1><p>Nenhuma lista de teste foi associada a este evento.</p></div></div><div className="panel">Importe a lista autorizada para o banco de testes antes de continuar.</div></section>;
  }

  const { data: families, error: familyError } = await testClient
    .from("test_event_families")
    .select("id,family_name")
    .eq("import_id", imported.id)
    .eq("is_test", true);
  if (familyError) throw new Error("Não foi possível consultar as famílias de teste.");

  const familyIds = (families ?? []).map((family) => family.id);
  const { data: participants, error: participantError } = familyIds.length
    ? await testClient
        .from("test_participant_records")
        .select("id,family_id,full_name,stage_1_status,stage_2_status,stage_3_status,entrance_status,checked_in_at")
        .in("family_id", familyIds)
        .eq("is_test", true)
        .order("full_name", { ascending: true })
    : { data: [], error: null };
  if (participantError) throw new Error("Não foi possível consultar os convidados de teste.");

  const familyNameById = new Map((families ?? []).map((family) => [family.id, family.family_name]));
  const rows = participants ?? [];
  const confirmed = rows.filter((person) => person.stage_1_status === "confirmed").length;
  const pending = rows.filter((person) => person.stage_1_status === "pending").length;
  const validated = rows.filter((person) => person.stage_2_status === "validated").length;
  const checkedIn = rows.filter((person) => person.entrance_status === "checked_in").length;

  return <section className="page-content">
    <div className="page-heading"><div><span className="eyebrow">AMBIENTE DE TESTES · SOMENTE DESENVOLVEDOR</span><h1>Convidados · MANU XV</h1><p>Lista importada: {imported.source_file}. Nenhuma confirmação ou entrada é alterada por esta tela.</p></div><div className="heading-actions"><Link className="secondary-button" href="/app">Voltar ao painel</Link><a className="primary-button" href="/app/manu-xv/export">Exportar CSV para Excel</a></div></div>
    <div className="metric-grid">
      <div className="metric-card"><span>Convidados</span><strong>{rows.length}</strong><small>registros importados</small></div>
      <div className="metric-card"><span>Confirmados na etapa 1</span><strong>{confirmed}</strong><small>{pending} pendentes na origem</small></div>
      <div className="metric-card"><span>Nomes validados</span><strong>{validated}</strong><small>etapa 2</small></div>
      <div className="metric-card"><span>Entradas registradas</span><strong>{checkedIn}</strong><small>check-in de teste</small></div>
    </div>
    <div className="panel">
      <div className="panel-heading"><div><h2>Lista de convidados</h2><p>{families?.length ?? 0} famílias · ordem alfabética pelo nome cadastrado</p></div><span className="muted">Somente leitura</span></div>
      <div className="table-wrap"><table><thead><tr><th>Nome na lista</th><th>Família</th><th>Etapa 1</th><th>Etapa 2</th><th>Etapa 3</th><th>Entrada</th></tr></thead><tbody>
      {rows.map((person) => <tr key={person.id}><td>{person.full_name || "Nome não informado"}</td><td>{familyNameById.get(person.family_id) ?? "—"}</td><td>{stage1Label[person.stage_1_status] ?? person.stage_1_status}</td><td>{stage2Label[person.stage_2_status] ?? person.stage_2_status}</td><td>{stage3Label[person.stage_3_status] ?? person.stage_3_status}</td><td>{person.entrance_status === "checked_in" ? "Entrada registrada" : "Não chegou"}</td></tr>)}
      </tbody></table></div>
    </div>
  </section>;
}
