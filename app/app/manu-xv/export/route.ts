import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTestAdminClient } from "@/lib/supabase/test-admin";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return '"' + text.replace(/"/g, '""') + '"';
}

export async function GET() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: role } = await authClient
    .from("platform_roles")
    .select("role,active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!role?.active || role.role !== "developer") {
    return NextResponse.json({ error: "Acesso restrito a desenvolvedores." }, { status: 403 });
  }

  const testClient = createTestAdminClient();
  if (!testClient) return NextResponse.json({ error: "Banco de testes não configurado." }, { status: 503 });

  const { data: imported, error: importError } = await testClient
    .from("test_report_imports")
    .select("id")
    .eq("event_name", "MANU XV")
    .eq("is_test", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (importError) return NextResponse.json({ error: "Falha ao consultar importação." }, { status: 500 });
  if (!imported) return NextResponse.json({ error: "Lista MANU XV não encontrada." }, { status: 404 });

  const { data: families, error: familyError } = await testClient
    .from("test_event_families")
    .select("id,family_name")
    .eq("import_id", imported.id)
    .eq("is_test", true);
  if (familyError) return NextResponse.json({ error: "Falha ao consultar famílias." }, { status: 500 });

  const ids = (families ?? []).map((family) => family.id);
  const { data: participants, error: participantError } = ids.length
    ? await testClient.from("test_participant_records")
        .select("family_id,full_name,stage_1_status,stage_2_status,stage_3_status,entrance_status")
        .in("family_id", ids)
        .eq("is_test", true)
    : { data: [], error: null };
  if (participantError) return NextResponse.json({ error: "Falha ao consultar convidados." }, { status: 500 });

  const familyNameById = new Map((families ?? []).map((family) => [family.id, family.family_name]));
  const sorted = [...(participants ?? [])].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR"));
  const lines = [
    ["Nome na lista", "Família", "Etapa 1", "Etapa 2", "Etapa 3", "Entrada"],
    ...sorted.map((person) => [
      person.full_name ?? "",
      familyNameById.get(person.family_id) ?? "",
      person.stage_1_status,
      person.stage_2_status,
      person.stage_3_status,
      person.entrance_status,
    ]),
  ];
  const csv = "\uFEFF" + lines.map((line) => line.map(csvCell).join(";")).join("\r\n");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="MANU-XV-convidados.csv"',
      "Cache-Control": "no-store",
    },
  });
}
