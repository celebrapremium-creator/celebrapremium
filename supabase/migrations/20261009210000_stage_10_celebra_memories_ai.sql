-- Stage 10: optional, auditable Celebra Memories AI editorial assistance.
-- AI remains disabled by default. Provider secrets stay in server-side environment variables.
alter table public.event_album_settings
  add column if not exists ai_enabled boolean not null default false;

create table if not exists public.ai_company_policies (
  company_id uuid primary key references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  monthly_request_limit integer not null default 20 check (monthly_request_limit between 0 and 1000),
  monthly_budget_usd numeric(10,4) not null default 5 check (monthly_budget_usd >= 0 and monthly_budget_usd <= 10000),
  max_input_chars integer not null default 30000 check (max_input_chars between 1000 and 30000),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_editorial_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','processing','review','approved','rejected','failed')),
  input_snapshot jsonb not null default '[]'::jsonb,
  output_document jsonb,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(12,6) not null default 0 check (estimated_cost_usd >= 0),
  data_authorized_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_editorial_jobs_authorization check (data_authorized_at is not null)
);

create index if not exists ai_editorial_jobs_company_created_idx on public.ai_editorial_jobs(company_id, created_at desc);
create index if not exists ai_editorial_jobs_event_created_idx on public.ai_editorial_jobs(event_id, created_at desc);
create index if not exists ai_editorial_jobs_company_status_idx on public.ai_editorial_jobs(company_id, status, created_at desc);

alter table public.ai_company_policies enable row level security;
alter table public.ai_editorial_jobs enable row level security;
drop policy if exists ai_company_policies_manage on public.ai_company_policies;
create policy ai_company_policies_manage on public.ai_company_policies
  for all to authenticated
  using (public.can_manage_communications(company_id))
  with check (public.can_manage_communications(company_id));
drop policy if exists ai_editorial_jobs_read on public.ai_editorial_jobs;
create policy ai_editorial_jobs_read on public.ai_editorial_jobs
  for select to authenticated
  using (public.can_manage_communications(company_id));
-- Job writes are intentionally restricted to SECURITY DEFINER RPCs.

create or replace function public.configure_ai_company_policy(
  p_company_id uuid,
  p_enabled boolean,
  p_monthly_request_limit integer default 20,
  p_monthly_budget_usd numeric default 5,
  p_max_input_chars integer default 30000
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_communications(p_company_id) then
    raise exception 'Acesso negado para configurar a IA desta empresa.' using errcode = '42501';
  end if;
  if p_monthly_request_limit < 0 or p_monthly_request_limit > 1000
     or p_monthly_budget_usd < 0 or p_monthly_budget_usd > 10000
     or p_max_input_chars < 1000 or p_max_input_chars > 30000 then
    raise exception 'Limites de uso inválidos.' using errcode = '22023';
  end if;
  insert into public.ai_company_policies(company_id,enabled,monthly_request_limit,monthly_budget_usd,max_input_chars,created_by,updated_at)
  values(p_company_id,p_enabled,p_monthly_request_limit,p_monthly_budget_usd,p_max_input_chars,auth.uid(),now())
  on conflict(company_id) do update set enabled=excluded.enabled,
    monthly_request_limit=excluded.monthly_request_limit,monthly_budget_usd=excluded.monthly_budget_usd,
    max_input_chars=excluded.max_input_chars,updated_at=now();
end; $$;

create or replace function public.configure_ai_event(
  p_company_id uuid, p_event_id uuid, p_enabled boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_communications(p_company_id) then
    raise exception 'Acesso negado para configurar a IA deste evento.' using errcode = '42501';
  end if;
  if not exists(select 1 from public.events where id=p_event_id and company_id=p_company_id) then
    raise exception 'Evento não encontrado nesta empresa.' using errcode = 'P0002';
  end if;
  if p_enabled and not exists(select 1 from public.ai_company_policies where company_id=p_company_id and enabled=true) then
    raise exception 'Ative primeiro a política de IA da empresa.' using errcode = '22023';
  end if;
  insert into public.event_album_settings(event_id,ai_enabled,updated_by,updated_at)
  values(p_event_id,p_enabled,auth.uid(),now())
  on conflict(event_id) do update set ai_enabled=excluded.ai_enabled,updated_by=auth.uid(),updated_at=now();
end; $$;

create or replace function public.create_ai_editorial_job(
  p_company_id uuid, p_event_id uuid, p_data_authorized boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_policy public.ai_company_policies%rowtype;
  v_input jsonb;
  v_chars integer;
  v_requests integer;
  v_spend numeric;
  v_id uuid;
begin
  if not public.can_manage_communications(p_company_id) then
    raise exception 'Acesso negado para usar a IA desta empresa.' using errcode = '42501';
  end if;
  if p_data_authorized is distinct from true then
    raise exception 'Confirme a autorização adequada para processar as mensagens aprovadas com um provedor externo.' using errcode = '22023';
  end if;
  select * into v_policy from public.ai_company_policies where company_id=p_company_id and enabled=true for update;
  if not found then raise exception 'O recurso de IA está desativado para esta empresa.' using errcode = '22023'; end if;
  if not exists(select 1 from public.events where id=p_event_id and company_id=p_company_id) then
    raise exception 'Evento não encontrado nesta empresa.' using errcode = 'P0002';
  end if;
  if not exists(select 1 from public.event_album_settings where event_id=p_event_id and ai_enabled=true) then
    raise exception 'Ative a IA nas configurações deste evento antes de gerar uma proposta.' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('author',s.author_name,'message',s.message) order by s.submitted_at), '[]'::jsonb),
         coalesce(sum(length(s.author_name)+length(s.message)),0)::integer
    into v_input,v_chars
    from (select author_name,message,submitted_at from public.event_memories
          where event_id=p_event_id and status='approved'
          order by submitted_at asc limit 80) s;
  if jsonb_array_length(v_input)=0 then raise exception 'Este evento ainda não possui mensagens aprovadas para organizar.' using errcode = '22023'; end if;
  if v_chars > v_policy.max_input_chars then raise exception 'O volume de texto aprovado ultrapassa o limite configurado para a IA.' using errcode = '22023'; end if;

  select count(*)::integer, coalesce(sum(estimated_cost_usd),0)
    into v_requests,v_spend
    from public.ai_editorial_jobs
    where company_id=p_company_id and created_at >= date_trunc('month',now())
      and status <> 'failed';
  if v_requests >= v_policy.monthly_request_limit then raise exception 'Limite mensal de solicitações de IA atingido.' using errcode = '54000'; end if;
  if v_spend >= v_policy.monthly_budget_usd then raise exception 'Orçamento mensal estimado de IA atingido.' using errcode = '54000'; end if;

  insert into public.ai_editorial_jobs(company_id,event_id,requested_by,status,input_snapshot,data_authorized_at)
  values(p_company_id,p_event_id,auth.uid(),'queued',v_input,now()) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.finish_ai_editorial_job(
  p_job_id uuid, p_output jsonb, p_model text, p_input_tokens integer, p_output_tokens integer,
  p_estimated_cost_usd numeric
) returns void language plpgsql security definer set search_path = public as $$
declare v_job public.ai_editorial_jobs%rowtype;
begin
  select * into v_job from public.ai_editorial_jobs where id=p_job_id for update;
  if not found then raise exception 'Solicitação de IA não encontrada.' using errcode = 'P0002'; end if;
  if not public.can_manage_communications(v_job.company_id) then
    raise exception 'Acesso negado para concluir esta solicitação.' using errcode = '42501';
  end if;
  if v_job.status not in ('queued','processing') then raise exception 'Esta solicitação não pode mais ser concluída.' using errcode = '22023'; end if;
  if jsonb_typeof(p_output) <> 'object' or length(coalesce(p_model,'')) > 100
     or p_input_tokens < 0 or p_output_tokens < 0 or p_estimated_cost_usd < 0 then
    raise exception 'Resultado ou métricas de IA inválidos.' using errcode = '22023';
  end if;
  update public.ai_editorial_jobs set status='review',output_document=p_output,model=p_model,
    input_tokens=p_input_tokens,output_tokens=p_output_tokens,estimated_cost_usd=p_estimated_cost_usd,
    error_code=null,updated_at=now() where id=p_job_id;
end; $$;

create or replace function public.fail_ai_editorial_job(p_job_id uuid, p_error_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v_job public.ai_editorial_jobs%rowtype;
begin
  select * into v_job from public.ai_editorial_jobs where id=p_job_id for update;
  if not found then return; end if;
  if not public.can_manage_communications(v_job.company_id) then
    raise exception 'Acesso negado para atualizar esta solicitação.' using errcode = '42501';
  end if;
  if v_job.status in ('queued','processing') then
    update public.ai_editorial_jobs set status='failed',
      error_code=left(regexp_replace(coalesce(p_error_code,'provider_error'),'[^a-zA-Z0-9_.-]','','g'),80),
      updated_at=now() where id=p_job_id;
  end if;
end; $$;

create or replace function public.review_ai_editorial_job(p_job_id uuid,p_decision text,p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_job public.ai_editorial_jobs%rowtype;
begin
  select * into v_job from public.ai_editorial_jobs where id=p_job_id for update;
  if not found then raise exception 'Solicitação de IA não encontrada.' using errcode = 'P0002'; end if;
  if not public.can_manage_communications(v_job.company_id) then
    raise exception 'Acesso negado para revisar esta proposta.' using errcode = '42501';
  end if;
  if v_job.status <> 'review' or p_decision not in ('approved','rejected') then
    raise exception 'Apenas propostas pendentes de revisão podem ser aprovadas ou rejeitadas.' using errcode = '22023';
  end if;
  update public.ai_editorial_jobs set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),
    review_note=left(coalesce(p_note,''),1000),updated_at=now() where id=p_job_id;
end; $$;

revoke all on function public.configure_ai_company_policy(uuid,boolean,integer,numeric,integer) from public,anon;
revoke all on function public.configure_ai_event(uuid,uuid,boolean) from public,anon;
revoke all on function public.create_ai_editorial_job(uuid,uuid,boolean) from public,anon;
revoke all on function public.finish_ai_editorial_job(uuid,jsonb,text,integer,integer,numeric) from public,anon;
revoke all on function public.fail_ai_editorial_job(uuid,text) from public,anon;
revoke all on function public.review_ai_editorial_job(uuid,text,text) from public,anon;
grant execute on function public.configure_ai_company_policy(uuid,boolean,integer,numeric,integer) to authenticated;
grant execute on function public.configure_ai_event(uuid,uuid,boolean) to authenticated;
grant execute on function public.create_ai_editorial_job(uuid,uuid,boolean) to authenticated;
grant execute on function public.finish_ai_editorial_job(uuid,jsonb,text,integer,integer,numeric) to authenticated;
grant execute on function public.fail_ai_editorial_job(uuid,text) to authenticated;
grant execute on function public.review_ai_editorial_job(uuid,text,text) to authenticated;
