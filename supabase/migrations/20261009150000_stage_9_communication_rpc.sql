-- Stage 9: communication channel, template and queue RPCs.
-- Provider credentials are intentionally not stored in these tables.
create or replace function public.can_manage_communications(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.memberships m
      where m.company_id = p_company_id and m.user_id = auth.uid() and m.active = true
        and m.role in ('company_admin'::public.app_role, 'event_manager'::public.app_role, 'developer'::public.app_role)
    )
    or exists (
      select 1 from public.platform_roles pr
      where pr.user_id = auth.uid() and pr.active = true and pr.role = 'developer'::public.app_role
    )
  );
$$;
revoke all on function public.can_manage_communications(uuid) from public, anon;
grant execute on function public.can_manage_communications(uuid) to authenticated;

create or replace function public.save_communication_channel(
  p_company_id uuid, p_channel_type text, p_display_name text, p_address text,
  p_provider text default null, p_provider_account_ref text default null, p_make_primary boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.can_manage_communications(p_company_id) then raise exception 'Acesso negado para configurar a comunicação desta empresa.' using errcode = '42501'; end if;
  if p_channel_type not in ('whatsapp','sms','email') then raise exception 'Canal inválido.' using errcode = '22023'; end if;
  if length(trim(coalesce(p_display_name,''))) < 2 or length(trim(coalesce(p_address,''))) < 3 then raise exception 'Informe o nome e o endereço do canal.' using errcode = '22023'; end if;
  if length(coalesce(p_display_name,'')) > 100 or length(coalesce(p_address,'')) > 320 or length(coalesce(p_provider,'')) > 80 or length(coalesce(p_provider_account_ref,'')) > 200 then raise exception 'Um dos campos excede o tamanho permitido.' using errcode = '22023'; end if;
  if p_make_primary then
    update public.communication_channels set is_primary = false, updated_at = now()
      where company_id = p_company_id and channel_type = p_channel_type and is_primary = true;
  end if;
  insert into public.communication_channels(company_id,channel_type,display_name,address,status,is_primary,provider,provider_account_ref,metadata)
  values(p_company_id,p_channel_type::public.communication_channel_type,trim(p_display_name),trim(p_address),
    'pending'::public.communication_channel_status,coalesce(p_make_primary,false),
    nullif(trim(coalesce(p_provider,'')),''),nullif(trim(coalesce(p_provider_account_ref,'')),''),'{}'::jsonb)
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.save_message_template(
  p_company_id uuid, p_channel_type text, p_name text, p_subject text, p_body text, p_template_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.can_manage_communications(p_company_id) then raise exception 'Acesso negado para configurar modelos desta empresa.' using errcode = '42501'; end if;
  if p_channel_type not in ('whatsapp','sms','email') then raise exception 'Canal inválido.' using errcode = '22023'; end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(coalesce(p_body,''))) < 1 then raise exception 'Informe o nome e o conteúdo do modelo.' using errcode = '22023'; end if;
  if length(p_name) > 120 or length(p_body) > 10000 or length(coalesce(p_subject,'')) > 200 then raise exception 'Um dos campos excede o tamanho permitido.' using errcode = '22023'; end if;
  if p_channel_type = 'email' and length(trim(coalesce(p_subject,''))) = 0 then raise exception 'O assunto é obrigatório para modelos de e-mail.' using errcode = '22023'; end if;
  if p_template_id is not null then
    update public.message_templates set name=trim(p_name),channel_type=p_channel_type::public.communication_channel_type,
      subject=nullif(trim(coalesce(p_subject,'')),''),body=p_body,version=version+1,active=true,updated_at=now()
      where id=p_template_id and company_id=p_company_id returning id into v_id;
    if v_id is null then raise exception 'Modelo não encontrado nesta empresa.' using errcode = 'P0002'; end if;
  else
    insert into public.message_templates(company_id,channel_type,name,subject,body,variables,active,version,created_by)
    values(p_company_id,p_channel_type::public.communication_channel_type,trim(p_name),nullif(trim(coalesce(p_subject,'')),''),p_body,'[]'::jsonb,true,1,auth.uid())
    returning id into v_id;
  end if;
  return v_id;
end; $$;

create or replace function public.enqueue_communication(
  p_company_id uuid, p_channel_id uuid, p_recipient_address text, p_body text,
  p_subject text default null, p_template_id uuid default null, p_event_id uuid default null, p_scheduled_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_channel public.communication_channels%rowtype; v_template public.message_templates%rowtype; v_id uuid; v_payload jsonb;
begin
  if not public.can_manage_communications(p_company_id) then raise exception 'Acesso negado para enfileirar mensagens desta empresa.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_recipient_address,''))) < 3 or length(trim(coalesce(p_recipient_address,''))) > 320 then raise exception 'Destinatário inválido.' using errcode = '22023'; end if;
  if length(trim(coalesce(p_body,''))) < 1 or length(coalesce(p_body,'')) > 10000 then raise exception 'A mensagem está vazia ou excede o tamanho permitido.' using errcode = '22023'; end if;
  if p_scheduled_at is not null and p_scheduled_at < now() - interval '1 minute' then raise exception 'A data agendada não pode estar no passado.' using errcode = '22023'; end if;
  select * into v_channel from public.communication_channels where id=p_channel_id and company_id=p_company_id;
  if not found then raise exception 'Canal não encontrado nesta empresa.' using errcode = 'P0002'; end if;
  if p_event_id is not null and not exists(select 1 from public.events e where e.id=p_event_id and e.company_id=p_company_id) then raise exception 'Evento não pertence a esta empresa.' using errcode = '22023'; end if;
  if p_template_id is not null then
    select * into v_template from public.message_templates where id=p_template_id and company_id=p_company_id and active=true;
    if not found then raise exception 'Modelo não encontrado nesta empresa.' using errcode = 'P0002'; end if;
    if v_template.channel_type <> v_channel.channel_type then raise exception 'O modelo e o canal precisam ser do mesmo tipo.' using errcode = '22023'; end if;
  end if;
  v_payload := jsonb_build_object('subject',nullif(trim(coalesce(p_subject,'')),''),'body',p_body,'provider_configured',false,'dispatch_state','not_configured');
  insert into public.message_queue(company_id,event_id,channel_id,template_id,recipient_address,payload,status,scheduled_at,attempts)
  values(p_company_id,p_event_id,p_channel_id,p_template_id,trim(p_recipient_address),v_payload,'queued'::public.message_status,p_scheduled_at,0)
  returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.save_communication_channel(uuid,text,text,text,text,text,boolean) from public, anon;
revoke all on function public.save_message_template(uuid,text,text,text,text,uuid) from public, anon;
revoke all on function public.enqueue_communication(uuid,uuid,text,text,text,uuid,uuid,timestamptz) from public, anon;
grant execute on function public.save_communication_channel(uuid,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.save_message_template(uuid,text,text,text,text,uuid) to authenticated;
grant execute on function public.enqueue_communication(uuid,uuid,text,text,text,uuid,uuid,timestamptz) to authenticated;
create index if not exists message_queue_company_created_idx on public.message_queue(company_id,created_at desc);
create index if not exists message_logs_company_created_idx on public.message_logs(company_id,created_at desc);
