-- Fix RLS policies para tabla jobs
-- El campo professional_id referencia professionals.id, NO auth.uid()
-- Ejecutar en Supabase SQL Editor

DROP POLICY IF EXISTS "jobs_select" ON jobs;
DROP POLICY IF EXISTS "jobs_insert" ON jobs;
DROP POLICY IF EXISTS "jobs_update" ON jobs;
DROP POLICY IF EXISTS "jobs_delete" ON jobs;

CREATE POLICY "jobs_select" ON jobs FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM professionals WHERE professionals.id = jobs.professional_id AND professionals.user_id = auth.uid())
);
CREATE POLICY "jobs_insert" ON jobs FOR INSERT WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM professionals WHERE professionals.id = jobs.professional_id AND professionals.user_id = auth.uid())
);
CREATE POLICY "jobs_update" ON jobs FOR UPDATE USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM professionals WHERE professionals.id = jobs.professional_id AND professionals.user_id = auth.uid())
);
CREATE POLICY "jobs_delete" ON jobs FOR DELETE USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM professionals WHERE professionals.id = jobs.professional_id AND professionals.user_id = auth.uid())
);
