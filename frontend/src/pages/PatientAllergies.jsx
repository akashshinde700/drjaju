import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { PageHeader, Card, Button, Badge, EmptyState } from '../components/ui';

const categories = ['drug', 'food', 'substance', 'other'];
const severities = ['mild', 'moderate', 'severe'];

export default function PatientAllergies() {
  const { patientId } = useParams();
  const _navigate = useNavigate();
  const api = useApiClient();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    patient_id: patientId,
    category: 'drug',
    allergen_name: '',
    snomed_concept_id: '',
    reaction: '',
    severity: '',
    notes: '',
    is_active: 1,
  });

  const title = useMemo(() => `Allergies • Patient #${patientId}`, [patientId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/allergies/${patientId}`, { params: { active: activeOnly ? 1 : 0 } });
      const items = res.data?.data?.items || res.data?.items;
      setItems(Array.isArray(items) ? items : []);
    } catch (e) {
      addToast('Failed to load allergies', 'error');
    } finally {
      setLoading(false);
    }
  }, [patientId, activeOnly, api, addToast]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setEditId(null);
    setForm({ patient_id: patientId, category: 'drug', allergen_name: '', snomed_concept_id: '', reaction: '', severity: '', notes: '', is_active: 1 });
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (!form.allergen_name?.trim()) {
        addToast('Allergen name is required', 'error');
        return;
      }
      if (editId) {
        await api.patch(`/api/allergies/${editId}`, {
          category: form.category,
          allergen_name: form.allergen_name,
          snomed_concept_id: form.snomed_concept_id ? Number(form.snomed_concept_id) : null,
          reaction: form.reaction,
          severity: form.severity,
          notes: form.notes,
          is_active: form.is_active,
        });
        addToast('Allergy updated', 'success');
      } else {
        await api.post('/api/allergies', {
          patient_id: Number(patientId),
          category: form.category,
          allergen_name: form.allergen_name,
          snomed_concept_id: form.snomed_concept_id ? Number(form.snomed_concept_id) : null,
          reaction: form.reaction,
          severity: form.severity,
          notes: form.notes,
          is_active: form.is_active,
        });
        addToast('Allergy added', 'success');
      }
      setShowForm(false);
      resetForm();
      load();
    } catch (e) {
      addToast('Save failed', 'error');
    }
  };

  const edit = (row) => {
    setEditId(row.id);
    setForm({
      patient_id: patientId,
      category: row.category || 'drug',
      allergen_name: row.allergen_name || '',
      snomed_concept_id: row.snomed_concept_id || '',
      reaction: row.reaction || '',
      severity: row.severity || '',
      notes: row.notes || '',
      is_active: row.is_active ? 1 : 0,
    });
    setShowForm(true);
  };

  const toggleActive = async (row) => {
    try {
      await api.patch(`/api/allergies/${row.id}`, { is_active: row.is_active ? 0 : 1 });
      addToast(row.is_active ? 'Allergy deactivated' : 'Allergy activated', 'success');
      load();
    } catch (e) {
      addToast('Update failed', 'error');
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle="Recorded drug, food, and substance allergies for this patient."
        actions={(
          <>
            <label className="text-sm flex items-center gap-1.5 text-slate-600 mr-1">
              <input type="checkbox" className="rounded" checked={activeOnly} onChange={(e)=>setActiveOnly(e.target.checked)} />
              Active only
            </label>
            <Button variant="primary" size="sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Add allergy</Button>
            <Link to={`/patient-overview/${patientId}`}>
              <Button variant="secondary" size="sm">Back to patient</Button>
            </Link>
          </>
        )}
      />

      <Card padding={false}>
        <div className="grid grid-cols-6 gap-2 px-4 py-2.5 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide rounded-t-xl">
          <span>Category</span>
          <span>Allergen</span>
          <span>Reaction</span>
          <span>Severity</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No allergies recorded"
            description="Add an allergy to keep this patient's record complete."
            action={<Button variant="primary" size="sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Add allergy</Button>}
          />
        ) : (
          items.map((row) => (
            <div key={row.id} className="grid grid-cols-6 gap-2 px-4 py-3 border-t border-slate-100 text-sm items-center">
              <span className="capitalize">{row.category}</span>
              <div>
                <div className="font-medium text-slate-800">{row.allergen_name}</div>
                {row.snomed_concept_id && (
                  <div className="text-xs text-slate-500">SNOMED: {row.snomed_concept_id}</div>
                )}
              </div>
              <span>{row.reaction || '-'}</span>
              <span className="capitalize">{row.severity || '-'}</span>
              <span>
                <Badge variant={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => edit(row)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => toggleActive(row)}>
                  {row.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-xl">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{editId ? 'Edit allergy' : 'Add allergy'}</h3>
              <button className="text-slate-400 hover:text-slate-700" onClick={()=>setShowForm(false)} aria-label="Close">✕</button>
            </div>
            <form onSubmit={submit} className="p-4 space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Category *</label>
                  <select className={inputCls} value={form.category} onChange={(e)=>setForm({...form, category:e.target.value})}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Allergen name *</label>
                  <input className={inputCls} value={form.allergen_name} onChange={(e)=>setForm({...form, allergen_name:e.target.value})} placeholder="e.g., Amoxicillin" />
                </div>
                <div>
                  <label className={labelCls}>SNOMED concept ID</label>
                  <input className={inputCls} value={form.snomed_concept_id} onChange={(e)=>setForm({...form, snomed_concept_id:e.target.value})} placeholder="Optional" />
                </div>
                <div>
                  <label className={labelCls}>Reaction</label>
                  <input className={inputCls} value={form.reaction} onChange={(e)=>setForm({...form, reaction:e.target.value})} placeholder="e.g., Rash, Nausea" />
                </div>
                <div>
                  <label className={labelCls}>Severity</label>
                  <select className={inputCls} value={form.severity} onChange={(e)=>setForm({...form, severity:e.target.value})}>
                    <option value="">Select</option>
                    {severities.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Active</label>
                  <select className={inputCls} value={form.is_active} onChange={(e)=>setForm({...form, is_active:Number(e.target.value)})}>
                    <option value={1}>Yes</option>
                    <option value={0}>No</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea className={`${inputCls} min-h-[80px]`} value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} placeholder="Additional information (optional)" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary">{editId ? 'Update' : 'Save'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
