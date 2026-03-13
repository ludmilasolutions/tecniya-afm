-- =====================================================
-- POLÍTICAS RLS CORREGIDAS
-- Copiar y ejecutar TODO en Supabase SQL Editor
-- =====================================================

-- 1. Tabla profiles - permitir todo para usuarios autenticados
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_insert ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;

CREATE POLICY profiles_select ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Tabla professionals - permitir todo
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pros_select ON professionals;
DROP POLICY IF EXISTS pros_insert ON professionals;
DROP POLICY IF EXISTS pros_update ON professionals;
DROP POLICY IF EXISTS pros_delete ON professionals;

CREATE POLICY pros_select ON professionals FOR SELECT USING (true);
CREATE POLICY pros_insert ON professionals FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);
CREATE POLICY pros_update ON professionals FOR UPDATE USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);
CREATE POLICY pros_delete ON professionals FOR DELETE USING (auth.uid() = user_id);

-- 3. Tabla jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jobs_select ON jobs;
DROP POLICY IF EXISTS jobs_insert ON jobs;
DROP POLICY IF EXISTS jobs_update ON jobs;
DROP POLICY IF EXISTS jobs_delete ON jobs;

CREATE POLICY jobs_select ON jobs FOR SELECT USING (true);
CREATE POLICY jobs_insert ON jobs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY jobs_update ON jobs FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY jobs_delete ON jobs FOR DELETE USING (auth.uid() IS NOT NULL);

-- 4. Work photos
ALTER TABLE public.work_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS work_photos_select ON work_photos;
DROP POLICY IF EXISTS work_photos_insert ON work_photos;
DROP POLICY IF EXISTS work_photos_update ON work_photos;
DROP POLICY IF EXISTS work_photos_delete ON work_photos;

CREATE POLICY work_photos_select ON work_photos FOR SELECT USING (true);
CREATE POLICY work_photos_insert ON work_photos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY work_photos_update ON work_photos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY work_photos_delete ON work_photos FOR DELETE USING (auth.uid() IS NOT NULL);

-- 5. Budgets
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budgets_select ON budgets;
DROP POLICY IF EXISTS budgets_insert ON budgets;
DROP POLICY IF EXISTS budgets_update ON budgets;
DROP POLICY IF EXISTS budgets_delete ON budgets;

CREATE POLICY budgets_select ON budgets FOR SELECT USING (true);
CREATE POLICY budgets_insert ON budgets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY budgets_update ON budgets FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY budgets_delete ON budgets FOR DELETE USING (auth.uid() IS NOT NULL);

-- 6. Reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reviews_select ON reviews;
DROP POLICY IF EXISTS reviews_insert ON reviews;
DROP POLICY IF EXISTS reviews_update ON reviews;
DROP POLICY IF EXISTS reviews_delete ON reviews;

CREATE POLICY reviews_select ON reviews FOR SELECT USING (true);
CREATE POLICY reviews_insert ON reviews FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY reviews_update ON reviews FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY reviews_delete ON reviews FOR DELETE USING (auth.uid() IS NOT NULL);

-- 7. Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notif_select ON notifications;
DROP POLICY IF EXISTS notif_insert ON notifications;
DROP POLICY IF EXISTS notif_update ON notifications;

CREATE POLICY notif_select ON notifications FOR SELECT USING (true);
CREATE POLICY notif_insert ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY notif_update ON notifications FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 8. Conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conv_select ON conversations;
DROP POLICY IF EXISTS conv_insert ON conversations;
DROP POLICY IF EXISTS conv_update ON conversations;

CREATE POLICY conv_select ON conversations FOR SELECT USING (true);
CREATE POLICY conv_insert ON conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY conv_update ON conversations FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 9. Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS msg_select ON messages;
DROP POLICY IF EXISTS msg_insert ON messages;
DROP POLICY IF EXISTS msg_update ON messages;

CREATE POLICY msg_select ON messages FOR SELECT USING (true);
CREATE POLICY msg_insert ON messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY msg_update ON messages FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 10. Favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fav_select ON favorites;
DROP POLICY IF EXISTS fav_insert ON favorites;
DROP POLICY IF EXISTS fav_delete ON favorites;

CREATE POLICY fav_select ON favorites FOR SELECT USING (true);
CREATE POLICY fav_insert ON favorites FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fav_delete ON favorites FOR DELETE USING (auth.uid() IS NOT NULL);

-- 11. Subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subs_select ON subscriptions;
DROP POLICY IF EXISTS subs_insert ON subscriptions;
DROP POLICY IF EXISTS subs_update ON subscriptions;

CREATE POLICY subs_select ON subscriptions FOR SELECT USING (true);
CREATE POLICY subs_insert ON subscriptions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY subs_update ON subscriptions FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 12. Certifications
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cert_select ON certifications;
DROP POLICY IF EXISTS cert_insert ON certifications;
DROP POLICY IF EXISTS cert_update ON certifications;
DROP POLICY IF EXISTS cert_delete ON certifications;

CREATE POLICY cert_select ON certifications FOR SELECT USING (true);
CREATE POLICY cert_insert ON certifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY cert_update ON certifications FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY cert_delete ON certifications FOR DELETE USING (auth.uid() IS NOT NULL);

-- 13. Addresses
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS addr_select ON addresses;
DROP POLICY IF EXISTS addr_insert ON addresses;
DROP POLICY IF EXISTS addr_update ON addresses;
DROP POLICY IF EXISTS addr_delete ON addresses;

CREATE POLICY addr_select ON addresses FOR SELECT USING (true);
CREATE POLICY addr_insert ON addresses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY addr_update ON addresses FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY addr_delete ON addresses FOR DELETE USING (auth.uid() IS NOT NULL);

-- 14. Ads
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ads_select ON ads;
DROP POLICY IF EXISTS ads_insert ON ads;
DROP POLICY IF EXISTS ads_update ON ads;
DROP POLICY IF EXISTS ads_delete ON ads;

CREATE POLICY ads_select ON ads FOR SELECT USING (true);
CREATE POLICY ads_insert ON ads FOR INSERT WITH CHECK (true);
CREATE POLICY ads_update ON ads FOR UPDATE USING (true);
CREATE POLICY ads_delete ON ads FOR DELETE USING (true);

-- 15. Urgent requests
ALTER TABLE public.urgent_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS urgent_select ON urgent_requests;
DROP POLICY IF EXISTS urgent_insert ON urgent_requests;
DROP POLICY IF EXISTS urgent_update ON urgent_requests;

CREATE POLICY urgent_select ON urgent_requests FOR SELECT USING (true);
CREATE POLICY urgent_insert ON urgent_requests FOR INSERT WITH CHECK (true);
CREATE POLICY urgent_update ON urgent_requests FOR UPDATE USING (true);

-- 16. Specialties y Cities (siempre público)
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS specialties_select ON specialties;
CREATE POLICY specialties_select ON specialties FOR SELECT USING (true);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cities_select ON cities;
CREATE POLICY cities_select ON cities FOR SELECT USING (true);
