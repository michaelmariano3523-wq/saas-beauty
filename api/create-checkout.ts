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
    const { planId, planName, amount, email, cpfCnpj, billingType } = body;
    if (!planId || !amount || !email) {
      return res.status(400).json({ error: 'Missing required fields: planId, amount, email' });
    }
    if (!cpfCnpj) {
      return res.status(400).json({ error: 'CPF_CNPJ_REQUIRED', message: 'Informe seu CPF ou CNPJ para continuar' });
    }

    const customerId = await findOrCreateCustomer(email, cpfCnpj);
    const type = billingType || 'PIX';

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const paymentBody = {
      customer: customerId,
      billingType: type,
      value: amount / 100,
      dueDate: dueDateStr,
      description: `Plano ${planName || 'Barber Shop'}`,
      externalReference: planId,
    };

    const response = await fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentBody),
    });

    const responseText = await response.text();
    let data;
    try { data = JSON.parse(responseText); } catch { throw new Error(`Asaas create payment returned invalid JSON: ${responseText}`); }

    if (!response.ok) {
      if (type === 'PIX' && data.errors?.some((e: any) => e.code === 'invalid_billingType')) {
        const boletoResponse = await fetch(`${API_BASE}/payments`, {
          method: 'POST',
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...paymentBody, billingType: 'BOLETO' }),
        });
        const boletoText = await boletoResponse.text();
        try { data = JSON.parse(boletoText); } catch { throw new Error(`Asaas boleto fallback failed: ${boletoText}`); }
        if (!boletoResponse.ok) {
          return res.status(boletoResponse.status).json({ error: 'Asaas error', detail: data });
        }
      } else {
        return res.status(response.status).json({ error: 'Asaas error', detail: data });
      }
    }

    const result: any = {
      success: true,
      orderId: data.id,
      chargeId: data.id,
      status: data.status,
      invoiceUrl: data.invoiceUrl || '',
      billingType: data.billingType || type,
    };

    if (data.billingType === 'PIX' || type === 'PIX') {
      let pixInfo = { encodedImage: '', payload: '' };
      try {
        const pixRes = await fetch(`${API_BASE}/payments/${data.id}/pixQrCode`, {
          headers: { 'access_token': ASAAS_API_KEY },
        });
        const pixText = await pixRes.text();
        try { pixInfo = JSON.parse(pixText); } catch { console.error('Failed to parse PIX QR Code:', pixText); }
      } catch (e) {
        console.error('Failed to get PIX QR Code:', e);
      }
      result.brCode = pixInfo.payload || '';
      result.brCodeBase64 = pixInfo.encodedImage ? `data:image/png;base64,${pixInfo.encodedImage}` : '';
      result.expiresAt = data.dueDate || '';
    } else {
      result.bankSlipUrl = data.bankSlipUrl || data.invoiceUrl || '';
      result.barCode = data.barCode || '';
    }

    if (SUPABASE_SERVICE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        let shopId = null;
        try {
          const { data: shopData } = await supabase.from('shops').select('id').eq('email', email).limit(1).single();
          shopId = shopData?.id || null;
        } catch {}
        await supabase.from('payments').insert({
          order_id: data.id,
          charge_id: data.id,
          reference_id: planId,
          plan_id: planId,
          shop_id: shopId,
          email,
          amount: amount / 100,
          status: data.status,
          pix_text: result.brCode || '',
          customer_id: customerId,
          created_at: new Date().toISOString(),
        });
      } catch (dbError) {
        console.error('Failed to save payment to Supabase:', dbError);
      }
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Checkout error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
