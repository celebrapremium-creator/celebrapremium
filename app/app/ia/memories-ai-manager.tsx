"use client";

import { useMemo, useState } from "react";

type Company = { id: string; name: string };
type EventItem = { id: string; companyId: string; name: string; date: string | null };
type Policy = { companyId: string; enabled: boolean; monthlyRequestLimit: number; monthlyBudgetUsd: number; maxInputChars: number };
type EventSetting = { eventId: string; enabled: boolean };
type Job = { id: string; companyId: string; eventId: string; status: string; output: Record<string, unknown> | null; model: string | null; inputTokens: number; outputTokens: number; cost: number; reviewNote: string | null; createdAt: string };

export default function MemoriesAIManager({ companies, events, policies, settings, jobs: initialJobs }: {
  companies: Company[]; events: EventItem[]; policies: Policy[]; settings: EventSetting[]; jobs: Job[];
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id || "");
  const [eventId, setEventId] = useState("");
  const [enabled, setEnabled] = useState(policies.find((p) => p.companyId === companies[0]?.id)?.enabled || false);
  const [monthlyRequestLimit, setMonthlyRequestLimit] = useState(policies.find((p) => p.companyId === companies[0]?.id)?.monthlyRequestLimit ?? 20);
  const [monthlyBudgetUsd, setMonthlyBudgetUsd] = useState(policies.find((p) => p.companyId === companies[0]?.id)?.monthlyBudgetUsd ?? 5);
  const [maxInputChars, setMaxInputChars] = useState(policies.find((p) => p.companyId === companies[0]?.id)?.maxInputChars ?? 30000);
  const [eventEnabled, setEventEnabled] = useState(false);
  const [dataAuthorized, setDataAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [jobs, setJobs] = useState(initialJobs);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});

  const companyEvents = useMemo(() => events.filter((e) => e.companyId === companyId), [events, companyId]);
  const visibleJobs = jobs.filter((j) => j.companyId === companyId);
  const selectedEvent = companyEvents.find((e) => e.id === eventId);
  const selectedPolicy = policies.find((p) => p.companyId === companyId);

  function selectCompany(nextId: string) {
    setCompanyId(nextId);
    setEventId("");
    const policy = policies.find((p) => p.companyId === nextId);
    setEnabled(policy?.enabled || false);
    setMonthlyRequestLimit(policy?.monthlyRequestLimit ?? 20);
    setMonthlyBudgetUsd(policy?.monthlyBudgetUsd ?? 5);
    setMaxInputChars(policy?.maxInputChars ?? 30000);
    setEventEnabled(false);
    setNotice("");
  }

  function selectEvent(nextId: string) {
    setEventId(nextId);
    setEventEnabled(settings.some((s) => s.eventId === nextId && s.enabled));
    setNotice("");
  }

  async function sendAction(payload: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/ai/memories", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
      setNotice(payload.action === "generate" ? "Proposta gerada e enviada para revisão humana. Ela ainda não foi publicada." : "Configuração salva.");
      if (payload.action === "generate") {
        window.location.reload();
      } else if (payload.action === "review") {
        setJobs((current) => current.map((j) => j.id === payload.jobId ? { ...j, status: String(payload.decision), reviewNote: String(payload.note || "") } : j));
      }
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Erro inesperado.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy() {
    await sendAction({ action: "configure-company", companyId, enabled, monthlyRequestLimit, monthlyBudgetUsd, maxInputChars });
  }

  async function saveEventSetting() {
    if (!eventId) return;
    const ok = await sendAction({ action: "configure-event", companyId, eventId, enabled: eventEnabled });
    if (ok) window.location.reload();
  }

  async function generate() {
    if (!companyId || !eventId || !dataAuthorized) return;
    await sendAction({ action: "generate", companyId, eventId, dataAuthorized });
  }

  return <section className="page-content"><div className="page-heading"><div><span className="eyebrow">CELEBRA MEMORIES AI</span><h1>IA editorial</h1><p>Organize mensagens aprovadas em uma proposta de capítulos, abertura e encerramento — sempre com revisão humana antes de publicar.</p></div></div>
    <div className="notice"><strong>Privacidade e segurança:</strong> a IA é opcional e vem desativada. Somente mensagens aprovadas entram na solicitação. O modelo não recebe telefones nem dados de contato. Confirme autorização adequada antes de enviar conteúdo a um provedor externo. A saída é um rascunho, não o álbum final.</div>
    {notice && <div className="notice" role="status">{notice}</div>}
    <section className="panel memory-ai-panel">
      <div className="panel-heading"><div><h2>Limites por empresa</h2><p>Controle de ativação, volume de solicitações e orçamento estimado.</p></div></div>
      <div className="stack-form">
        <label>Empresa<select value={companyId} onChange={(e) => selectCompany(e.target.value)}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="ai-check"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Ativar o recurso de IA nesta empresa</label>
        <div className="ai-limits-grid">
          <label>Solicitações por mês<input type="number" min={0} max={1000} value={monthlyRequestLimit} onChange={(e) => setMonthlyRequestLimit(Number(e.target.value))} /></label>
          <label>Orçamento mensal estimado (USD)<input type="number" min={0} max={10000} step="0.5" value={monthlyBudgetUsd} onChange={(e) => setMonthlyBudgetUsd(Number(e.target.value))} /></label>
          <label>Máximo de caracteres aprovados<input type="number" min={1000} max={30000} step={1000} value={maxInputChars} onChange={(e) => setMaxInputChars(Number(e.target.value))} /></label>
        </div>
        <button className="primary-button" disabled={busy || !companyId} onClick={savePolicy}>{busy ? "Salvando…" : "Salvar limites da empresa"}</button>
        {selectedPolicy && <small>Configuração atual cadastrada. A alteração só vale após salvar.</small>}
      </div>
    </section>
    <section className="panel memory-ai-panel">
      <div className="panel-heading"><div><h2>Configuração por evento</h2><p>A IA só pode gerar uma proposta quando a empresa e o evento estiverem ativados.</p></div></div>
      <div className="stack-form">
        <label>Evento<select value={eventId} onChange={(e) => selectEvent(e.target.value)}><option value="">Selecione um evento</option>{companyEvents.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        {selectedEvent && <p className="muted">{selectedEvent.date ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(selectedEvent.date + "T12:00:00")) : "Data não definida"}</p>}
        <label className="ai-check"><input type="checkbox" checked={eventEnabled} disabled={!eventId || !enabled} onChange={(e) => setEventEnabled(e.target.checked)} /> Ativar a organização editorial neste evento</label>
        <button className="secondary-button" disabled={busy || !eventId || (!enabled && eventEnabled)} onClick={saveEventSetting}>Salvar configuração do evento</button>
        <label className="ai-check ai-consent"><input type="checkbox" checked={dataAuthorized} onChange={(e) => setDataAuthorized(e.target.checked)} /> Confirmo que existe autorização adequada para processar as mensagens aprovadas por um provedor externo de IA.</label>
        <button className="primary-button" disabled={busy || !eventId || !enabled || !eventEnabled || !dataAuthorized} onClick={generate}>{busy ? "Processando…" : "Gerar proposta editorial para revisão"}</button>
        <small>A geração requer OPENAI_API_KEY e as taxas de custo configuradas como variáveis server-side na Vercel. Nenhuma credencial é exibida ou armazenada no navegador.</small>
      </div>
    </section>
    <section className="panel memory-ai-panel">
      <div className="panel-heading"><div><h2>Histórico e revisão humana</h2><p>Até 50 solicitações recentes da empresa selecionada. Aprovar aqui não publica automaticamente o álbum.</p></div></div>
      {visibleJobs.length ? <div className="ai-job-list">{visibleJobs.map((job) => {
        const output = job.output as { title?: string; opening?: string; chapters?: { title?: string; editorial_summary?: string; message_ids?: number[] }[]; closing?: string; editorial_notes?: string[] } | null;
        return <article className="ai-job" key={job.id}>
          <div className="ai-job-head"><div><strong>{output?.title || "Proposta editorial"}</strong><small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(job.createdAt))} · {companyEvents.find((e) => e.id === job.eventId)?.name || "Evento"} · {job.model || "Modelo não registrado"}</small></div><span className={"status-pill " + job.status}>{({queued:"Na fila",processing:"Processando",review:"Aguardando revisão",approved:"Aprovada por revisor",rejected:"Rejeitada",failed:"Falhou"} as Record<string,string>)[job.status] || job.status}</span></div>
          {output && <div className="ai-output">
            {output.opening && <section><h3>Abertura sugerida</h3><p>{output.opening}</p></section>}
            {(output.chapters || []).map((chapter, index) => <section key={index}><h3>{chapter.title || "Capítulo " + (index + 1)}</h3><p>{chapter.editorial_summary}</p><small>Referências às mensagens aprovadas: {(chapter.message_ids || []).join(", ") || "nenhuma"}</small></section>)}
            {output.closing && <section><h3>Encerramento sugerido</h3><p>{output.closing}</p></section>}
            {!!output.editorial_notes?.length && <section><h3>Notas editoriais</h3><ul>{output.editorial_notes.map((note, i) => <li key={i}>{note}</li>)}</ul></section>}
            <small>{job.inputTokens} tokens de entrada · {job.outputTokens} de saída · custo estimado US$ {job.cost.toFixed(4)}</small>
          </div>}
          {job.status === "review" && <div className="ai-review"><label>Nota de revisão (opcional)<textarea rows={2} maxLength={1000} value={reviewNote[job.id] || ""} onChange={(e) => setReviewNote((current) => ({ ...current, [job.id]: e.target.value }))} /></label><div className="page-actions"><button className="primary-button" disabled={busy} onClick={() => sendAction({ action: "review", jobId: job.id, decision: "approved", note: reviewNote[job.id] || "" })}>Aprovar proposta</button><button className="secondary-button" disabled={busy} onClick={() => sendAction({ action: "review", jobId: job.id, decision: "rejected", note: reviewNote[job.id] || "" })}>Rejeitar proposta</button></div></div>}
          {job.reviewNote && <p className="muted">Nota de revisão: {job.reviewNote}</p>}
        </article>;
      })}</div> : <div className="empty">Nenhuma solicitação de IA registrada para esta empresa.</div>}
    </section>
  </section>;
}
