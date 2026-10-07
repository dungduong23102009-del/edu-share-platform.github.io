-- Set test.user_a/test.user_b to isolated Auth fixture UUIDs before execution.
-- No Storage objects are needed; every fixture is rolled back.
begin;
select set_config('test.analysis_doc_a',gen_random_uuid()::text,true),
       set_config('test.analysis_doc_b',gen_random_uuid()::text,true);
insert into public.documents(id,user_id,original_filename,storage_path,mime_type,file_size,file_sha256)
select current_setting('test.analysis_doc_'||label)::uuid,current_setting('test.user_'||label)::uuid,
  'analysis-transaction-test.pdf',current_setting('test.user_'||label)||'/'||current_setting('test.analysis_doc_'||label)||'/analysis-test.pdf',
  'application/pdf',100,repeat('0',64)
from (values ('a'),('b')) as fixture(label);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.user_a'),true),
  set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user_a'),'role','authenticated')::text,true);
do $assert$
declare
  doc uuid:=current_setting('test.analysis_doc_a')::uuid;
  foreign_doc uuid:=current_setting('test.analysis_doc_b')::uuid;
  claim jsonb; run_one uuid; run_two uuid; total integer;
  payload jsonb:='{"documentTitle":"Arithmetic","documentType":"question_answer","language":"en","summary":"Source extraction","topics":[{"title":"Arithmetic","summary":null,"sourcePages":[1]}],"sourceQuestions":[{"questionText":"What is 2+2?","choices":["3","5","4","6"],"explicitAnswer":"B","answerOrigin":"source","answerSourceExcerpt":"Source answer: B","topicTitle":"Arithmetic","sourcePage":1,"sourceExcerpt":"What is 2+2?","confidence":0.98}],"theoryPoints":[],"warnings":[]}'::jsonb;
begin
  if auth.uid()<>current_setting('test.user_a')::uuid then raise exception 'Wrong test identity'; end if;
  if public.claim_document_analysis(foreign_doc,false)->>'action'<>'not_found' then raise exception 'Foreign document claim allowed'; end if;
  if public.complete_document_analysis(foreign_doc,gen_random_uuid(),'test-only',payload) then raise exception 'Foreign completion allowed'; end if;
  claim:=public.claim_document_analysis(doc,false);
  if claim->>'action'<>'started' then raise exception 'Initial claim did not start'; end if;
  run_one:=(claim->>'runId')::uuid;
  if public.claim_document_analysis(doc,false)->>'action'<>'busy' then raise exception 'Concurrent analysis permitted'; end if;
  if public.complete_document_analysis(doc,gen_random_uuid(),'test-only',payload) then raise exception 'Wrong run nonce accepted'; end if;
  if not public.complete_document_analysis(doc,run_one,'test-only',payload) then raise exception 'Valid completion failed'; end if;
  select count(*) into total from public.questions where document_id=doc and analysis_run_id=run_one and correct_answer='B' and answer_origin='source';
  if total<>1 then raise exception 'Source answer changed'; end if;
  if public.claim_document_analysis(doc,false)->>'action'<>'ready' then raise exception 'Refresh started another run'; end if;
  claim:=public.claim_document_analysis(doc,true);
  if claim->>'action'<>'started' then raise exception 'Explicit reprocess did not start'; end if;
  run_two:=(claim->>'runId')::uuid;
  if run_two=run_one then raise exception 'Reprocess reused run nonce'; end if;
  begin
    perform public.complete_document_analysis(doc,run_two,'test-only',jsonb_set(payload,'{sourceQuestions,0,explicitAnswer}','null'::jsonb));
    raise exception 'Invalid payload was accepted';
  exception when check_violation then null;
  end;
  if (select current_run_id from public.document_analyses where document_id=doc)<>run_one then raise exception 'Failed transaction replaced old analysis'; end if;
  select count(*) into total from public.topics where document_id=doc and analysis_run_id=run_two;
  if total<>0 then raise exception 'Partial topics survived failed completion'; end if;
  select count(*) into total from public.questions where document_id=doc and analysis_run_id=run_one;
  if total<>1 then raise exception 'Failed reprocess removed source questions'; end if;
  if not public.complete_document_analysis(doc,run_two,'test-only',payload) then raise exception 'Successful reprocess failed'; end if;
  if (select current_run_id from public.document_analyses where document_id=doc)<>run_two then raise exception 'Current version pointer not updated'; end if;
  select count(*) into total from public.questions where document_id=doc;
  if total<>2 then raise exception 'Historical source questions not retained'; end if;
  update public.documents set status='processing',analysis_stage='reading',analysis_run_id=gen_random_uuid(),analysis_expires_at=now()-interval '1 minute' where id=doc;
  perform public.expire_document_analysis(doc);
  if not exists(select 1 from public.documents where id=doc and status='failed' and analysis_error='timeout') then raise exception 'Stale processing not recovered'; end if;
end;
$assert$;
select set_config('request.jwt.claim.sub',current_setting('test.user_b'),true),
  set_config('request.jwt.claims',json_build_object('sub',current_setting('test.user_b'),'role','authenticated')::text,true);
do $assert$
declare doc uuid:=current_setting('test.analysis_doc_a')::uuid; affected integer;
begin
  if exists(select 1 from public.document_analyses where document_id=doc) then raise exception 'Foreign analysis readable'; end if;
  if public.claim_document_analysis(doc,true)->>'action'<>'not_found' then raise exception 'Foreign reprocess allowed'; end if;
  update public.document_analyses set summary='forbidden' where document_id=doc;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Foreign analysis update allowed'; end if;
  begin
    insert into public.document_analyses(document_id,current_run_id,document_type,language,summary,model,warnings,raw_analysis)
    values(doc,gen_random_uuid(),'theory','en','forbidden','test-only','[]','{}');
    raise exception 'Foreign analysis insert allowed';
  exception when insufficient_privilege then null;
  end;
end;
$assert$;
rollback;
