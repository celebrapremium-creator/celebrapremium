-- Item 10: Livro de Recordações e Fotos dos Convidados
-- Standalone event book records; event_id links logically to the platform event.
create extension if not exists pgcrypto;

create table if not exists public.memory_books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null,
  event_id uuid,
  company_id uuid,
  active boolean not null default false,
  max_message_chars integer not null default 500 check (max_message_chars between 50 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.memory_guests (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.memory_books(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 100),
  phone text not null,
  phone_normalized text not null,
  created_at timestamptz not null default now(),
  unique (book_id, phone_normalized)
);

create table if not exists public.memory_entries (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.memory_books(id) on delete cascade,
  guest_id uuid not null unique references public.memory_guests(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 1 and 2000),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.memory_photos (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.memory_books(id) on delete cascade,
  guest_id uuid not null references public.memory_guests(id) on delete cascade,
  entry_id uuid not null references public.memory_entries(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);

create index if not exists memory_entries_book_created_idx on public.memory_entries(book_id, created_at desc);
create index if not exists memory_photos_guest_idx on public.memory_photos(guest_id, created_at);

alter table public.memory_books enable row level security;
alter table public.memory_guests enable row level security;
alter table public.memory_entries enable row level security;
alter table public.memory_photos enable row level security;

drop policy if exists "Public can view active memory books" on public.memory_books;
create policy "Public can view active memory books" on public.memory_books
for select to anon, authenticated using (active = true);

-- Guest writes go through server-side validation. No direct anonymous table writes.
revoke all on public.memory_guests from anon, authenticated;
revoke all on public.memory_entries from anon, authenticated;
revoke all on public.memory_photos from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memory-photos', 'memory-photos', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Admin access should be granted through authenticated server-side authorization policies
-- appropriate to the existing company membership schema.
