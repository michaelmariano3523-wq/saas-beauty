import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ejdsuslapvzsseqotvhp.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const ASAAS_WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET || 'whsec_54LWQEGOnoXnwWuDiNPFZAP6yYMXRVQAxgYuuCSLGjA';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers['asaas-access-token'];
  if (token !== ASAAS_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook token' });
  }

  try {
    const rawBody = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', (err: Error) => reject(err));
    });

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payment = event.payment;

    if (!payment || !payment.id) {
      return res.status(200).json({ received: true });
    }

    const paymentId = payment.id;
    const status = payment.status;
    const email = payment.customer?.email || payment.email || '';
    let planId = payment.externalReference || '';

    // If externalReference is missing on the payment, try to get it from the subscription
    if (!planId && payment.subscription) {
      try {
        const subRes = await fetch(`https://api.asaas.com/v3/subscriptions/${payment.subscription}`, {
          headers: { 'access_token': process.env.ASAAS_API_KEY || '' },
        });
        const subText = await subRes.text();
        try { const subData = JSON.parse(subText); planId = subData.externalReference || ''; } catch {}
      } catch (e) {
        console.error('Failed to fetch subscription for externalReference:', e);
      }
    }

    const value = payment.value || 0;

    if (!SUPABASE_SERVICE_KEY) {
      return res.status(200).json({ received: true });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
      await supabase.from('payments').update({
        status,
        updated_at: new Date().toISOString(),
      }).eq('order_id', paymentId);
    } catch (e) {
      console.error('Failed to update payment:', e);
    }

    if ((eventType === 'PAYMENT_CONFIRMED' || eventType === 'PAYMENT_RECEIVED') && status === 'CONFIRMED') {
      try {
        const { data: shopsByPlan } = await supabase
          .from('shops')
          .select('id, owner_id')
          .eq('id', planId);

        if (shopsByPlan && shopsByPlan.length > 0) {
          for (const shop of shopsByPlan) {
            const { data: cur } = await supabase.from('shops').select('balance').eq('id', shop.id).single();
            await supabase.from('shops').update({ balance: Number(cur?.balance || 0) + Number(value) }).eq('id', shop.id);
          }
        } else {
          const { data: shopsByEmail } = await supabase
            .from('shops')
            .select('id')
            .eq('email', email);
          if (shopsByEmail && shopsByEmail.length > 0) {
            const { data: cur } = await supabase.from('shops').select('balance').eq('id', shopsByEmail[0].id).single();
            await supabase.from('shops').update({ balance: Number(cur?.balance || 0) + Number(value) }).eq('id', shopsByEmail[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to update shop balance:', e);
      }

      try {
        const { data: shopsByPlan } = await supabase
          .from('shops')
          .select('id, owner_id')
          .eq('id', planId);

        if (shopsByPlan && shopsByPlan.length > 0) {
          for (const shop of shopsByPlan) {
            await supabase
              .from('shops')
              .update({
                plan: planId,
                plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'active',
              })
              .eq('id', shop.id);
          }
        } else {
          const { data: shopsByEmail } = await supabase
            .from('shops')
            .select('id')
            .eq('email', email);

          if (shopsByEmail && shopsByEmail.length > 0) {
            await supabase
              .from('shops')
              .update({
                plan: planId,
                plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'active',
              })
              .eq('id', shopsByEmail[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to activate shop plan:', e);
      }

      try {
        await supabase.from('subscriptions').insert({
          asaas_payment_id: paymentId,
          asaas_customer_id: payment.customer?.id || '',
          plan_id: planId,
          email,
          status: 'ACTIVE',
          value,
          payment_method: 'BOLETO',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to save subscription:', e);
      }
    }

    if (eventType === 'PAYMENT_OVERDUE' && status === 'OVERDUE') {
      try {
        const { data: shopsByEmail } = await supabase
          .from('shops')
          .select('id')
          .eq('email', email);

        if (shopsByEmail && shopsByEmail.length > 0) {
          await supabase
            .from('shops')
            .update({ status: 'suspended' })
            .eq('id', shopsByEmail[0].id);
        }
      } catch (e) {
        console.error('Failed to suspend shop:', e);
      }
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(200).json({ received: true, error: error.message });
  }
}
