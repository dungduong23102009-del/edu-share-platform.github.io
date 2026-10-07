-- Additive migration: no existing table, function or data is changed.
-- CLI creation was blocked by a home-directory telemetry write; use connector.
create table public.question_solutions (
 question_id uuid primary key references public.questions(id) on delete cascade,
 document_id uuid not null references public.documents(id) on delete cascade,
 analysis_run_id uuid not null, question_text text not null, raw_question_text text not null,
 choices jsonb not null check(jsonb_typeof(choices)='array'), raw_choices jsonb not null check(jsonb_typeof(raw_choices)='array'),
 original_type text not null check(original_type in ('multiple_choice','true_false','short_answer','calculation','theory','unknown')),
 answer_origin text not null check(answer_origin in ('source','ai_derived','none')),
 correct_answer text, correct_choice text check(correct_choice in ('A','B','C','D')), explanation text,
 ai_provider text, ai_model text, ai_confidence numeric check(ai_confidence between 0 and 1),
 quiz_ready boolean not null default false, needs_review boolean not null default false,
 parsing_warnings jsonb not null default '[]'::jsonb check(jsonb_typeof(parsing_warnings)='array'),
 solver_status text not null check(solver_status in ('not_needed','pending','processing','solved','uncertain','invalid','solver_failed','unsupported','needs_review')),
 solver_run_id uuid, solver_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint solution_quiz_ready check(not quiz_ready or (length(btrim(question_text))>0 and jsonb_array_length(choices)=4 and correct_choice is not null
 and answer_origin in ('source','ai_derived') and jsonb_array_length(parsing_warnings)=0
 and (answer_origin='source' or (length(btrim(explanation))>0 and ai_confidence>=0.65))))
);
create index question_solutions_document_idx on public.question_solutions(document_id,analysis_run_id);
create table public.document_solver_jobs (
 document_id uuid primary key references public.documents(id) on delete cascade, run_id uuid not null, analysis_run_id uuid not null,
 status text not null check(status in ('processing','ready','failed')), expires_at timestamptz, error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.question_solutions enable row level security;
alter table public.document_solver_jobs enable row level security;
revoke all on public.question_solutions,public.document_solver_jobs from anon;
grant select,insert,update,delete on public.question_solutions,public.document_solver_jobs to authenticated;
create policy solution_owner on public.question_solutions for all to authenticated
using(exists(select 1 from public.documents d where d.id=document_id and d.user_id=(select auth.uid())))
with check(exists(select 1 from public.questions q join public.documents d on d.id=q.document_id where q.id=question_id
 and q.document_id=question_solutions.document_id and q.analysis_run_id=question_solutions.analysis_run_id and d.user_id=(select auth.uid())));
create policy solver_job_owner on public.document_solver_jobs for all to authenticated
using(exists(select 1 from public.documents d where d.id=document_id and d.user_id=(select auth.uid())))
with check(exists(select 1 from public.documents d where d.id=document_id and d.user_id=(select auth.uid())));
create trigger solution_touch before update on public.question_solutions for each row execute function study_private.touch_updated_at();
create trigger solver_job_touch before update on public.document_solver_jobs for each row execute function study_private.touch_updated_at();
create function public.expire_document_solver(p_document_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare job public.document_solver_jobs;
begin
 select j.* into job from public.document_solver_jobs j join public.documents d on d.id=j.document_id
 where j.document_id=p_document_id and d.user_id=auth.uid() and j.status='processing' and j.expires_at<=now() for update of j;
 if not found then return; end if;
 update public.question_solutions set solver_status='solver_failed',solver_error='timeout' where document_id=job.document_id and solver_run_id=job.run_id and solver_status='processing';
 update public.document_solver_jobs set status='failed',error='timeout',expires_at=null where document_id=job.document_id;
end;
$$;
create function public.claim_document_solver(p_document_id uuid,p_regenerate boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.documents; job public.document_solver_jobs; nonce uuid; ids uuid[]; current_analysis uuid;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
 perform public.expire_document_solver(p_document_id);
 select * into d from public.documents where id=p_document_id and user_id=auth.uid() for update;
 if not found then return jsonb_build_object('action','not_found'); end if;
 if d.status<>'ready' then return jsonb_build_object('action','not_ready'); end if;
 select * into job from public.document_solver_jobs where document_id=d.id;
 if job.status='processing' and job.expires_at>now() then return jsonb_build_object('action','busy'); end if;
 if exists(select 1 from public.document_solver_jobs j join public.documents od on od.id=j.document_id where od.user_id=auth.uid() and j.status='processing' and j.expires_at>now()) then return jsonb_build_object('action','limit'); end if;
 select current_run_id into current_analysis from public.document_analyses where document_id=d.id;
 if current_analysis is null then return jsonb_build_object('action','not_ready'); end if;
 select array_agg(question_id) into ids from (
 select s.question_id from public.question_solutions s join public.questions q on q.id=s.question_id
 where s.document_id=d.id and s.analysis_run_id=current_analysis and q.analysis_run_id=current_analysis
 and q.correct_answer is null and q.answer_origin='not_provided' and s.answer_origin<>'source'
 and jsonb_array_length(s.parsing_warnings)=0 and s.original_type in ('multiple_choice','short_answer','calculation')
 and jsonb_array_length(q.choices) in (0,4)
 and ((p_regenerate and s.solver_status<>'processing') or s.solver_status in ('pending','solver_failed'))
 order by s.question_id limit 50 for update of s) candidates;
 if ids is null then return jsonb_build_object('action','ready'); end if;
 nonce:=gen_random_uuid();
 update public.question_solutions set solver_status='processing',solver_run_id=nonce,solver_error=null where question_id=any(ids);
 insert into public.document_solver_jobs(document_id,run_id,analysis_run_id,status,expires_at,error) values(d.id,nonce,current_analysis,'processing',now()+interval '4 minutes',null)
 on conflict(document_id) do update set run_id=excluded.run_id,analysis_run_id=excluded.analysis_run_id,status=excluded.status,expires_at=excluded.expires_at,error=null;
 return jsonb_build_object('action','started','runId',nonce,'questionIds',to_jsonb(ids));
end;
$$;
create function public.complete_question_solutions(p_document_id uuid,p_run_id uuid,p_model text,p_results jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare job public.document_solver_jobs; solution public.question_solutions; q public.questions; result jsonb; affected integer:=0;
begin
 select j.* into job from public.document_solver_jobs j join public.documents d on d.id=j.document_id
 join public.document_analyses a on a.document_id=d.id and a.current_run_id=j.analysis_run_id
 where j.document_id=p_document_id and d.user_id=auth.uid() and d.status='ready' and j.status='processing' and j.run_id=p_run_id and j.expires_at>now() for update of j;
 if not found then return 0; end if;
 if jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)>5 then raise check_violation; end if;
 for result in select value from jsonb_array_elements(p_results) loop
 select * into solution from public.question_solutions where question_id=(result->>'id')::uuid and document_id=job.document_id
 and analysis_run_id=job.analysis_run_id and solver_run_id=p_run_id and solver_status='processing' and answer_origin<>'source' for update;
 if not found then continue; end if;
 select * into q from public.questions where id=solution.question_id and analysis_run_id=job.analysis_run_id;
 if not found or q.correct_answer is not null or q.answer_origin<>'not_provided' then continue; end if;
 if solution.original_type='multiple_choice' and jsonb_array_length(q.choices)=4 and solution.choices is distinct from result->'choices' then raise check_violation; end if;
 update public.question_solutions set choices=result->'choices',correct_choice=result->>'correctChoice',correct_answer=coalesce(result->>'correctChoice',result->>'answerText'),
 answer_origin=case when coalesce(result->>'correctChoice',result->>'answerText') is null then 'none' else 'ai_derived' end,
 explanation=result->>'explanation',ai_provider='claude',ai_model=p_model,ai_confidence=(result->>'confidence')::numeric,
 quiz_ready=(result->>'quizReady')::boolean,needs_review=(result->>'needsReview')::boolean,solver_status=result->>'status',solver_error=null where question_id=solution.question_id;
 affected:=affected+1;
 end loop;
 return affected;
end;
$$;
create function public.finish_document_solver(p_document_id uuid,p_run_id uuid,p_error text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare job public.document_solver_jobs;
begin
 select j.* into job from public.document_solver_jobs j join public.documents d on d.id=j.document_id
 where j.document_id=p_document_id and d.user_id=auth.uid() and j.run_id=p_run_id and j.status='processing' for update of j;
 if not found then return; end if;
 update public.question_solutions set solver_status='solver_failed',solver_error=coalesce(p_error,'incomplete_batch') where document_id=job.document_id and solver_run_id=p_run_id and solver_status='processing';
 update public.document_solver_jobs set status=case when p_error is null then 'ready' else 'failed' end,error=p_error,expires_at=null where document_id=job.document_id;
end;
$$;
revoke all on function public.expire_document_solver(uuid),public.claim_document_solver(uuid,boolean),public.complete_question_solutions(uuid,uuid,text,jsonb),public.finish_document_solver(uuid,uuid,text) from public,anon;
grant execute on function public.expire_document_solver(uuid),public.claim_document_solver(uuid,boolean),public.complete_question_solutions(uuid,uuid,text,jsonb),public.finish_document_solver(uuid,uuid,text) to authenticated;
