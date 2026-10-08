create policy quiz_snapshots_no_direct_access on study_private.quiz_questions for all to authenticated using (false) with check (false);
