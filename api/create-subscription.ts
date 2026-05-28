import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ejdsuslapvzsseqotvhp.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';

const API_BASE = 'https://api.asaas.com/v3';

async function findOrCreateCustomer(email: string, cpfCnpj?: string): Promise<string> {
  const customerCpf = cpfCnpj || '24971563792';
  const listRes = await fetch(`${API_BASE}/customers?email=${encodeURIComponent(email)}`, {
    headers: { 'access_token': ASAAS_API_KEY },
  });
  const listText = await listRes.text();
  let listData;
  try { listData = JSON.parse(listText); } catch { throw new Error(`Asaas list customers failed: ${listText}`); }
  if (listData.data && listData.data.length > 0) {
    const existing = listData.data[0];
    if (!existing.cpfCnpj) {
      await fetch(`${API_BASE}/customers/${existing.id}`, {
        method: 'POST',
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpfCnpj: customerCpf }),
      });
    }
    return existing.id;
  }
  const createRes = await fetch(`${API_BASE}/customers`, {
    method: 'POST',
    headers: {
      'access_token': ASAAS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: email.split('@')[0], email, cpfCnpj: customerCpf }),
  });
  const createText = await createRes.text();
  let createData;
  try { createData = JSON.parse(createText); } catch { throw new Error(`Asaas create customer failed: ${createText}`); }
  if (!createRes.ok) throw new Error(`Asaas create customer error: ${JSON.stringify(createData)}`);
  return createData.id;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body: any = {};
  try {
    const rawBody = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', (err: Error) => reject(err));
    });
    body = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  try {
    const { planId, planName, amount, email, cycle, cpfCnpj, billingType } = body;
    if (!planId || !amount || !email) {
      return res.status(400).json({ error: 'Missing required fields: planId, amount, email' });
    }
    if (!cpfCnpj) {
      return res.status(400).json({ error: 'CPF_CNPJ_REQUIRED', message: 'Informe seu CPF ou CNPJ para continuar' });
    }

    const customerId = await findOrCreateCustomer(email, cpfCnpj);
    const type = billingType || 'PIX';

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 3);
    const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

    const subscriptionBody = {
      customer: customerId,
      billingType: type,
      nextDueDate: nextDueDateStr,
      value: amount / 100,
      cycle: cycle || 'MONTHLY',
      description: `Assinatura Plano ${planName || 'Barber Shop'}`,
      externalReference: planId,
    };

    console.log('Asaas request:', JSON.stringify(subscriptionBody));

    const response = await fetch(`${API_BASE}/subscriptions`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriptionBody),
    });

    const responseText = await response.text();
    console.log('Asaas response:', response.status, responseText.substring(0, 500));

    let data;
    try { data = JSON.parse(responseText); } catch { throw new Error(`Asaas create subscription returned invalid JSON: ${responseText}`); }

    if (!response.ok) {
      if (type === 'PIX' && data.errors?.some((e: any) => e.code === 'invalid_billingType')) {
        const boletoResponse = await fetch(`${API_BASE}/subscriptions`, {
          method: 'POST',
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...subscriptionBody, billingType: 'BOLETO' }),
        });
        const boletoText = await boletoResponse.text();
        try { data = JSON.parse(boletoText); } catch { throw new Error(`Asaas boleto fallback subscription failed: ${boletoText}`); }
        if (!boletoResponse.ok) {
          const errMsg = data?.errors?.[0]?.description || data?.error || 'Erro no processamento';
          return res.status(boletoResponse.status).json({ error: 'Asaas error', message: errMsg, detail: data });
        }
      } else {
        const errMsg = data?.errors?.[0]?.description || data?.error || 'Erro no processamento';
        return res.status(response.status).json({ error: 'Asaas error', message: errMsg, detail: data });
      }
    }

    const result: any = {
      success: true,
      subscriptionId: data.id,
      customerId,
      status: data.status,
      nextDueDate: data.nextDueDate || '',
      value: data.value || amount / 100,
      billingType: data.billingType || type,
    };

    // Fetch first payment for details
    try {
      const paymentsRes = await fetch(`${API_BASE}/subscriptions/${data.id}/payments`, {
        headers: { 'access_token': ASAAS_API_KEY },
      });
      const paymentsText = await paymentsRes.text();
      let paymentsData;
      try { paymentsData = JSON.parse(paymentsText); } catch { console.error('Failed to parse payments:', paymentsText); paymentsData = null; }
      const firstPayment = paymentsData?.data?.[0];

      if (data.billingType === 'PIX' || type === 'PIX') {
        if (firstPayment) {
          let pixInfo = { encodedImage: '', payload: '' };
          try {
            const pixRes = await fetch(`${API_BASE}/payments/${firstPayment.id}/pixQrCode`, {
              headers: { 'access_token': ASAAS_API_KEY },
            });
            const pixText = await pixRes.text();
            try { pixInfo = JSON.parse(pixText); } catch { console.error('Failed to parse PIX QR Code:', pixText); }
          } catch (e) {
            console.error('Failed to get PIX QR Code:', e);
          }
          result.brCode = pixInfo.payload || '';
          result.brCodeBase64 = pixInfo.encodedImage ? `data:image/png;base64,${pixInfo.encodedImage}` : '';
        }
      } else {
        if (firstPayment) {
          result.bankSlipUrl = firstPayment.bankSlipUrl || firstPayment.invoiceUrl || '';
          result.barCode = firstPayment.barCode || '';
        }
      }
    } catch (e) {
      console.error('Failed to fetch subscription payments:', e);
      if (!(data.billingType === 'PIX' || type === 'PIX')) {
        result.bankSlipUrl = data.bankSlipUrl || data.invoiceUrl || '';
        result.barCode = data.barCode || '';
      }
    }

    if (SUPABASE_SERVICE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        let shopId = null;
        try {
          const { data: shopData } = await supabase.from('shops').select('id').eq('email', email).limit(1).single();
          shopId = shopData?.id || null;
        } catch {}
        await supabase.from('subscriptions').insert({
          asaas_subscription_id: data.id,
          asaas_customer_id: customerId,
          shop_id: shopId,
          plan_id: planId,
          email,
          status: data.status,
          value: amount / 100,
      cycle: cycle === 'YEARLY' ? 'ANNUALLY' : (cycle || 'MONTHLY'),
          payment_method: 'PIX',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        });
      } catch (dbError) {
        console.error('Failed to save subscription to Supabase:', dbError);
      }
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Subscription error:', error.message, error.stack || '');
    if (error.message?.startsWith('Asaas')) {
      return res.status(400).json({ error: 'Asaas error', message: error.message.substring(0, 200), detail: error.message.substring(0, 500) });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
