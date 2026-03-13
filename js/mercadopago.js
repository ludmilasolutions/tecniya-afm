import { store } from './store.js';
import { getSupabase } from './supabase.js';
import { showToast, showModal, closeModal } from './ui.js';
import { MERCADOPAGO_CONFIG, SUBSCRIPTION_PRICE } from './config.js';

let mp = null;

export async function initMercadoPago() {
  if (typeof MercadoPago !== 'undefined') {
    mp = new MercadoPago(MERCADOPAGO_CONFIG.PUBLIC_KEY, {
      locale: 'es-AR'
    });
  }
}

export async function createSubscriptionPayment() {
  if (!store.currentUser) {
    closeModal('modal-subscription');
    showModal('modal-login');
    return;
  }

  if (!store.currentPro) {
    showToast('No tienes un perfil profesional activo', 'error');
    return;
  }

  showToast('Creando pago...', 'info');

  const sb = getSupabase();
  const proName = store.currentUser.user_metadata?.full_name || 'Profesional';
  const proEmail = store.currentUser.email;

  try {
    const { data: existingSub } = await sb
      .from('subscriptions')
      .select('*')
      .eq('professional_id', store.currentPro.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingSub) {
      showToast('Ya tienes una suscripción activa', 'info');
      return;
    }

    const preference = {
      items: [
        {
          title: 'Plan Destacado - TECNIYA',
          description: `Suscripción mensual para profesional: ${proName}`,
          unit_price: SUBSCRIPTION_PRICE,
          quantity: 1,
          currency_id: 'ARS'
        }
      ],
      payer: {
        email: proEmail,
        name: proName
      },
      external_reference: store.currentPro.id,
      notification_url: `${MERCADOPAGO_CONFIG.BACKEND_URL}/functions/v1/mercadopago-webhook`,
      back_urls: {
        success: `${window.location.origin}/?subscription=success`,
        failure: `${window.location.origin}/?subscription=failed`,
        pending: `${window.location.origin}/?subscription=pending`
      },
      auto_return: 'approved'
    };

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MERCADOPAGO_CONFIG.ACCESS_TOKEN}`
      },
      body: JSON.stringify(preference)
    });

    if (!response.ok) {
      throw new Error('Error al crear preferencia de pago');
    }

    const data = await response.json();

    const { error: insertError } = await sb.from('subscriptions').insert({
      professional_id: store.currentPro.id,
      user_id: store.currentUser.id,
      type: 'destacado',
      status: 'pending',
      price: SUBSCRIPTION_PRICE,
      currency: 'ARS',
      payment_id: data.id,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    if (insertError) {
      console.error('Error inserting subscription:', insertError);
    }

    window.location.href = data.init_point;

  } catch (error) {
    console.error('Payment error:', error);
    showToast('Error al procesar el pago. Intenta de nuevo.', 'error');
  }
}

export async function handlePaymentWebhook(payload) {
  const sb = getSupabase();
  const { type, data } = payload;

  if (type === 'payment') {
    const paymentId = data?.id;
    if (!paymentId) return { success: false };

    try {
      const paymentInfo = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${MERCADOPAGO_CONFIG.ACCESS_TOKEN}`
        }
      }).then(r => r.json());

      if (paymentInfo.status === 'approved') {
        const externalRef = paymentInfo.external_reference;

        await sb.from('subscriptions')
          .update({
            status: 'active',
            payment_method: paymentInfo.payment_method_id,
            payment_id: paymentInfo.id.toString()
          })
          .eq('professional_id', externalRef)
          .eq('status', 'pending');

        await sb.from('professionals')
          .update({ is_featured: true })
          .eq('user_id', externalRef);

        return { success: true };
      }
    } catch (error) {
      console.error('Webhook error:', error);
      return { success: false };
    }
  }

  return { success: true };
}

export function createCardPayment(paymentMethodsId) {
  if (!mp) {
    showToast('MercadoPago no está disponible', 'error');
    return;
  }

  mp.checkout({
    preference: {
      items: [{
        title: 'Plan Destacado - TECNIYA',
        unit_price: SUBSCRIPTION_PRICE,
        quantity: 1
      }]
    },
    render: {
      container: '.card-payment-container',
      type: 'payment'
    }
  });
}
