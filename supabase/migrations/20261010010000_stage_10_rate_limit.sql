-- Stage 10 hardening: foreign-key indexes and atomic public submission rate limiting.
create index if not exists memory_photos_book_idx on public.memory_photos(book_id);
create index if not exists memory_photos_entry_idx on public.memory_photos(entry_id);

create table if not exists public.memory_submission_rate_limits (
  book_id uuid not null references public.memory_books(id) on delete cascade,
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (book_id, key_hash)
);

alter table public.memory_submission_rate_limits enable row level security;
revoke all on public.memory_submission_rate_limits from anon, authenticated;

create or replace function public.consume_memory_submission_rate_limit(
  p_book_id uuid,
  p_key_hash text,
  p_limit integer default 5,
  p_window_seconds integer default 3600
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid rate-limit parameters';
  end if;

  insert into public.memory_submission_rate_limits (book_id, key_hash, window_started_at, request_count)
  values (p_book_id, p_key_hash, now(), 1)
  on conflict (book_id, key_hash) do update
    set window_started_at = case
          when public.memory_submission_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
            then now()
          else public.memory_submission_rate_limits.window_started_at
        end,
        request_count = case
          when public.memory_submission_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
            then 1
          else public.memory_submission_rate_limits.request_count + 1
        end
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_memory_submission_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_memory_submission_rate_limit(uuid, text, integer, integer) to service_role;
