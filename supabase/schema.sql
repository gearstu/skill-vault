-- ============================================================
-- Skill Vault - Supabase schema
-- 在 Supabase 项目的 SQL Editor 中执行本文件
-- ============================================================

-- 1) skills 表
create extension if not exists "pgcrypto";

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  tags text[] not null default '{}',
  preview_images text[] not null default '{}',   -- storage 路径（相对 bucket 根）
  zip_path text not null,                        -- storage 路径（zip 包）
  file_tree jsonb not null default '[]',         -- 目录树 [{name,type,path,children}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skills_tags_idx on public.skills using gin (tags);
create index if not exists skills_name_idx on public.skills (lower(name));

-- 2) 行级安全：个人收藏库，直接全公开（部署后如需登录可收紧）
alter table public.skills enable row level security;

drop policy if exists "skills_public_read" on public.skills;
create policy "skills_public_read" on public.skills for select using (true);

drop policy if exists "skills_public_insert" on public.skills;
create policy "skills_public_insert" on public.skills for insert with check (true);

drop policy if exists "skills_public_update" on public.skills;
create policy "skills_public_update" on public.skills for update using (true);

drop policy if exists "skills_public_delete" on public.skills;
create policy "skills_public_delete" on public.skills for delete using (true);

-- 3) Storage bucket（公开读，方便 zip / 预览图直接 URL 下载）
insert into storage.buckets (id, name, public)
values ('skillvault', 'skillvault', true)
on conflict (id) do nothing;

-- Storage 的 RLS：个人用全公开
drop policy if exists "skillvault_public_read" on storage.objects;
create policy "skillvault_public_read" on storage.objects for select using (bucket_id = 'skillvault');

drop policy if exists "skillvault_public_insert" on storage.objects;
create policy "skillvault_public_insert" on storage.objects for insert with check (bucket_id = 'skillvault');

drop policy if exists "skillvault_public_delete" on storage.objects;
create policy "skillvault_public_delete" on storage.objects for delete using (bucket_id = 'skillvault');
