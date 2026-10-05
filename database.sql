create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  category text not null check (char_length(trim(category)) between 1 and 60),
  status text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  created_at timestamptz not null default now()
);

alter table public.requests enable row level security;

drop policy if exists "Public can read requests" on public.requests;
create policy "Public can read requests"
  on public.requests for select to anon using (true);

drop policy if exists "Public can create requests" on public.requests;
create policy "Public can create requests"
  on public.requests for insert to anon with check (true);

drop policy if exists "Public can update requests" on public.requests;
create policy "Public can update requests"
  on public.requests for update to anon using (true) with check (true);

drop policy if exists "Public can delete requests" on public.requests;
create policy "Public can delete requests"
  on public.requests for delete to anon using (true);

grant select, insert, update, delete on public.requests to anon;

insert into public.requests (title, category, status)
values
  ('Подготовить список оборудования', 'Документы', 'new'),
  ('Проверить доступ к кабинету', 'Техническая поддержка', 'in_progress'),
  ('Собрать материалы для отчёта', 'Учёба', 'done');