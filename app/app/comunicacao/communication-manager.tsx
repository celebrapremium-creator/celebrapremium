"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Company = { id: string; name: string };
type Channel = { id: string; company_id: string; channel_type: string; display_name: string; address: string; status: string; is_primary: boolean; provider: string | null; provider_account_ref: string | null; created_at: string };
type Template = { id: string; company_id: string; channel_type: string; name: string; subject: string | null; body: string; active: boolean; version: number; updated_at: string };
type EventItem = { id: string; display_name: string; event_date: string | null };
type QueueItem = { id: string; recipient_address: string; status: string; scheduled_at: string | null; attempts: number; last_error: string | null; created_at: string; payload: { subject?: string | null; body?: string } | null; channel_id: string | null; event_id: string | null; template_id: string | null };
type LogItem = { id: string; recipient_address: string; status: string; provider_status: string | null; error_code: string | null; error_message: string | null; sent_at: string | null; delivered_at: string | null; created_at: string };
const channelLabels: Record<string,string> = { whatsapp: "WhatsApp", sms: "SMS", email: "E-mail" };
const statusLabels: Record<string,string> = { pending: "Pendente de configuração", active: "Ativo", inactive: "Inativo", replaced: "Substituído", queued: "Na fila", processing: "Processando", sent: "Enviado", delivered: "Entregue", failed: "Falhou", cancelled: "Cancelado" };

export default function CommunicationManager({ companies }: { companies: Company[] }) {
  const sb = createClient();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [channelType, setChannelType] = useState("whatsapp");
  const [channelName, setChannelName] = useState("");
  const [channelAddress, setChannelAddress] = useState("");
  const [provider, setProvider] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const [makePrimary, setMakePrimary] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [templateType, setTemplateType] = useState("whatsapp");
  const [templateName, setTemplateName] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [queueChannelId, setQueueChannelId] = useState("");
  const [queueTemplateId, setQueueTemplateId] = useState("");
  const [queueEventId, setQueueEventId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  async function load() {
    if (!companyId) return;
    const [ch, tp, ev, qu, lg] = await Promise.all([
      sb.from("communication_channels").select("id,company_id,channel_type,display_name,address,status,is_primary,provider,provider_account_ref,created_at").eq("company_id", companyId).order("created_at", { ascending: false }),
      sb.from("message_templates").select("id,company_id,channel_type,name,subject,body,active,version,updated_at").eq("company_id", companyId).order("updated_at", { ascending: false }),
      sb.from("events").select("id,display_name,event_date").eq("company_id", companyId).order("event_date", { ascending: true, nullsFirst: false }),
      sb.from("message_queue").select("id,recipient_address,status,scheduled_at,attempts,last_error,created_at,payload,channel_id,event_id,template_id").eq("company_id", companyId).order("created_at", { ascending: false }).limit(30),
      sb.from("message_logs").select("id,recipient_address,status,provider_status,error_code,error_message,sent_at,delivered_at,created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(30)
    ]);
    const failed = [ch.error, tp.error, ev.error, qu.error, lg.error].find(Boolean);
    if (failed) throw failed;
    setChannels((ch.data ?? []) as Channel[]);
    setTemplates((tp.data ?? []) as Template[]);
    setEvents((ev.data ?? []) as EventItem[]);
    setQueue((qu.data ?? []) as QueueItem[]);
    setLogs((lg.data ?? []) as LogItem[]);
    const currentChannels = (ch.data ?? []) as Channel[];
    setQueueChannelId((old) => old && currentChannels.some((c) => c.id === old) ? old : currentChannels[0]?.id ?? "");
  }
  useEffect(() => { setError(""); void load().catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar a comunicação.")); }, [companyId]);

  const queueChannel = channels.find((c) => c.id === queueChannelId);
  const queueTemplates = useMemo(() => templates.filter((t) => t.active && (!queueChannel || t.channel_type === queueChannel.channel_type)), [templates, queueChannel]);
  const pendingCount = queue.filter((m) => m.status === "queued").length;
  const failedCount = queue.filter((m) => m.status === "failed").length;

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await load(); setNotice(success); }
    catch (e) { setError(e instanceof Error ? e.message : "A operação não foi concluída."); }
    finally { setBusy(false); }
  }
  async function saveChannel() {
    await runAction(async () => {
      const { error } = await sb.rpc("save_communication_channel", {
        p_company_id: companyId, p_channel_type: channelType, p_display_name: channelName,
        p_address: channelAddress, p_provider: provider || null, p_provider_account_ref: providerRef || null, p_make_primary: makePrimary
      });
      if (error) throw error;
      setChannelName(""); setChannelAddress(""); setProvider(""); setProviderRef("");
    }, "Canal cadastrado. Ele permanece pendente até a integração real do provedor.");
  }
  async function saveTemplate() {
    await runAction(async () => {
      const { error } = await sb.rpc("save_message_template", {
        p_company_id: companyId, p_channel_type: templateType, p_name: templateName,
        p_subject: templateSubject || null, p_body: templateBody, p_template_id: editingTemplateId || null
      });
      if (error) throw error;
      setTemplateName(""); setTemplateSubject(""); setTemplateBody(""); setEditingTemplateId("");
    }, "Modelo salvo com controle de versão.");
  }
  async function enqueueMessage() {
    await runAction(async () => {
      if (!queueChannelId) throw new Error("Cadastre ou selecione um canal primeiro.");
      const { error } = await sb.rpc("enqueue_communication", {
        p_company_id: companyId, p_channel_id: queueChannelId, p_recipient_address: recipient,
        p_body: messageBody, p_subject: messageSubject || null, p_template_id: queueTemplateId || null,
        p_event_id: queueEventId || null, p_scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null
      });
      if (error) throw error;
      setRecipient(""); setMessageSubject(""); setMessageBody(""); setScheduledAt(""); setQueueTemplateId(""); setQueueEventId("");
    }, "Mensagem registrada na fila. Nenhum envio externo foi executado.");
  }
  function loadTemplateIntoQueue(id: string) {
    setQueueTemplateId(id);
    const t = templates.find((item) => item.id === id);
    if (t) { setMessageSubject(t.subject ?? ""); setMessageBody(t.body); }
  }
  function editTemplate(t: Template) {
    setEditingTemplateId(t.id); setTemplateType(t.channel_type); setTemplateName(t.name);
    setTemplateSubject(t.subject ?? ""); setTemplateBody(t.body);
    document.getElementById("communication-template-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className="communication-page">
    {error && <div className="form-error" role="alert">{error}</div>}
    {notice && <div className="checkin-result accepted" role="status">{notice}</div>}
    <section className="panel communication-company"><label>Empresa ativa<select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="secondary-button" disabled={busy} onClick={() => void load().catch((e) => setError(e.message))}>Atualizar dados</button></section>
    <div className="metric-grid"><article className="metric-card"><span>Canais cadastrados</span><strong>{channels.length}</strong><small>aguardando integração quando pendentes</small></article><article className="metric-card"><span>Mensagens na fila</span><strong>{pendingCount}</strong><small>não significa envio realizado</small></article><article className="metric-card"><span>Falhas registradas</span><strong>{failedCount}</strong><small>últimos 30 itens da fila</small></article></div>
    <div className="communication-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Canais e remetentes</h2><p>Cadastre WhatsApp, SMS ou e-mail da empresa.</p></div></div>
        <form className="stack-form" onSubmit={(e) => { e.preventDefault(); void saveChannel(); }}>
          <label>Tipo de canal<select value={channelType} onChange={(e) => setChannelType(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">E-mail</option></select></label>
          <label>Nome de exibição<input required minLength={2} maxLength={100} value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="Ex.: WhatsApp principal" /></label>
          <label>Número ou endereço<input required minLength={3} maxLength={320} value={channelAddress} onChange={(e) => setChannelAddress(e.target.value)} placeholder={channelType === "email" ? "comunicacao@empresa.com.br" : "+55 11 99999-9999"} /></label>
          <label>Provedor (opcional)<input maxLength={80} value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Ex.: provedor contratado" /></label>
          <label>Referência da conta (opcional)<input maxLength={200} value={providerRef} onChange={(e) => setProviderRef(e.target.value)} placeholder="ID público da conta, sem segredo" /></label>
          <label className="check-row"><input type="checkbox" checked={makePrimary} onChange={(e) => setMakePrimary(e.target.checked)} /> Definir como principal deste tipo</label>
          <button className="primary-button" disabled={busy || !companyId}>Cadastrar canal</button>
        </form>
        <div className="communication-list">{channels.map((c) => <article className="communication-item" key={c.id}><div><strong>{c.display_name}</strong><p>{channelLabels[c.channel_type] ?? c.channel_type} · {c.address}</p><small>{c.provider || "Provedor não configurado"}{c.provider_account_ref ? " · Conta: " + c.provider_account_ref : ""}</small></div><span className={"status-pill " + c.status}>{statusLabels[c.status] ?? c.status}</span></article>)}{!channels.length && <div className="empty">Nenhum canal cadastrado para esta empresa.</div>}</div>
      </section>
      <section className="panel" id="communication-template-form"><div className="panel-heading"><div><h2>Modelos de mensagem</h2><p>Use variáveis como {"{{nome_convidado}}"}, {"{{nome_evento}}"} e {"{{link_convite}}"} no texto.</p></div></div>
        <form className="stack-form" onSubmit={(e) => { e.preventDefault(); void saveTemplate(); }}>
          <label>Tipo de canal<select value={templateType} onChange={(e) => setTemplateType(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">E-mail</option></select></label>
          <label>Nome do modelo<input required minLength={2} maxLength={120} value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ex.: Convite inicial" /></label>
          {templateType === "email" && <label>Assunto do e-mail<input required maxLength={200} value={templateSubject} onChange={(e) => setTemplateSubject(e.target.value)} placeholder="Você está convidado!" /></label>}
          <label>Conteúdo<textarea required maxLength={10000} rows={5} value={templateBody} onChange={(e) => setTemplateBody(e.target.value)} placeholder="Olá {{nome_convidado}}, esperamos você em {{nome_evento}}." /></label>
          <div className="communication-actions"><button className="primary-button" disabled={busy || !companyId}>{editingTemplateId ? "Salvar nova versão" : "Salvar modelo"}</button>{editingTemplateId && <button type="button" className="secondary-button" onClick={() => { setEditingTemplateId(""); setTemplateName(""); setTemplateSubject(""); setTemplateBody(""); }}>Cancelar edição</button>}</div>
        </form>
        <div className="communication-list">{templates.map((t) => <article className="communication-item" key={t.id}><div><strong>{t.name}</strong><p>{channelLabels[t.channel_type] ?? t.channel_type} · v{t.version}{t.subject ? " · " + t.subject : ""}</p><small>{t.body.slice(0,150)}{t.body.length > 150 ? "…" : ""}</small></div><button className="secondary-button" disabled={busy} onClick={() => editTemplate(t)}>Editar</button></article>)}{!templates.length && <div className="empty">Nenhum modelo cadastrado.</div>}</div>
      </section>
    </div>
    <section className="panel"><div className="panel-heading"><div><h2>Adicionar à fila</h2><p>Prepara a mensagem para processamento futuro; não dispara WhatsApp, SMS ou e-mail.</p></div></div>
      <form className="stack-form communication-compose" onSubmit={(e) => { e.preventDefault(); void enqueueMessage(); }}>
        <label>Canal<select required value={queueChannelId} onChange={(e) => { setQueueChannelId(e.target.value); setQueueTemplateId(""); }}><option value="">Selecione um canal</option>{channels.map((c) => <option key={c.id} value={c.id}>{channelLabels[c.channel_type]} · {c.display_name} ({statusLabels[c.status] ?? c.status})</option>)}</select></label>
        <label>Modelo (opcional)<select value={queueTemplateId} onChange={(e) => loadTemplateIntoQueue(e.target.value)}><option value="">Mensagem personalizada</option>{queueTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Evento (opcional)<select value={queueEventId} onChange={(e) => setQueueEventId(e.target.value)}><option value="">Sem evento vinculado</option>{events.map((ev) => <option key={ev.id} value={ev.id}>{ev.display_name}</option>)}</select></label>
        <label>Destinatário<input required minLength={3} maxLength={320} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="E-mail ou telefone do destinatário" /></label>
        {queueChannel?.channel_type === "email" && <label>Assunto<input maxLength={200} value={messageSubject} onChange={(e) => setMessageSubject(e.target.value)} /></label>}
        <label>Mensagem<textarea required rows={5} maxLength={10000} value={messageBody} onChange={(e) => setMessageBody(e.target.value)} /></label>
        <label>Agendar para (opcional)<input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label>
        <button className="primary-button" disabled={busy || !companyId || !queueChannelId}>Registrar na fila</button>
      </form>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Fila e histórico operacional</h2><p>Os itens mais recentes, com status e erros conhecidos.</p></div></div>
      <div className="communication-list">{queue.map((m) => <article className="communication-item" key={m.id}><div><strong>{m.recipient_address}</strong><p>{m.payload?.subject || (m.payload?.body ?? "").slice(0,100) || "Mensagem"} · {new Date(m.created_at).toLocaleString("pt-BR")}</p><small>{m.scheduled_at ? "Agendada para " + new Date(m.scheduled_at).toLocaleString("pt-BR") + " · " : ""}Tentativas: {m.attempts}{m.last_error ? " · " + m.last_error : ""}</small></div><span className={"status-pill " + m.status}>{statusLabels[m.status] ?? m.status}</span></article>)}{!queue.length && <div className="empty">A fila ainda está vazia.</div>}</div>
      <div className="panel-heading communication-history-heading"><div><h2>Histórico do provedor</h2><p>Este histórico será preenchido pelo adaptador real de envio e seus webhooks.</p></div></div>
      <div className="communication-list">{logs.map((l) => <article className="communication-item" key={l.id}><div><strong>{l.recipient_address}</strong><p>{statusLabels[l.status] ?? l.status} · {new Date(l.created_at).toLocaleString("pt-BR")}</p><small>{l.error_code ? l.error_code + " · " : ""}{l.error_message || l.provider_status || (l.delivered_at ? "Entregue em " + new Date(l.delivered_at).toLocaleString("pt-BR") : "Sem detalhe adicional")}</small></div></article>)}{!logs.length && <div className="empty">Nenhum retorno de provedor registrado até o momento.</div>}</div>
    </section>
    <p className="muted communication-disclaimer">Segurança: esta etapa não armazena tokens ou senhas de provedores. Os canais começam como pendentes e as mensagens permanecem na fila até que um serviço de envio real seja integrado e configurado.</p>
  </div>;
}
