-- Políticas RLS para sistema de geolocalización

-- Permitir a profesionales actualizar su propia ubicación
CREATE POLICY "Profesionales pueden actualizar su ubicación"
ON public.professionals
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Permitir lectura pública de ubicación de profesionales (para búsquedas)
CREATE POLICY "Lectura pública de ubicación profesionales"
ON public.professionals
FOR SELECT
TO public
USING (true);

-- Permitir a usuarios crear solicitudes urgentes
CREATE POLICY "Usuarios pueden crear solicitudes urgentes"
ON public.urgent_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Permitir a usuarios leer sus propias solicitudes urgentes
CREATE POLICY "Usuarios pueden leer sus solicitudes"
ON public.urgent_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR accepted_by = auth.uid() OR auth.uid() = ANY(notified_pros));

-- Permitir a profesionales actualizar solicitudes urgentes (aceptar)
CREATE POLICY "Profesionales pueden aceptar urgencias"
ON public.urgent_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = ANY(notified_pros))
WITH CHECK (auth.uid() = ANY(notified_pros));

-- Permitir ejecución de función RPC a todos
GRANT EXECUTE ON FUNCTION get_nearby_online_professionals TO anon, authenticated;
