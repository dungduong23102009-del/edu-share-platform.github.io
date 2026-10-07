-- CLI migration new was blocked by its home-directory telemetry write.
-- Applied with MCP; filename matches the verified remote migration version.
alter table public.documents
  add column analysis_run_id uuid,
  add column analysis_started_at timestamptz,
  add column analysis_expires_at timestamptz,
  add column analysis_stage text check (analysis_stage in ('reading','extracting','saving','ready','failed')),
  add column analysis_error text;

create table public.document_analyses (
  document_id uuid primary key references public.documents(id) on delete cascade,
  current_run_id uuid not null,
  document_title text,
  document_type text not null check (document_type in ('question_answer','theory','mixed')),
  language text not null,
  summary text not null,
  model text not null,
  warnings jsonb not null check (jsonb_typeof(warnings)='array'),
  raw_analysis jsonb not null check (jsonb_typeof(raw_analysis)='object' and pg_column_size(raw_analysis)<=2097152),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.document_analyses enable row level security;
revoke all on public.document_analyses from anon;
grant select,insert,update,delete on public.document_analyses to authenticated;
create policy document_analyses_owner on public.document_analyses for all to authenticated
using (exists(select 1 from public.documents d where d.id=document_id and d.user_id=(select auth.uid())))
with check (exists(select 1 from public.documents d where d.id=document_id and d.user_id=(select auth.uid())));
create trigger document_analyses_touch before update on public.document_analyses
for each row execute function study_private.touch_updated_at();

alter table public.topics add column summary text, add column source_pages jsonb not null default '[]'::jsonb,
  add column analysis_run_id uuid;
create unique index topics_analysis_title_idx on public.topics(document_id,analysis_run_id,title);
alter table public.questions alter column correct_answer drop not null;
alter table public.questions drop constraint questions_choices_check;
alter table public.questions add constraint questions_choices_check
  check (jsonb_typeof(choices)='array' and (jsonb_array_length(choices)=0 or jsonb_array_length(choices) between 2 and 6));
alter table public.questions drop constraint questions_answer_origin_check;
alter table public.questions add constraint questions_answer_origin_check
  check (answer_origin in ('document','inferred','generated','source','not_provided'));
alter table public.questions add column extraction_confidence numeric check (extraction_confidence between 0 and 1),
  add column answer_source_excerpt text, add column analysis_run_id uuid;
alter table public.questions add constraint questions_extracted_answer_check
  check (analysis_run_id is null or (answer_origin='source' and correct_answer is not null)
    or (answer_origin='not_provided' and correct_answer is null));
create index questions_analysis_run_idx on public.questions(document_id,analysis_run_id);

-- All RPCs are SECURITY INVOKER: caller's auth.uid and existing RLS remain effective.
create function public.claim_document_analysis(p_document_id uuid,p_reprocess boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.documents; run_id uuid;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
  select * into d from public.documents where id=p_document_id and user_id=auth.uid() for update;
  if not found then return jsonb_build_object('action','not_found'); end if;
  if d.status='ready' and not p_reprocess and exists(select 1 from public.document_analyses where document_id=d.id)
    then return jsonb_build_object('action','ready'); end if;
  if d.status='processing' and (d.analysis_run_id is null or d.analysis_expires_at>now())
    then return jsonb_build_object('action','busy'); end if;
  if (select count(*) from public.documents where user_id=auth.uid() and status='processing'
      and analysis_run_id is not null and analysis_expires_at>now())>=3
    then return jsonb_build_object('action','limit'); end if;
  run_id:=gen_random_uuid();
  update public.documents set status='processing',analysis_run_id=run_id,
    analysis_started_at=now(),analysis_expires_at=now()+interval '4 minutes',
    analysis_stage='reading',analysis_error=null where id=d.id;
  return jsonb_build_object('action','started','runId',run_id);
end;
$$;

create function public.expire_document_analysis(p_document_id uuid)
returns void language sql security invoker set search_path='' as $$
  update public.documents set status='failed',analysis_stage='failed',analysis_error='timeout'
  where id=p_document_id and user_id=auth.uid() and status='processing'
    and analysis_run_id is not null and analysis_expires_at<=now();
$$;

create function public.complete_document_analysis(p_document_id uuid,p_run_id uuid,p_model text,p_analysis jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare d public.documents; item jsonb; topic_id_value uuid; position_value integer:=0;
begin
  select * into d from public.documents where id=p_document_id and user_id=auth.uid() for update;
  if not found or p_run_id is null or d.status<>'processing' or d.analysis_run_id is distinct from p_run_id
    or d.analysis_expires_at is null or d.analysis_expires_at<=now()
    then return false; end if;
  insert into public.document_analyses(document_id,current_run_id,document_title,document_type,language,summary,model,warnings,raw_analysis)
  values(d.id,p_run_id,p_analysis->>'documentTitle',p_analysis->>'documentType',p_analysis->>'language',
    p_analysis->>'summary',p_model,p_analysis->'warnings',p_analysis)
  on conflict(document_id) do update set current_run_id=excluded.current_run_id,
    document_title=excluded.document_title,document_type=excluded.document_type,language=excluded.language,
    summary=excluded.summary,model=excluded.model,warnings=excluded.warnings,raw_analysis=excluded.raw_analysis;
  for item in select value from jsonb_array_elements(p_analysis->'topics') loop
    insert into public.topics(document_id,title,summary,source_pages,sort_order,analysis_run_id)
    values(d.id,item->>'title',item->>'summary',item->'sourcePages',position_value,p_run_id);
    position_value:=position_value+1;
  end loop;
  for item in select value from jsonb_array_elements(p_analysis->'sourceQuestions') loop
    select id into topic_id_value from public.topics where document_id=d.id
      and analysis_run_id=p_run_id and title=item->>'topicTitle';
    insert into public.questions(document_id,topic_id,question_text,choices,correct_answer,answer_origin,
      source_page,source_excerpt,extraction_confidence,answer_source_excerpt,analysis_run_id)
    values(d.id,topic_id_value,item->>'questionText',item->'choices',item->>'explicitAnswer',
      item->>'answerOrigin',(item->>'sourcePage')::integer,item->>'sourceExcerpt',
      (item->>'confidence')::numeric,item->>'answerSourceExcerpt',p_run_id);
  end loop;
  -- Old run topics/questions remain intact, including records referenced by quiz_answers.
  -- Current queries filter by current_run_id. A refresh never appends another generation.
  update public.documents set status='ready',analysis_stage='ready',analysis_error=null,
    analysis_expires_at=null where id=d.id;
  return true;
end;
$$;
revoke all on function public.claim_document_analysis(uuid,boolean),
  public.expire_document_analysis(uuid),public.complete_document_analysis(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.claim_document_analysis(uuid,boolean),
  public.expire_document_analysis(uuid),public.complete_document_analysis(uuid,uuid,text,jsonb) to authenticated;
