-- Run this in Supabase SQL Editor to create the table and bucket.

-- Table for label analyses (one image per row)
create table if not exists public.label_analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  full_text text,
  text_blocks jsonb default '[]',
  extraction_prompt text,
  image_url text
);

alter table public.label_analyses enable row level security;

create policy "Service role full access"
  on public.label_analyses for all
  using (true)
  with check (true);

-- Create storage bucket (e.g. "label-images") in Dashboard, public if you want public URLs.
