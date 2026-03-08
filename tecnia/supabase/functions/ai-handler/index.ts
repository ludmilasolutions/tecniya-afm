
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    const { record } = payload

    if (!record) return new Response(JSON.stringify({ error: 'No record found' }), { status: 400 })

    const { conversation_id, sender_id, content } = record

    // 1. Obtener historial reciente para contexto
    const { data: history } = await supabaseClient
      .from('messages')
      .select('content, sender_id')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(10)

    const chatHistory = (history || []).reverse().map(m => ({
      role: m.sender_id === '00000000-0000-0000-0000-0000000000a1' ? 'assistant' : 'user',
      content: m.content
    }))

    // 2. Definir System Prompt
    const systemPrompt = `Eres TecniBot, el asistente inteligente de TecniYa. 
    Tu objetivo es ayudar a los usuarios a navegar la plataforma, encontrar profesionales y resolver dudas.
    Sé amable, servicial y profesional. Si el usuario busca un profesional, recomiéndale usar el buscador de la página principal.`

    // 3. Llamada a la IA (Simulada por ahora o usando una API de IA si se configura)
    // En una implementación real, aquí llamarías a Google Gemini o OpenAI.
    // Por ahora, daremos una respuesta genérica basada en palabras clave.
    
    let aiResponse = "¡Hola! Soy TecniBot. ¿En qué puedo ayudarte hoy?"
    const lowerContent = content.toLowerCase()
    
    if (lowerContent.includes("hola")) {
      aiResponse = "¡Hola! Soy TecniBot, tu asistente de TecniYa. ¿Necesitás ayuda para encontrar un profesional o tenés alguna duda sobre la plataforma?"
    } else if (lowerContent.includes("profesional") || lowerContent.includes("ayuda")) {
      aiResponse = "Puedo ayudarte a encontrar profesionales de plomería, electricidad, pintura y mucho más. Te recomiendo usar los filtros de búsqueda en la pantalla de inicio para ver a los mejores especialistas cerca de tu zona."
    } else if (lowerContent.includes("quien eres") || lowerContent.includes("qué sos")) {
      aiResponse = "Soy TecniBot, el asistente virtual de TecniYa. Estoy aquí para facilitarte el uso de la plataforma y ayudarte a conectar con los mejores técnicos."
    } else {
      aiResponse = "Entiendo. Contame un poco más o haceme una pregunta específica sobre cómo usar TecniYa y haré lo mejor para ayudarte."
    }

    // 4. Insertar respuesta de la IA en la tabla de mensajes
    const { error: insertError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id,
        sender_id: '00000000-0000-0000-0000-0000000000a1',
        content: aiResponse,
        type: 'text'
      })

    if (insertError) throw insertError

    // 5. Actualizar la previsualización de la conversación
    await supabaseClient
      .from('conversations')
      .update({
        last_message_preview: aiResponse,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation_id)

    return new Response(JSON.stringify({ success: true, response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
