-- Supabase Auth owns identities; application tables never store passwords or OAuth tokens.
create schema if not exists study_private;
revoke all on schema study_private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Người học' check (char_length(display_name) between 1 and 160),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'uploaded' check (status in ('uploaded','processing','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (storage_path ~ ('^' || user_id::text || '/' || id::text || '/[a-zA-Z0-9._-]+$'))
);
create index documents_user_created_idx on public.documents (user_id, created_at desc);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (id, document_id)
);
create index topics_document_order_idx on public.topics (document_id,sort_order);
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null,
  title text not null,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object'),
  created_at timestamptz not null default now(),
  unique (id,user_id),
  foreign key (document_id,user_id) references public.documents(id,user_id) on delete cascade
);
create index quizzes_user_created_idx on public.quizzes(user_id,created_at desc);
create index quizzes_document_owner_idx on public.quizzes(document_id,user_id);
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  topic_id uuid,
  question_text text not null,
  choices jsonb not null check (jsonb_typeof(choices)='array' and jsonb_array_length(choices) between 2 and 6),
  correct_answer text not null,
  explanation text,
  difficulty text check (difficulty in ('easy','medium','hard')),
  answer_origin text check (answer_origin in ('document','inferred','generated')),
  source_page integer check (source_page > 0),
  source_excerpt text,
  validation_warning text,
  created_at timestamptz not null default now(),
  foreign key (topic_id,document_id) references public.topics(id,document_id) on delete cascade
);
create index questions_document_idx on public.questions(document_id);
create index questions_topic_document_idx on public.questions(topic_id,document_id);
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  score numeric check (score between 0 and 100),
  total_questions integer not null check (total_questions > 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  incorrect_count integer not null default 0 check (incorrect_count >= 0),
  unanswered_count integer not null default 0 check (unanswered_count >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (quiz_id,user_id) references public.quizzes(id,user_id) on delete cascade,
  check (correct_count+incorrect_count+unanswered_count <= total_questions),
  check (completed_at is null or completed_at >= started_at)
);
create index quiz_attempts_user_started_idx on public.quiz_attempts(user_id,started_at desc);
create index quiz_attempts_quiz_owner_idx on public.quiz_attempts(quiz_id,user_id);
create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_answer text,
  is_correct boolean,
  created_at timestamptz not null default now(),
  unique(attempt_id,question_id)
);
create index quiz_answers_question_idx on public.quiz_answers(question_id);

-- Internal trigger functions are not exposed by the Data API.
create function study_private.touch_updated_at() returns trigger
language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end;
$$;
revoke all on function study_private.touch_updated_at() from public,anon,authenticated;
create trigger profiles_touch before update on public.profiles for each row execute function study_private.touch_updated_at();
create trigger documents_touch before update on public.documents for each row execute function study_private.touch_updated_at();

-- SECURITY DEFINER is confined to this Auth trigger: auth.users cannot insert through
-- profiles RLS during signup. It is never callable by anonymous/authenticated clients.
create function study_private.sync_auth_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name,avatar_url)
  values (new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),nullif(new.raw_user_meta_data->>'name',''),nullif(split_part(new.email,'@',1),''),'Người học'),160),
    case when coalesce(new.raw_user_meta_data->>'avatar_url','') ~ '^https://[^/]+/' then new.raw_user_meta_data->>'avatar_url' else null end)
  on conflict(id) do update set display_name=excluded.display_name,avatar_url=excluded.avatar_url;
  return new;
end;
$$;
revoke all on function study_private.sync_auth_profile() from public,anon,authenticated;
create trigger study_quiz_auth_profile after insert or update of raw_user_meta_data on auth.users
for each row execute function study_private.sync_auth_profile();

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.topics enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;
revoke all on public.profiles,public.documents,public.topics,public.quizzes,public.questions,public.quiz_attempts,public.quiz_answers from anon;
grant select,insert,update,delete on public.profiles,public.documents,public.topics,public.quizzes,public.questions,public.quiz_attempts,public.quiz_answers to authenticated;
create policy profiles_owner on public.profiles for all to authenticated
using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy documents_owner on public.documents for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy quizzes_owner on public.quizzes for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy quiz_attempts_owner on public.quiz_attempts for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy topics_owner on public.topics for all to authenticated
using(exists(select 1 from public.documents d where d.id=topics.document_id and d.user_id=(select auth.uid())))
with check(exists(select 1 from public.documents d where d.id=topics.document_id and d.user_id=(select auth.uid())));
create policy questions_owner on public.questions for all to authenticated
using(exists(select 1 from public.documents d where d.id=questions.document_id and d.user_id=(select auth.uid())))
with check(exists(select 1 from public.documents d where d.id=questions.document_id and d.user_id=(select auth.uid())));
create policy quiz_answers_owner on public.quiz_answers for all to authenticated
using(exists(select 1 from public.quiz_attempts a join public.quizzes q on q.id=a.quiz_id join public.questions x on x.document_id=q.document_id where a.id=quiz_answers.attempt_id and x.id=quiz_answers.question_id and a.user_id=(select auth.uid())))
with check(exists(select 1 from public.quiz_attempts a join public.quizzes q on q.id=a.quiz_id join public.questions x on x.document_id=q.document_id where a.id=quiz_answers.attempt_id and x.id=quiz_answers.question_id and a.user_id=(select auth.uid())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('study-documents','study-documents',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create policy study_documents_storage_owner on storage.objects for all to authenticated
using(bucket_id='study-documents' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.documents d where d.storage_path=name and d.user_id=(select auth.uid())))
with check(bucket_id='study-documents' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.documents d where d.storage_path=name and d.user_id=(select auth.uid())));
