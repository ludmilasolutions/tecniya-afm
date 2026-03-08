
-- Configuración de TecniBot (Agente de IA)
-- Ejecutar en el Editor SQL de Supabase

-- 1. Insertar perfil del Bot (si no existe)
INSERT INTO profiles (id, full_name, avatar_url, role)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'TecniBot', 'https://api.dicebear.com/7.x/bottts/svg?seed=TecniBot', 'admin')
ON CONFLICT (id) DO NOTHING;

-- 2. Crear el Webhook para mensajes nuevos al Bot
-- Nota: Asegúrate de que la extensión 'pg_net' esté activada en Supabase.
-- Puedes activarla con: CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.handle_bot_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si el destinatario de la conversación es el Bot
  IF EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = NEW.conversation_id 
    AND (participant_one = '00000000-0000-0000-0000-0000000000a1' OR participant_two = '00000000-0000-0000-0000-0000000000a1')
  ) AND NEW.sender_id != '00000000-0000-0000-0000-0000000000a1' THEN
    
    -- Llamar a la Edge Function
    PERFORM
      net.http_post(
        url := 'https://' || current_setting('request.headers')::json->>'host' || '/functions/v1/ai-handler',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'type', 'new_message',
          'record', row_to_json(NEW)
        )
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para ejecutar la función al insertar un mensaje
DROP TRIGGER IF EXISTS tr_bot_message ON messages;
CREATE TRIGGER tr_bot_message
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION handle_bot_message();
