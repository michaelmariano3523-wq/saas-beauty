import * as React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Plus, Loader2, Crown, Edit, Trash2, Search, X, Check, DollarSign } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval?: string;
  features?: string[];
  trialDays?: number;
  is_active?: boolean;
  created_at?: string;
}

export default function PlansManagement({ plans, onAddPlan, onUpdatePlan, onDeletePlan, formatCurrency }: any) {
  const [search, setSearch] = React.useState('');
  const [showModal, setShowModal] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<Plan | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<Plan>({
    id: '',
    name: '',
    price: 0,
    interval: 'monthly',
    features: [],
    trialDays: 0,
  });
  const [featureInput, setFeatureInput] = React.useState('');

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ id: '', name: '', price: 0, interval: 'monthly', features: [], trialDays: 0 });
    setFeatureInput('');
    setShowModal(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({ ...plan, features: plan.features || [] });
    setFeatureInput('');
    setShowModal(true);
  };

  const addFeature = () => {
    if (featureInput.trim() && !form.features?.includes(featureInput.trim())) {
      setForm((p) => ({ ...p, features: [...(p.features || []), featureInput.trim()] }));
      setFeatureInput('');
    }
  };

  const removeFeature = (idx: number) => {
    setForm((p) => ({ ...p, features: p.features?.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.id || !form.name) return;
    setSaving(true);
    try {
      if (editingPlan) {
        await onUpdatePlan(editingPlan.id, form);
      } else {
        await onAddPlan({ ...form, is_active: true, created_at: new Date().toISOString() });
      }
      setShowModal(false);
    } catch (err) {
      console.error('Error saving plan:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    if (!window.confirm(`Tem certeza que deseja desativar o plano "${plan.name}"?`)) return;
    try {
      await onDeletePlan(plan.id);
    } catch (err) {
      console.error('Error deleting plan:', err);
    }
  };

  const filtered = plans.filter((p: Plan) =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div key="plans" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#2A2A2A] flex items-center gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888]" />
            <input type="text" placeholder="Buscar planos..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D489B0]" />
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#D489B0] text-[#0A0A0A] text-sm font-bold rounded-xl hover:bg-[#D489B0] transition-all">
            <Plus className="w-4 h-4" />
            Novo Plano
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2A2A2A]">
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#888] p-4">Plano</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#888] p-4">Preço</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#888] p-4">Recursos</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#888] p-4">Trial</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-[#888] p-4">Status</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-widest text-[#888] p-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr><td colSpan={6} className="text-center p-8 text-[#888] text-sm">Nenhum plano cadastrado ainda.</td></tr>
              ) : (
                filtered.map((plan: Plan, i: number) => (
                  <tr key={plan.id || i} className="border-b border-[#2A2A2A]/50 hover:bg-white/5 transition-all">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#2A2A2A] flex items-center justify-center">
                          <Crown className={cn("w-5 h-5", plan.price === 0 ? "text-green-500" : "text-[#D489B0]")} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{plan.name || plan.id}</p>
                          <p className="text-xs text-[#888]">ID: {plan.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-bold text-[#D489B0]">
                        {plan.price === 0 ? 'Grátis' : formatCurrency(plan.price)}
                      </span>
                      {plan.price > 0 && <span className="text-[10px] text-[#555] ml-1 whitespace-nowrap">/{plan.interval === 'yearly' ? 'ano' : 'mês'}</span>}
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-[#eee]">{plan.features?.length || 0} recursos</span>
                    </td>
                    <td className="p-4">
                      {plan.trialDays ? (
                        <span className="text-sm text-[#eee]">{plan.trialDays} dias</span>
                      ) : (
                        <span className="text-sm text-[#555]">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md",
                        plan.is_active !== false ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                      )}>
                        {plan.is_active !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(plan)}
                          className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-[#D489B0]/10 text-[#D489B0] hover:bg-[#D489B0]/20 transition-all">
                          <Edit className="w-3 h-3 inline mr-1" />Editar
                        </button>
                        <button onClick={() => handleDelete(plan)}
                          className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all">
                          <Trash2 className="w-3 h-3 inline mr-1" />Desativar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)}>
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editingPlan ? 'Editar Plano' : 'Novo Plano'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-[#2A2A2A] flex items-center justify-center text-[#888] hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#888] uppercase tracking-widest mb-1">ID do Plano</label>
                  <input value={form.id} onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
                    placeholder="Ex: premium" disabled={!!editingPlan}
                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D489B0] disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#888] uppercase tracking-widest mb-1">Nome</label>
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Premium" className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D489B0]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#888] uppercase tracking-widest mb-1">Preço (R$)</label>
                  <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))}
                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D489B0]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#888] uppercase tracking-widest mb-1">Ciclo</label>
                  <select value={form.interval} onChange={(e) => setForm((p) => ({ ...p, interval: e.target.value }))}
                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D489B0]">
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#888] uppercase tracking-widest mb-1">Dias de Trial</label>
                <input type="number" min="0" value={form.trialDays} onChange={(e) => setForm((p) => ({ ...p, trialDays: Number(e.target.value) }))}
                  className="w-full bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D489B0]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#888] uppercase tracking-widest mb-1">Recursos</label>
                <div className="flex gap-2 mb-2">
                  <input value={featureInput} onChange={(e) => setFeatureInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                    placeholder="Ex: Agendamento ilimitado" className="flex-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D489B0]" />
                  <button onClick={addFeature} className="px-3 py-2.5 bg-[#2A2A2A] text-[#888] hover:text-white rounded-xl transition-all text-sm">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.features?.map((f, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 text-[10px] bg-[#D489B0]/10 text-[#D489B0] px-2 py-1 rounded-lg">
                      {f}
                      <button onClick={() => removeFeature(idx)} className="hover:text-white transition-all"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#2A2A2A] text-[#888] hover:text-white transition-all disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !form.id || !form.name}
                className="flex-1 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-[#D489B0] to-[#F0B4D0] text-[#0A0A0A] hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingPlan ? 'Salvar Alterações' : 'Criar Plano'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
