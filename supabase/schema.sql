create extension if not exists vector;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id text not null,
  chunk_index integer not null,
  content text not null,
  embedding vector(768) not null,
  embedding_json jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_doc_id_idx
  on public.document_chunks (doc_id);

create index if not exists document_chunks_embedding_idx
  on public.document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_document_chunks(
  query_embedding vector(768),
  match_count int default 5,
  filter jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  doc_id text,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    dc.id,
    dc.doc_id,
    dc.chunk_index,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where
    case
      when filter ? 'doc_id' then dc.doc_id = filter->>'doc_id'
      else true
    end
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;
