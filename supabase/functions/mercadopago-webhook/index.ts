import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.json()
    const { type, data } = body

    if (type === 'payment') {
      const paymentId = data?.id
      if (!paymentId) {
        return new Response(JSON.stringify({ error: 'No payment ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
          }
        }
      )

      if (!paymentResponse.ok) {
        throw new Error('Failed to get payment info')
      }

      const paymentInfo = await paymentResponse.json()

      if (paymentInfo.status === 'approved') {
        const externalRef = paymentInfo.external_reference

        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            payment_method: paymentInfo.payment_method_id,
            payment_id: paymentInfo.id.toString()
          })
          .eq('professional_id', externalRef)
          .eq('status', 'pending')

        await supabase
          .from('professionals')
          .update({ is_featured: true })
          .eq('user_id', externalRef)

        console.log(`Payment approved for professional: ${externalRef}`)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
