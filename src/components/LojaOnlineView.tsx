import * as React from 'react';
import { motion } from 'motion/react';
import { 
  Store, Package, Calendar, Sparkles, 
  Instagram, Phone, ChevronLeft, Send, Loader2, CheckCircle2,
  ShoppingBag, MessageCircle, X, Sparkles
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { getBarberBySlug, fetchInventoryByShopId, getShopById, addAppointment } from '../services/dbService';

// @ts-ignore
const NVIDIA_KEY = (import.meta as any).env?.VITE_NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY || '';

export default function LojaOnlineView() {
  const params = new URLSearchParams(window.location.search);
  const barberSlug = params.get('loja');

  const [barber, setBarber] = React.useState<any>(null);
  const [shop, setShop] = React.useState<any>(null);
  const [products, setProducts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const [showSchedule, setShowSchedule] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', phone: '', date: '', time: '' });
  const [scheduling, setScheduling] = React.useState(false);
  const [scheduled, setScheduled] = React.useState(false);
  const [bookedSlots, setBookedSlots] = React.useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [appointmentPix, setAppointmentPix] = React.useState<any>(null);
  const [payingAppointment, setPayingAppointment] = React.useState(false);

  const [buyProduct, setBuyProduct] = React.useState<any>(null);
  const [buyForm, setBuyForm] = React.useState({ name: '', phone: '', qty: '1' });
  const [buying, setBuying] = React.useState(false);
  const [pixData, setPixData] = React.useState<any>(null);

  const [chatOpen, setChatOpen] = React.useState(false);
  const [chatMsg, setChatMsg] = React.useState('');
  const [chatMsgs, setChatMsgs] = React.useState<{role: string; text: string}[]>([]);
  const [chatLoading, setChatLoading] = React.useState(false);

  const sendChat = async () => {
    if (!chatMsg.trim() || chatLoading) return;
    const userText = chatMsg;
    setChatMsg('');
    setChatMsgs(prev => [...prev, { role: 'user', text: userText }]);
    setChatLoading(true);
    try {
      const prompt = `Você é um assistente de sal�o amigável. Seu objetivo é ajudar a cliente a escolher um serviço de beleza e convencê-la a agendar um horário. Seja simpática e persuasiva.

profissional: ${barber?.name || 'Profissional'}
Bio: ${barber?.bio || 'Especialista em beleza'}
Instagram: ${barber?.instagram || 'N/A'}
WhatsApp: ${barber?.whatsapp || 'N/A'}

Serviços disponíveis: Corte, Manicure, Pedicure, Sobrancelha, Maquiagem, Hidratação

Responda em português brasileiro, seja convincente mas natural. Se a cliente mostrar interesse, incentive a agendar.`;

      if (!NVIDIA_KEY) {
        setChatMsgs(prev => [...prev, { role: 'assistant', text: '😅 Desculpe, o chat IA está temporariamente indisponível. Mas você pode agendar direto pelo botão "Agendar Horário" ou falar conosco pelo WhatsApp!' }]);
        setChatLoading(false);
        return;
      }

      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${NVIDIA_KEY}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct',
          messages: [
            { role: 'system', content: prompt },
            ...chatMsgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
            { role: 'user', content: userText }
          ],
          max_tokens: 300,
          temperature: 0.7,
          top_p: 0.9
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || '😊 Obrigado! Quer agendar um horário?';
      setChatMsgs(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch {
      setChatMsgs(prev => [...prev, { role: 'assistant', text: '😅 Poxa, tive um probleminha! Mas você pode agendar clicando em "Agendar Horário" ou chamar no WhatsApp!' }]);
    } finally {
      setChatLoading(false);
    }
  };

  React.useEffect(() => {
    if (!barberSlug) {
      setLoading(false);
      setError('Nenhum profissional informado.');
      return;
    }
    (async () => {
      try {
        const barberData = await getBarberBySlug(barberSlug);
        if (!barberData) {
          setError('profissional não encontrado.');
          setLoading(false);
          return;
        }
        setBarber(barberData);

        if (barberData.shop_id) {
          const [shopData, productsData] = await Promise.all([
            getShopById(barberData.shop_id),
            fetchInventoryByShopId(barberData.shop_id)
          ]);
          if (shopData) setShop(shopData);
          setProducts(productsData.filter((p: any) => (p.quantity || 0) > 0));
        }
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar loja.');
      } finally {
        setLoading(false);
      }
    })();
  }, [barberSlug]);

  const today = new Date().toISOString().split('T')[0];

  const SLOT_DURATION = 45;
  const START_HOUR = 8;
  const END_HOUR = 19;

  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const formatSlot = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const generateSlots = () => {
    const slots: string[] = [];
    let current = START_HOUR * 60;
    const end = END_HOUR * 60;
    while (current + SLOT_DURATION <= end) {
      slots.push(formatSlot(current));
      current += SLOT_DURATION;
    }
    return slots;
  };

  const isSlotBlocked = (slot: string, booked: string[]) => {
    const slotStart = toMinutes(slot);
    const slotEnd = slotStart + SLOT_DURATION;
    for (const bookedTime of booked) {
      const bStart = toMinutes(bookedTime);
      const bEnd = bStart + SLOT_DURATION;
      if (slotStart < bEnd && slotEnd > bStart) return true;
    }
    return false;
  };

  React.useEffect(() => {
    if (!form.date || !barber?.id) {
      setBookedSlots([]);
      return;
    }
    setSlotsLoading(true);
    setForm(prev => ({ ...prev, time: '' }));
    (async () => {
      try {
        const startOfDay = `${form.date}T00:00:00`;
        const endOfDay = `${form.date}T23:59:59`;
        const { data } = await supabase
          .from('appointments')
          .select('date')
          .eq('professional_id', barber.id)
          .in('status', ['pending', 'confirmed'])
          .gte('date', startOfDay)
          .lte('date', endOfDay);
        const booked = (data || []).map((a: any) => {
          const d = new Date(a.date);
          return formatSlot(d.getHours() * 60 + d.getMinutes());
        });
        setBookedSlots(booked);
      } catch (e) {
        console.error('Error fetching slots:', e);
      } finally {
        setSlotsLoading(false);
      }
    })();
  }, [form.date, barber?.id]);

  const allSlots = generateSlots();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const availableSlots = allSlots.filter(s => {
    if (bookedSlots.includes(s)) return false;
    if (isSlotBlocked(s, bookedSlots)) return false;
    if (form.date === today && toMinutes(s) <= currentMinutes) return false;
    return true;
  });

  const handleSchedule = async () => {
    if (!form.name || !form.phone || !form.date || !form.time) return;
    setScheduling(true);
    setAppointmentPix(null);
    try {
      const appt = await addAppointment({
        shop_id: barber?.shop_id,
        professional_id: barber?.id || null,
        user_name: form.name,
        user_phone: form.phone,
        service_name: 'Serviço de Beleza',
        service_price: 0,
        date: `${form.date}T${form.time}:00`,
        status: 'pending',
        notes: 'Agendamento via Loja Online',
      });
      setAppointmentPix({ id: appt?.id, name: form.name, phone: form.phone, date: form.date, time: form.time });
      setScheduled(true);
    } catch (err: any) {
      alert('Erro ao agendar: ' + (err?.message || ''));
    } finally {
      setScheduling(false);
    }
  };

  const handlePayAppointment = async () => {
    if (!appointmentPix) return;
    setPayingAppointment(true);
    try {
      const res = await fetch('/api/buy-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: appointmentPix.name,
          customerPhone: appointmentPix.phone,
          productName: `Serviço de Beleza - ${appointmentPix.date} ${appointmentPix.time}`,
          productPrice: 35,
          quantity: 1,
          shopId: barber?.shop_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || 'Erro ao gerar PIX'); return; }
      setPixData(data);
    } catch (err: any) {
      alert('Erro: ' + (err?.message || ''));
    } finally {
      setPayingAppointment(false);
    }
  };

  const handleBuy = async () => {
    if (!buyForm.name || !buyForm.phone || !buyProduct) return;
    setBuying(true);
    setPixData(null);
    try {
      const res = await fetch('/api/buy-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: buyForm.name,
          customerPhone: buyForm.phone,
          productName: buyProduct.name,
          productPrice: buyProduct.price,
          quantity: parseInt(buyForm.qty) || 1,
          shopId: barber?.shop_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Erro ao processar compra');
        return;
      }
      setPixData(data);
    } catch (err: any) {
      alert('Erro ao comprar: ' + (err?.message || ''));
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D489B0] animate-spin" />
      </div>
    );
  }

  if (error || !barber) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <Store className="w-16 h-16 text-[#D489B0] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Loja não encontrada</h2>
          <p className="text-[#888] text-sm mb-6">{error || 'profissional não encontrado'}</p>
          <a href="/" className="inline-block px-6 py-3 bg-[#D489B0] text-black rounded-xl font-bold hover:bg-[#D489B0] transition-colors">
            Voltar
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Top Bar */}
      <div className="bg-[#141414] border-b border-[#2A2A2A] px-4 py-3 flex items-center gap-3">
        <a href="/" className="text-[#888] hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </a>
        <div className="flex-1">
          <p className="text-[10px] text-[#888] uppercase tracking-wider font-bold">Loja Online</p>
          <p className="text-sm font-bold text-[#D489B0]">{shop?.name || 'KERNEL BEAUTY SHOPPER'}</p>
        </div>
        {barber.whatsapp && (
          <a href={`https://wa.me/${barber.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
             className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500 hover:bg-green-500/20 transition-all">
            <Phone className="w-4 h-4" />
          </a>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Barber Profile */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1A1A1A] to-[#141414] border border-[#2A2A2A] rounded-3xl p-8 flex flex-col md:flex-row items-center gap-6">
          {barber.image_url ? (
            <img src={barber.image_url} className="w-24 h-24 rounded-full object-cover border-2 border-[#D489B0]/30 shrink-0" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#D489B0]/10 border-2 border-[#D489B0]/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-10 h-10 text-[#D489B0]" />
            </div>
          )}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-2xl font-bold text-white">{barber.name}</h1>
            {barber.bio && <p className="text-[#888] text-sm mt-1">{barber.bio}</p>}
            <div className="flex gap-3 mt-3 justify-center md:justify-start">
              {barber.instagram && (
                <a href={`https://instagram.com/${barber.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#888] hover:text-pink-500 transition-colors">
                  <Instagram className="w-3.5 h-3.5" /> {barber.instagram}
                </a>
              )}
              {barber.whatsapp && (
                <a href={`https://wa.me/${barber.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#888] hover:text-green-500 transition-colors">
                  <Phone className="w-3.5 h-3.5" /> WhatsApp
                </a>
              )}
            </div>
          </div>
          <button onClick={() => { setShowSchedule(true); setForm({ name: '', phone: '', date: '', time: '' }); }}
            className="w-full md:w-auto bg-[#D489B0] text-[#0A0A0A] px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#F0B4D0] transition-all shadow-lg shadow-[#D489B0]/20 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Agendar Horário
          </button>
        </motion.div>

        {/* Haircut Styles Gallery */}
        {(() => {
          let styles: string[] = [];
          try { styles = JSON.parse(barber.haircut_styles || '[]'); } catch {}
          if (styles.length === 0) return null;
          return (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-[#D489B0]" />
                <h2 className="text-lg font-bold text-white">Portfólio de Serviços</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {styles.map((img, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                    className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-2 hover:border-[#D489B0]/30 transition-all group cursor-pointer"
                    onClick={() => window.open(img, '_blank')}>
                    <img src={img} className="w-full aspect-square object-cover rounded-xl" />
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Products */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-[#D489B0]" />
            <h2 className="text-lg font-bold text-white">Produtos Disponíveis</h2>
          </div>

          {products.length === 0 ? (
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-8 text-center">
              <Package className="w-12 h-12 text-[#333] mx-auto mb-3" />
              <p className="text-[#888] text-sm">Nenhum produto disponível no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product, i) => (
                <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-5 hover:border-[#D489B0]/30 transition-all group flex flex-col">
                  {product.image_url ? (
                    <img src={product.image_url} className="w-full h-32 object-cover rounded-xl mb-3 border border-[#2A2A2A]" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-[#D489B0]/10 flex items-center justify-center mb-3 group-hover:bg-[#D489B0]/20 transition-all">
                      <Package className="w-6 h-6 text-[#D489B0]" />
                    </div>
                  )}
                  <h3 className="font-bold text-sm text-white mb-1">{product.name}</h3>
                  {product.category && (
                    <p className="text-[10px] text-[#555] uppercase tracking-wider font-bold mb-2">{product.category}</p>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[#D489B0] font-bold text-lg">R$ {Number(product.price || 0).toFixed(2)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      (product.quantity || 0) <= 2 ? 'bg-red-500/10 text-red-500' : 
                      (product.quantity || 0) <= 5 ? 'bg-orange-500/10 text-orange-500' : 
                      'bg-green-500/10 text-green-500'
                    }`}>
                      {product.quantity} un
                    </span>
                  </div>
                  <button onClick={() => { setBuyProduct(product); setBuyForm({ name: '', phone: '', qty: '1' }); setPixData(null); }}
                    className="mt-auto w-full py-2.5 bg-[#D489B0] text-[#0A0A0A] rounded-xl text-xs font-bold hover:bg-[#F0B4D0] transition-all flex items-center justify-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" /> Comprar
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Services */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-[#D489B0]" />
            <h2 className="text-lg font-bold text-white">Serviços</h2>
          </div>
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-[#D489B0]" />
                <div>
<p className="font-bold text-sm text-white">Serviço de Beleza</p>
                    <p className="text-[10px] text-[#888]">45 min • Serviço profissional</p>
                </div>
              </div>
              <button onClick={() => { setShowSchedule(true); setForm({ name: '', phone: '', date: '', time: '' }); }}
                className="bg-[#D489B0]/10 text-[#D489B0] border border-[#D489B0]/20 px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#D489B0]/20 transition-all">
                Agendar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Buy Modal */}
      {buyProduct && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-3xl p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            
            {pixData ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Pedido Gerado!</h2>
                <p className="text-[#888] text-sm mb-4">Pague o PIX abaixo para confirmar a compra.</p>
                <p className="text-lg font-bold text-[#D489B0] mb-6">
                  R$ {Number(pixData.value || 0).toFixed(2)}
                </p>
                {pixData.pix?.encodedImage && (
                  <img src={pixData.pix.encodedImage} alt="PIX QR Code" 
                    className="w-56 h-56 mx-auto mb-4 rounded-2xl bg-white p-2" />
                )}
                {pixData.pix?.payload && (
                  <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-3 mb-6">
                    <p className="text-[10px] text-[#888] uppercase font-bold mb-1">Código PIX</p>
                    <p className="text-xs text-white break-all font-mono">{pixData.pix.payload}</p>
                    <button onClick={() => navigator.clipboard.writeText(pixData.pix.payload)}
                      className="mt-2 text-[#D489B0] text-xs font-bold hover:underline">
                      Copiar código
                    </button>
                  </div>
                )}
                <button onClick={() => { setBuyProduct(null); setPixData(null); }}
                  className="px-6 py-3 bg-[#D489B0] text-black rounded-xl font-bold hover:bg-[#F0B4D0] transition-colors">
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-[#D489B0] mb-2">Comprar {buyProduct.name}</h2>
                <p className="text-sm text-[#D489B0] font-bold mb-6">
                  R$ {Number(buyProduct.price || 0).toFixed(2)} / un
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-[#888] text-xs font-bold uppercase tracking-wider mb-2 block">Seu Nome</label>
                    <input type="text" placeholder="Seu nome completo" value={buyForm.name}
                      onChange={e => setBuyForm({...buyForm, name: e.target.value})}
                      className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D489B0]" />
                  </div>
                  <div>
                    <label className="text-[#888] text-xs font-bold uppercase tracking-wider mb-2 block">WhatsApp</label>
                    <input type="tel" placeholder="(11) 99999-9999" value={buyForm.phone}
                      onChange={e => setBuyForm({...buyForm, phone: e.target.value})}
                      className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D489B0]" />
                  </div>
                  <div>
                    <label className="text-[#888] text-xs font-bold uppercase tracking-wider mb-2 block">Quantidade</label>
                    <input type="number" min="1" max={buyProduct.quantity} value={buyForm.qty}
                      onChange={e => setBuyForm({...buyForm, qty: e.target.value})}
                      className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#D489B0]" />
                  </div>
                  <div className="bg-[#141414] rounded-xl p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#888]">Subtotal</span>
                      <span className="text-white font-bold">
                        R$ {((Number(buyProduct.price) || 0) * (parseInt(buyForm.qty) || 1)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button onClick={() => setBuyProduct(null)}
                    className="flex-1 py-3 rounded-xl border border-[#2A2A2A] text-[#888] font-bold text-sm hover:bg-[#2A2A2A] transition-all">
                    Cancelar
                  </button>
                  <button onClick={handleBuy} disabled={buying || !buyForm.name || !buyForm.phone}
                    className="flex-1 py-3 rounded-xl bg-[#D489B0] text-[#0A0A0A] font-bold text-sm hover:bg-[#F0B4D0] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShoppingBag className="w-4 h-4" /> Comprar</>}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Scheduling Modal */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-3xl p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            
            {scheduled ? (
              <div className="text-center py-6">
                {pixData ? (
                  <>
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">PIX Gerado!</h2>
                    <p className="text-[#888] text-sm mb-4">Pague o PIX abaixo para garantir seu horário.</p>
                    <p className="text-lg font-bold text-[#D489B0] mb-6">R$ 35,00</p>
                    {pixData.pix?.encodedImage && (
                      <img src={pixData.pix.encodedImage} alt="PIX QR Code"
                        className="w-56 h-56 mx-auto mb-4 rounded-2xl bg-white p-2" />
                    )}
                    {pixData.pix?.payload && (
                      <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-3 mb-6">
                        <p className="text-[10px] text-[#888] uppercase font-bold mb-1">Código PIX</p>
                        <p className="text-xs text-white break-all font-mono">{pixData.pix.payload}</p>
                        <button onClick={() => navigator.clipboard.writeText(pixData.pix.payload)}
                          className="mt-2 text-[#D489B0] text-xs font-bold hover:underline">Copiar código</button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Agendamento Confirmado!</h2>
                    <p className="text-[#888] text-sm mb-2">
                      {form.date} às {form.time} com {barber?.name}
                    </p>
                    <p className="text-[#888] text-xs mb-6">Você pode pagar via PIX para garantir sua vaga.</p>
                    <button onClick={handlePayAppointment} disabled={payingAppointment}
                      className="w-full mb-3 py-3 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                      {payingAppointment ? <Loader2 className="w-4 h-4 animate-spin" /> : '💳 Pagar com PIX (R$ 35,00)'}
                    </button>
                  </>
                )}
                <button onClick={() => { setShowSchedule(false); setScheduled(false); setAppointmentPix(null); setPixData(null); setForm({ name: '', phone: '', date: '', time: '' }); }}
                  className="px-6 py-3 bg-[#D489B0] text-black rounded-xl font-bold hover:bg-[#F0B4D0] transition-colors">
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-[#D489B0] mb-2">Agendar com {barber?.name}</h2>
                <p className="text-[#888] text-sm mb-6">Preencha seus dados e escolha o melhor horário.</p>

                <div className="space-y-4">
                  <div>
                    <label className="text-[#888] text-xs font-bold uppercase tracking-wider mb-2 block">Seu Nome</label>
                    <input type="text" placeholder="Seu nome completo" value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                      className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D489B0]" />
                  </div>
                  <div>
                    <label className="text-[#888] text-xs font-bold uppercase tracking-wider mb-2 block">WhatsApp</label>
                    <input type="tel" placeholder="(11) 99999-9999" value={form.phone}
                      onChange={e => setForm({...form, phone: e.target.value})}
                      className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D489B0]" />
                  </div>
                  <div>
                    <label className="text-[#888] text-xs font-bold uppercase tracking-wider mb-2 block">Data</label>
                    <input type="date" min={today} value={form.date}
                      onChange={e => setForm({...form, date: e.target.value})}
                      className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#D489B0]" />
                  </div>
                  {form.date && (
                    <div>
                      <label className="text-[#888] text-xs font-bold uppercase tracking-wider mb-2 block">
                        Horários Disponíveis {slotsLoading && <Loader2 className="w-3 h-3 animate-spin inline" />}
                      </label>
                      {slotsLoading ? (
                        <div className="h-20 flex items-center justify-center text-[#555] text-xs">Carregando...</div>
                      ) : availableSlots.length === 0 ? (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                          <p className="text-red-500 text-xs font-bold">Nenhum horário disponível nesta data.</p>
                          <p className="text-[#888] text-[10px] mt-1">Tente outra data.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {availableSlots.map(slot => (
                            <button key={slot}
                              onClick={() => setForm({...form, time: slot})}
                              className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                                form.time === slot
                                  ? 'bg-[#D489B0] text-black shadow-lg shadow-[#D489B0]/20'
                                  : 'bg-[#141414] border border-[#2A2A2A] text-white hover:border-[#D489B0]/50 hover:bg-[#1A1A1A]'
                              }`}>
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-8">
                  <button onClick={() => setShowSchedule(false)}
                    className="flex-1 py-3 rounded-xl border border-[#2A2A2A] text-[#888] font-bold text-sm hover:bg-[#2A2A2A] transition-all">
                    Cancelar
                  </button>
                  <button onClick={handleSchedule} disabled={scheduling}
                    className="flex-1 py-3 rounded-xl bg-[#D489B0] text-[#0A0A0A] font-bold text-sm hover:bg-[#F0B4D0] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Agendar</>}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* AI Chat Widget */}
      {chatOpen && (
        <div className="fixed bottom-24 right-4 z-50 w-80 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#D489B0] to-[#F0B4D0] p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#0A0A0A]" />
              <div>
                <p className="text-sm font-bold text-[#0A0A0A]">Assistente</p>
                <p className="text-[10px] text-[#0A0A0A]/70">Tire suas dúvidas!</p>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-all">
              <X className="w-4 h-4 text-[#0A0A0A]" />
            </button>
          </div>
          <div className="h-72 overflow-y-auto p-4 space-y-3">
            {chatMsgs.length === 0 && (
              <div className="text-center text-[#555] text-xs py-8">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-[#D489B0]" />
                <p className="font-bold text-sm text-white mb-1">👋 Quer um serviço novo?</p>
                <p>Pergunte sobre estilos, valores ou agende agora!</p>
              </div>
            )}
            {chatMsgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${
                  m.role === 'user' 
                    ? 'bg-[#D489B0] text-black rounded-br-md' 
                    : 'bg-[#141414] border border-[#2A2A2A] text-white rounded-bl-md'
                }`}>{m.text}</div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl rounded-bl-md p-3">
                  <Loader2 className="w-4 h-4 animate-spin text-[#D489B0]" />
                </div>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-[#2A2A2A] flex gap-2">
            <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-3 py-2 text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D489B0]" />
            <button onClick={sendChat} disabled={chatLoading || !chatMsg.trim()}
              className="w-9 h-9 rounded-xl bg-[#D489B0] flex items-center justify-center disabled:opacity-50 hover:bg-[#F0B4D0] transition-all shrink-0">
              <Send className="w-4 h-4 text-[#0A0A0A]" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Chat Button */}
      <button onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-[#D489B0] to-[#F0B4D0] shadow-lg shadow-[#D489B0]/40 flex items-center justify-center hover:scale-110 transition-all">
        {chatOpen ? <X className="w-6 h-6 text-[#0A0A0A]" /> : <MessageCircle className="w-6 h-6 text-[#0A0A0A]" />}
      </button>
    </div>
  );
}
