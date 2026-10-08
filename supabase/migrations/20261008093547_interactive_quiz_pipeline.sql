-- Immutable question/answer snapshots are private; existing quiz/attempt/answer tables remain authoritative.
create table study_private.quiz_questions (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null,
  position integer not null check(position >= 0),
  prompt text not null,
  choices jsonb not null check(jsonb_array_length(choices)=4),
  correct_choice text not null check(correct_choice in ('A','B','C','D')),
  explanation text not null,
  origin text not null check(origin in ('source','ai_derived')),
  source_page integer,
  topic_title text,
  primary key(quiz_id,question_id),
  unique(quiz_id,position)
);
alter table study_private.quiz_questions enable row level security;
revoke all on study_private.quiz_questions from public,anon,authenticated;
alter table public.quiz_answers add column quiz_id uuid;
update public.quiz_answers x set quiz_id=a.quiz_id from public.quiz_attempts a where a.id=x.attempt_id;
alter table public.quiz_answers alter column quiz_id set not null;
-- Keep past quiz snapshots intact when source questions are re-extracted.
alter table public.quiz_answers drop constraint quiz_answers_question_id_fkey;
alter table public.quiz_answers add constraint quiz_answers_snapshot_fkey foreign key(quiz_id,question_id) references study_private.quiz_questions(quiz_id,question_id) on delete cascade;
create index quiz_answers_quiz_question_idx on public.quiz_answers(quiz_id,question_id);
revoke insert,update,delete on public.quizzes,public.quiz_attempts,public.quiz_answers from authenticated;

-- Only this small, owner-checked API can read private keys or write scoring fields.
create function study_private.quiz_command(p_action text,p_id uuid,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid(); q public.quizzes; a public.quiz_attempts;
  doc public.documents; s record; item record; ids uuid[]; qid uuid; aid uuid;
  n integer; pos integer:=0; answers jsonb; result jsonb; qs jsonb;
begin
  if uid is null then raise exception 'UNAUTHORIZED' using errcode='42501'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
  if p_action='history' then
    select coalesce(jsonb_agg(x order by x->>'startedAt' desc),'[]') into result from (
      select jsonb_build_object('attemptId',a.id,'quizId',q.id,'title',q.title,'documentName',q.settings->>'documentName','total',a.total_questions,'correct',a.correct_count,'incorrect',a.incorrect_count,'unanswered',a.unanswered_count,'percent',a.score,'startedAt',a.started_at,'completedAt',a.completed_at) x
      from public.quiz_attempts a join public.quizzes q on q.id=a.quiz_id
      where a.user_id=uid and q.user_id=uid order by a.started_at desc limit 100
    ) t;
    return result;
  elsif p_action='create' then
    select * into doc from public.documents where id=(p_payload->>'documentId')::uuid and user_id=uid and status='ready' for share;
    if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
    perform pg_advisory_xact_lock(hashtextextended(uid::text||p_id::text,0));
    select * into q from public.quizzes where id=p_id;
    if found then
      if q.user_id<>uid or q.document_id<>doc.id then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
      select id into aid from public.quiz_attempts where quiz_id=q.id and user_id=uid order by started_at limit 1;
      return jsonb_build_object('quizId',q.id,'attemptId',aid);
    end if;
    if jsonb_typeof(p_payload->'questionIds')<>'array' or jsonb_array_length(p_payload->'questionIds') not between 1 and 500 then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
    select array_agg(value::uuid) into ids from jsonb_array_elements_text(p_payload->'questionIds');
    if (select count(distinct x) from unnest(ids) x)<>cardinality(ids) then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
    select count(*) into n from public.question_solutions z join public.questions x on x.id=z.question_id join public.document_analyses d on d.document_id=z.document_id
      where z.question_id=any(ids) and z.document_id=doc.id and x.document_id=doc.id and z.analysis_run_id=d.current_run_id and z.quiz_ready
      and jsonb_array_length(z.choices)=4 and z.correct_choice in ('A','B','C','D') and jsonb_array_length(z.parsing_warnings)=0
      and z.original_type in ('multiple_choice','calculation','short_answer')
      and ((z.answer_origin='source' and x.answer_origin='source' and z.correct_answer=x.correct_answer and x.extraction_confidence>=0.65)
        or (z.answer_origin='ai_derived' and x.correct_answer is null and z.solver_status='solved' and z.ai_confidence>=0.85 and length(trim(z.explanation))>0));
    if n<>cardinality(ids) then raise exception 'QUESTIONS_NOT_READY' using errcode='22023'; end if;
    insert into public.quizzes(id,user_id,document_id,title,settings) values(p_id,uid,doc.id,
      coalesce((select raw_analysis->>'documentTitle' from public.document_analyses where document_id=doc.id),doc.original_filename),
      jsonb_build_object('documentName',doc.original_filename,'topicIds',coalesce(p_payload->'topicIds','[]'),'retry',false));
    foreach qid in array ids loop
      insert into study_private.quiz_questions(quiz_id,question_id,position,prompt,choices,correct_choice,explanation,origin,source_page,topic_title)
      select p_id,z.question_id,pos,z.question_text,z.choices,z.correct_choice,
        coalesce(nullif(z.explanation,''),'Đáp án được ghi trong tài liệu nguồn.'),z.answer_origin,x.source_page,t.title
      from public.question_solutions z join public.questions x on x.id=z.question_id left join public.topics t on t.id=x.topic_id where z.question_id=qid;
      pos:=pos+1;
    end loop;
    insert into public.quiz_attempts(quiz_id,user_id,total_questions) values(p_id,uid,n) returning id into aid;
    return jsonb_build_object('quizId',p_id,'attemptId',aid);
  end if;

  select * into a from public.quiz_attempts where id=p_id and user_id=uid for update;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  select * into q from public.quizzes where id=a.quiz_id and user_id=uid;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002'; end if;
  if p_action in ('progress','submit') and a.completed_at is null then
    answers:=p_payload->'answers';
    if jsonb_typeof(answers)<>'object' or octet_length(answers::text)>65536 then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
    for item in select * from jsonb_each(answers) loop
      if jsonb_typeof(item.value)<>'string' or item.value#>>'{}' not in ('A','B','C','D') or not exists(select 1 from study_private.quiz_questions where quiz_id=q.id and question_id::text=item.key) then raise exception 'INVALID_ANSWER' using errcode='22023'; end if;
    end loop;
    -- Full answer state is written atomically. Browser sends saves through a serial queue.
    insert into public.quiz_answers(attempt_id,quiz_id,question_id,selected_answer,is_correct)
      select a.id,q.id,x.question_id,answers->>x.question_id::text,null from study_private.quiz_questions x where x.quiz_id=q.id
      on conflict(attempt_id,question_id) do update set selected_answer=excluded.selected_answer,is_correct=null;
    if p_action='submit' then
      update public.quiz_answers x set is_correct=case when x.selected_answer is null then null else x.selected_answer=z.correct_choice end
        from study_private.quiz_questions z where x.attempt_id=a.id and z.quiz_id=q.id and z.question_id=x.question_id;
      select count(*) filter(where is_correct is true), count(*) filter(where is_correct is false),count(*) filter(where selected_answer is null)
        into a.correct_count,a.incorrect_count,a.unanswered_count from public.quiz_answers where attempt_id=a.id;
      update public.quiz_attempts set correct_count=a.correct_count,incorrect_count=a.incorrect_count,unanswered_count=a.unanswered_count,
        score=round(100.0*a.correct_count/a.total_questions,2),completed_at=clock_timestamp() where id=a.id returning * into a;
    end if;
  end if;
  if p_action='progress' then
    if a.completed_at is not null then raise exception 'ALREADY_SUBMITTED' using errcode='22023'; end if;
    return jsonb_build_object('saved',true);
  elsif p_action='submit' then
    return jsonb_build_object('attemptId',a.id,'quizId',q.id,'percent',a.score);
  elsif p_action='retry' then
    if a.completed_at is null then raise exception 'NOT_SUBMITTED' using errcode='22023'; end if;
    qid:=(p_payload->>'quizId')::uuid;
    if qid is null or p_payload->>'mode' not in ('wrong','all') then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended(uid::text||qid::text,0));
    select id into aid from public.quizzes where id=qid and user_id=uid and settings->>'parentAttemptId'=a.id::text;
    if found then
      select id into aid from public.quiz_attempts where quiz_id=qid and user_id=uid order by started_at limit 1;
      return jsonb_build_object('quizId',qid,'attemptId',aid);
    end if;
    select count(*) into n from study_private.quiz_questions x left join public.quiz_answers y on y.attempt_id=a.id and y.question_id=x.question_id
      where x.quiz_id=q.id and (p_payload->>'mode'='all' or y.is_correct is distinct from true);
    if n=0 then raise exception 'NO_QUESTIONS' using errcode='22023'; end if;
    insert into public.quizzes(id,user_id,document_id,title,settings) values(qid,uid,q.document_id,q.title,q.settings||jsonb_build_object('retry',true,'retryMode',p_payload->>'mode','parentAttemptId',a.id));
    insert into study_private.quiz_questions
      select qid,x.question_id,(row_number() over(order by x.position)-1)::int,x.prompt,x.choices,x.correct_choice,x.explanation,x.origin,x.source_page,x.topic_title
      from study_private.quiz_questions x left join public.quiz_answers y on y.attempt_id=a.id and y.question_id=x.question_id
      where x.quiz_id=q.id and (p_payload->>'mode'='all' or y.is_correct is distinct from true);
    insert into public.quiz_attempts(quiz_id,user_id,total_questions) values(qid,uid,n) returning id into aid;
    return jsonb_build_object('quizId',qid,'attemptId',aid);
  elsif p_action not in ('load','result') then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
  if p_action='result' and a.completed_at is null then raise exception 'NOT_SUBMITTED' using errcode='22023'; end if;
  select coalesce(jsonb_object_agg(question_id::text,selected_answer) filter(where selected_answer is not null),'{}') into answers from public.quiz_answers where attempt_id=a.id;
  select jsonb_agg(jsonb_build_object('id',x.question_id,'prompt',x.prompt,'choices',
    (select jsonb_agg(jsonb_build_object('id',chr(64+c.ordinality::int),'text',c.value) order by c.ordinality) from jsonb_array_elements_text(x.choices) with ordinality c(value,ordinality)))
    ||case when p_action='result' then jsonb_build_object('correctId',x.correct_choice,'explanation',x.explanation,'origin',x.origin,'page',x.source_page,'topicTitle',x.topic_title) else '{}'::jsonb end order by x.position) into qs
    from study_private.quiz_questions x where x.quiz_id=q.id;
  return jsonb_build_object('quizId',q.id,'attemptId',a.id,'title',q.title,'documentName',q.settings->>'documentName','retry',q.settings->'retry',
    'questions',qs,'answers',answers,'startedAt',a.started_at,'completedAt',a.completed_at,'total',a.total_questions,
    'correct',a.correct_count,'incorrect',a.incorrect_count,'unanswered',a.unanswered_count,'percent',a.score);
end;
$$;
revoke all on function study_private.quiz_command(text,uuid,jsonb) from public,anon,authenticated;
grant usage on schema study_private to authenticated;
grant execute on function study_private.quiz_command(text,uuid,jsonb) to authenticated;
create function public.quiz_command(p_action text,p_id uuid,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select study_private.quiz_command(p_action,p_id,p_payload); $$;
revoke all on function public.quiz_command(text,uuid,jsonb) from public,anon;
grant execute on function public.quiz_command(text,uuid,jsonb) to authenticated;
