import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY')!

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const { user_id, title, body, data, type } = await req.json()

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id and title required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', user_id)

    if (tokensError || !tokens?.length) {
      console.log('No tokens found for user:', user_id)
      return new Response(JSON.stringify({ success: true, message: 'No tokens found' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const results = []
    
    for (const token of tokens) {
      const payload = {
        to: token.token,
        notification: {
          title,
          body: body || '',
          icon: 'https://tu-proyecto.com/assets/icon-192.png',
          badge: 'https://tu-proyecto.com/assets/icon-192.png'
        },
        data: {
          ...data,
          type: type || 'general',
          click_action: 'https://tu-proyecto.com'
        },
        web: {
          notification: {
            vibrate: [200, 100, 200],
            icon: 'https://tu-proyecto.com/assets/icon-192.png'
          }
        }
      }

      const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${FCM_SERVER_KEY}`
        },
        body: JSON.stringify(payload)
      })

      const fcmResult = await fcmResponse.json()
      results.push({ token: token.token.substring(0, 20) + '...', success: fcmResult.success })

      if (!fcmResult.success) {
        console.log('FCM error:', fcmResult)
        
        if (fcmResult.results?.[0]?.error === 'NotRegistered') {
          await supabase
            .from('push_tokens')
            .delete()
            .eq('token', token.token)
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Push notification error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
