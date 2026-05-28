import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ejdsuslapvzsseqotvhp.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';

const API_BASE = 'https://api.asaas.com/v3';

async function findOrCreateCustomer(name: string, email: string, phone: string, cpfCnpj?: string): Promise<string> {
  const customerCpf = cpfCnpj || '24971563792';
  const cleanPhone = phone.replace(/\D/g, '');

  // Search existing
  const searchRes = await fetch(`${API_BASE}/customers?cpfCnpj=${customerCpf}`, {
    headers: { 'access_token': ASAAS_API_KEY }
  });
  const searchData = await searchRes.json();
  if (searchData.data?.length > 0) return searchData.data[0].id;

  // Create
  const createRes = await fetch(`${API_BASE}/customers`, {
    method: 'POST',
    headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      cpfCnpj: customerCpf,
      email: email || `${name.replace(/\s+/g, '').toLowerCase()}@temp.com`,
      phone: cleanPhone,
      notificationDisabled: true
    })
  });
  const createData = await createRes.json();
  return createData.id;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { customerName, customerEmail, customerPhone, customerCpf, productName, productPrice, quantity, shopId } = req.body || {};

  if (!customerName || !productName || !productPrice || !quantity || !shopId) {
    return res.status(400).json({ error: 'Dados incompletos', message: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    const customerId = await findOrCreateCustomer(customerName, customerEmail || '', customerPhone || '', customerCpf);

    const totalValue = (Number(productPrice) * Number(quantity)).toFixed(2);

    const paymentRes = await fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: Number(totalValue),
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: `${quantity}x ${productName}`,
        externalReference: shopId,
      })
    });
    const paymentData = await paymentRes.json();

    if (paymentData.errors) {
      const msg = paymentData.errors.map((e: any) => e.description).join('; ');
      return res.status(400).json({ error: msg, message: msg });
    }

    const paymentId = paymentData.id;

    // Get PIX QR Code
    const pixRes = await fetch(`${API_BASE}/payments/${paymentId}/pixQrCode`, {
      headers: { 'access_token': ASAAS_API_KEY }
    });
    const pixData = await pixRes.json();

    return res.status(200).json({
      paymentId,
      pix: {
        encodedImage: pixData.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : '',
        payload: pixData.payload || '',
      },
      value: totalValue,
    });
  } catch (error: any) {
    console.error('Buy product error:', error);
    return res.status(500).json({ error: error.message || 'Erro interno', message: 'Erro ao processar compra.' });
  }
}
