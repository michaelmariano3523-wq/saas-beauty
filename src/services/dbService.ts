import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

let _fetchOrder = 0;
const staggeredDelay = () => {
  _fetchOrder++;
  return _fetchOrder * 2000 + Math.random() * 1000;
};

const activeSubscriptions: Map<string, { channel: RealtimeChannel; refCount: number }> = new Map();

function subscribeChannel(
  key: string,
  onConfig: Parameters<RealtimeChannel['on']>,
  subscribeCallback?: () => void
): () => void {
  const existing = activeSubscriptions.get(key);
  if (existing) {
    existing.refCount++;
    return () => {
      const sub = activeSubscriptions.get(key);
      if (sub) {
        sub.refCount--;
        if (sub.refCount <= 0) {
          activeSubscriptions.delete(key);
          supabase.removeChannel(sub.channel);
        }
      }
    };
  }

  const channel = supabase.channel(key);
  channel.on(onConfig[0], onConfig[1], onConfig[2]);
  channel.subscribe();
  activeSubscriptions.set(key, { channel, refCount: 1 });

  return () => {
    const sub = activeSubscriptions.get(key);
    if (sub) {
      sub.refCount--;
      if (sub.refCount <= 0) {
        activeSubscriptions.delete(key);
        supabase.removeChannel(sub.channel);
      }
    }
  };
}

async function fetchWithRetry(fn: () => Promise<void>, retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await fn();
      return;
    } catch (err: any) {
      const msg = err?.message || '';
      if ((msg.includes('429') || msg.includes('security purposes') || msg.includes('only request')) && i < retries - 1) {
        const wait = (i + 1) * 2000 + Math.random() * 2000;
        await delay(wait);
        continue;
      }
      throw err;
    }
  }
}

export const subscribeToPlans = (callback: (data: any[]) => void) => {
  const fetchPlans = async () => {
    await delay(staggeredDelay());
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (!error && data) {
      callback(data);
    }
  };

  fetchWithRetry(() => fetchPlans()).catch(e => console.error('fetchPlans error:', e));

  return subscribeChannel(
    'plans-changes',
    ['postgres_changes', { event: '*', schema: 'public', table: 'plans' }, () => fetchWithRetry(() => fetchPlans()).catch(e => console.error('fetchPlans error:', e))]
  );
};

export const subscribeToCollection = <T>(
  path: string,
  callback: (data: T[]) => void,
  shopId: string
) => {
  const cleanShopId = String(shopId).replace(/[^a-zA-Z0-9-_]/g, '');
  if (!cleanShopId || cleanShopId === 'undefined') {
    callback([]);
    return () => {};
  }

  const fetchData = async () => {
    await delay(staggeredDelay());
    const { data, error } = await supabase
      .from(path)
      .select('*')
      .eq('shop_id', cleanShopId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      callback(data as T[]);
    }
  };

  fetchWithRetry(() => fetchData()).catch(e => console.error('fetchData error:', e));

  return subscribeChannel(
    `collection-${path}-${cleanShopId}`,
    ['postgres_changes', { event: '*', schema: 'public', table: path, filter: `shop_id=eq.${cleanShopId}` }, () => fetchWithRetry(() => fetchData()).catch(e => console.error('fetchData error:', e))]
  );
};

export async function getShopByOwner(ownerId: string) {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_id', ownerId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getShopByEmail(email: string) {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createShop(shop: any) {
  const { data, error } = await supabase
    .from('shops')
    .insert(shop)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateShop(shopId: string, updates: any) {
  const { data, error } = await supabase
    .from('shops')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', shopId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getBarberBySlug(slug: string) {
  const { data, error } = await supabase
    .from('barbers')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function fetchInventoryByShopId(shopId: string) {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('shop_id', shopId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getShopById(shopId: string) {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function addBarber(barber: any) {
  const { data, error } = await supabase
    .from('barbers')
    .insert(barber)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateBarber(barberId: string, updates: any) {
  const { data, error } = await supabase
    .from('barbers')
    .update(updates)
    .eq('id', barberId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteBarber(barberId: string) {
  const { error } = await supabase
    .from('barbers')
    .update({ active: false })
    .eq('id', barberId);
  
  if (error) throw error;
}

export async function addAppointment(appointment: any) {
  const { data, error } = await supabase
    .from('appointments')
    .insert(appointment)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateAppointment(appointmentId: string, updates: any) {
  const { data, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', appointmentId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteAppointment(appointmentId: string) {
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', appointmentId);
  
  if (error) throw error;
}

export async function addInventoryItem(item: any) {
  const { data, error } = await supabase
    .from('inventory')
    .insert(item)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateInventoryItem(itemId: string, updates: any) {
  const { data, error } = await supabase
    .from('inventory')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteInventoryItem(itemId: string) {
  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('id', itemId);
  
  if (error) throw error;
}

export async function addPlan(plan: any) {
  const { data, error } = await supabase
    .from('plans')
    .insert(plan)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updatePlan(planId: string, updates: any) {
  const { data, error } = await supabase
    .from('plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deletePlan(planId: string) {
  const { error } = await supabase
    .from('plans')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', planId);
  
  if (error) throw error;
}

export const subscribeToShops = (callback: (data: any[]) => void) => {
  const fetchShops = async () => {
    await delay(staggeredDelay());
    const { data, error } = await supabase.from('shops').select('*').order('created_at', { ascending: false });
    if (!error && data) callback(data);
  };
  fetchWithRetry(() => fetchShops()).catch(e => console.error('fetchShops error:', e));
  return subscribeChannel(
    'shops-changes',
    ['postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => fetchWithRetry(() => fetchShops()).catch(e => console.error('fetchShops error:', e))]
  );
};

export const subscribeToUsers = (callback: (data: any[]) => void) => {
  const fetchUsers = async () => {
    await delay(staggeredDelay());
    const { data, error } = await supabase.auth.admin.listUsers();
    if (!error && data?.users) callback(data.users.map(u => ({ id: u.id, email: u.email })));
  };
  fetchWithRetry(() => fetchUsers()).catch(e => console.error('fetchUsers error:', e));
  return () => {};
};

export const subscribeToAppointments = (shopId: string, callback: (data: any[]) => void) => {
  return subscribeToCollection('appointments', callback, shopId);
};

export async function getActiveShopsCount() {
  const { count } = await supabase.from('shops').select('*', { count: 'exact', head: true });
  return count || 0;
}

export async function getTotalUsersCount() {
  const { count } = await supabase.auth.admin.listUsers();
  return count || 0;
}

export async function getMRR() {
  const { data: planData } = await supabase.from('plans').select('id, price').eq('is_active', true);
  const { data: shopData } = await supabase.from('shops').select('plan').eq('status', 'active');
  let mrr = 0;
  shopData?.forEach(shop => {
    const plan = planData?.find(p => p.id === shop.plan);
    if (plan) mrr += Number(plan.price);
  });
  return mrr;
}

export async function getNewShopsLast30Days() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  const { count } = await supabase.from('shops').select('*', { count: 'exact', head: true }).gte('created_at', date.toISOString());
  return count || 0;
}

export const addShop = async (shop: any) => createShop(shop);

export const addItem = async (shopId: string, type: string, item: any) => addInventoryItem({ ...item, shop_id: shopId });

export const updateItem = async (shopId: string, type: string, id: string, updates: any) => updateInventoryItem(id, updates);

export const deleteUser = async (userId: string) => {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw error;
};

export const sendPasswordResetEmail = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
};

export const subscribeToSubscriptions = (callback: (data: any[]) => void) => {
  const fetch = async () => {
    const { data, error } = await supabase.from('subscriptions').select('*').order('created_at', { ascending: false });
    if (!error && data) callback(data);
  };
  fetch();
  return subscribeChannel(
    'subs-changes',
    ['postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => fetch()]
  );
};

export const subscribeToPayments = (callback: (data: any[]) => void) => {
  const fetch = async () => {
    const { data, error } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
    if (!error && data) callback(data);
  };
  fetch();
  return subscribeChannel(
    'pays-changes',
    ['postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetch()]
  );
};

export const subscribeToWithdrawals = (callback: (data: any[]) => void) => {
  const fetch = async () => {
    const { data, error } = await supabase.from('withdrawals').select('*, shops(name, email)').order('requested_at', { ascending: false });
    if (!error && data) callback(data);
  };
  fetch();
  return subscribeChannel(
    'wd-changes',
    ['postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => fetch()]
  );
};

export const approveWithdrawal = async (id: string, adminNote?: string) => {
  const { error } = await supabase.from('withdrawals').update({ status: 'approved', admin_note: adminNote || null, processed_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
};

export const rejectWithdrawal = async (id: string, adminNote?: string) => {
  const { error } = await supabase.from('withdrawals').update({ status: 'rejected', admin_note: adminNote || null, processed_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
};

export const requestWithdrawal = async (shopId: string, amount: number, pixKey: string) => {
  const { error } = await supabase.from('withdrawals').insert({ shop_id: shopId, amount, pix_key: pixKey, status: 'pending' });
  if (error) throw error;
};