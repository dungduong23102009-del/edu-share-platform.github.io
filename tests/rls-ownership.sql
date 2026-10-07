-- Execute with test.user_a and test.user_b set to isolated test account UUIDs.
-- All fixture data is rolled back; no quiz/AI data is retained.
begin;
select set_config('test.doc_a',gen_random_uuid()::text,true), set_config('test.doc_b',gen_random_uuid()::text,true),
set_config('test.topic_a',gen_random_uuid()::text,true), set_config('test.topic_b',gen_random_uuid()::text,true),
set_config('test.quiz_a',gen_random_uuid()::text,true), set_config('test.quiz_b',gen_random_uuid()::text,true),
set_config('test.question_a',gen_random_uuid()::text,true), set_config('test.question_b',gen_random_uuid()::text,true),
set_config('test.attempt_a',gen_random_uuid()::text,true), set_config('test.attempt_b',gen_random_uuid()::text,true);
insert into public.documents(id,user_id,original_filename,storage_path,mime_type,file_size,file_sha256)
select current_setting('test.doc_'||label)::uuid,current_setting('test.user_'||label)::uuid,'rls-test.pdf',current_setting('test.user_'||label)||'/'||current_setting('test.doc_'||label)||'/rls-test.pdf','application/pdf',100,repeat('0',64) from (values ('a'),('b')) as fixture(label);
insert into public.topics(id,document_id,title)
select current_setting('test.topic_'||label)::uuid,current_setting('test.doc_'||label)::uuid,'RLS fixture' from (values ('a'),('b')) as fixture(label);
insert into public.quizzes(id,user_id,document_id,title)
select current_setting('test.quiz_'||label)::uuid,current_setting('test.user_'||label)::uuid,current_setting('test.doc_'||label)::uuid,'RLS fixture' from (values ('a'),('b')) as fixture(label);
insert into public.questions(id,document_id,topic_id,question_text,choices,correct_answer)
select current_setting('test.question_'||label)::uuid,current_setting('test.doc_'||label)::uuid,current_setting('test.topic_'||label)::uuid,'RLS fixture','["A","B"]'::jsonb,'A' from (values ('a'),('b')) as fixture(label);
insert into public.quiz_attempts(id,quiz_id,user_id,total_questions)
select current_setting('test.attempt_'||label)::uuid,current_setting('test.quiz_'||label)::uuid,current_setting('test.user_'||label)::uuid,1 from (values ('a'),('b')) as fixture(label);
insert into public.quiz_answers(attempt_id,question_id,selected_answer)
select current_setting('test.attempt_'||label)::uuid,current_setting('test.question_'||label)::uuid,'A' from (values ('a'),('b')) as fixture(label);

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.user_a'),true),set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user_a'),'role','authenticated')::text,true);
do $assert$
declare hidden integer; owned integer; affected integer; table_name text; field_name text;
begin
  if auth.uid() <> current_setting('test.user_a')::uuid then raise exception 'Incorrect RLS test identity'; end if;
  select count(*) into hidden from public.profiles where id=current_setting('test.user_b')::uuid;
  if hidden<>0 then raise exception 'Cross-user profile is visible'; end if;
  for table_name,field_name in select * from (values ('documents','doc'),('topics','topic'),('quizzes','quiz'),('questions','question'),('quiz_attempts','attempt')) as checks(table_name,field_name)
  loop
    execute format('select count(*) from public.%I where id=$1',table_name) into hidden using current_setting('test.'||field_name||'_b')::uuid;
    execute format('select count(*) from public.%I where id=$1',table_name) into owned using current_setting('test.'||field_name||'_a')::uuid;
    if hidden<>0 or owned<>1 then raise exception 'RLS select failed: %',table_name; end if;
  end loop;
  select count(*) into hidden from public.quiz_answers where attempt_id=current_setting('test.attempt_b')::uuid;
  select count(*) into owned from public.quiz_answers where attempt_id=current_setting('test.attempt_a')::uuid;
  if hidden<>0 or owned<>1 then raise exception 'RLS quiz_answers select failed'; end if;
  update public.profiles set display_name='forbidden' where id=current_setting('test.user_b')::uuid;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Cross-user profile update succeeded'; end if;
  update public.topics set title='forbidden' where id=current_setting('test.topic_b')::uuid;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Cross-user topic update succeeded'; end if;
  delete from public.quiz_answers where attempt_id=current_setting('test.attempt_b')::uuid;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Cross-user answer deletion succeeded'; end if;
  begin
    insert into public.topics(document_id,title) values(current_setting('test.doc_b')::uuid,'forbidden');
    raise exception 'Cross-user topic insert succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.quizzes(user_id,document_id,title) values(auth.uid(),current_setting('test.doc_b')::uuid,'forbidden');
    raise exception 'Cross-user quiz linkage succeeded';
  exception when foreign_key_violation or insufficient_privilege then null; end;
  begin
    insert into public.questions(document_id,topic_id,question_text,choices,correct_answer) values(current_setting('test.doc_a')::uuid,current_setting('test.topic_b')::uuid,'forbidden','["A","B"]'::jsonb,'A');
    raise exception 'Cross-user topic linkage succeeded';
  exception when foreign_key_violation or insufficient_privilege then null; end;
  begin
    insert into public.quiz_attempts(quiz_id,user_id,total_questions) values(current_setting('test.quiz_b')::uuid,auth.uid(),1);
    raise exception 'Cross-user attempt linkage succeeded';
  exception when foreign_key_violation or insufficient_privilege then null; end;
  begin
    insert into public.quiz_answers(attempt_id,question_id) values(current_setting('test.attempt_a')::uuid,current_setting('test.question_b')::uuid);
    raise exception 'Cross-user answer linkage succeeded';
  exception when insufficient_privilege then null; end;
end;
$assert$;
reset role;
rollback;
select 'PASS: seven-table ownership, child linkage and profile permissions' as result;
