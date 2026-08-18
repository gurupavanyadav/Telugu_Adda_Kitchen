import { useEffect, useState } from 'react';
import { supabase, type Address as AddressType } from '@/lib/supabase';
import { useAuth } from '@/features/auth/context/auth';
import { navigate } from '@/lib/router';
import { Loader2, User, Mail, MapPin, Plus, Pencil, Trash2, Check, ArrowLeft, X } from 'lucide-react';

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const [addresses, setAddresses] = useState<AddressType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ label: '', hostel_name: '', room_number: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/signin'); return; }
    loadAddresses();
  }, [user]);

  async function loadAddresses() {
    const { data } = await supabase.from('addresses').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    if (data) setAddresses(data);
    setLoading(false);
  }

  const resetForm = () => {
    setFormData({ label: '', hostel_name: '', room_number: '', phone: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (addr: AddressType) => {
    setFormData({ label: addr.label, hostel_name: addr.hostel_name, room_number: addr.room_number, phone: addr.phone });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    if (editingId) {
      await supabase.from('addresses').update(formData).eq('id', editingId).eq('user_id', user.id);
    } else {
      await supabase.from('addresses').insert({ ...formData, user_id: user.id });
    }
    setSaving(false);
    resetForm();
    loadAddresses();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('addresses').delete().eq('id', id).eq('user_id', user!.id);
    loadAddresses();
  };

  if (!user) return null;
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;

  return (
    <div className="animate-fade-in container-app py-8 max-w-3xl">
      <h1 className="font-serif text-3xl font-bold text-charcoal-900 mb-8">My Profile</h1>

      {/* Account Info */}
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <User className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-charcoal-800 font-semibold">
              <Mail className="h-4 w-4 text-charcoal-400" />{user.email}
            </div>
            <p className="text-sm text-charcoal-500 mt-1">Member since {new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
          </div>
          <button onClick={signOut} className="btn-outline">Sign Out</button>
        </div>
      </div>

      {/* Saved Addresses */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-semibold text-charcoal-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary-700" />Saved Addresses
          </h2>
          {!showForm && (
            <button onClick={() => { setEditingId(null); setFormData({ label: '', hostel_name: '', room_number: '', phone: '' }); setShowForm(true); }} className="btn-ghost text-primary-700">
              <Plus className="h-4 w-4" />Add Address
            </button>
          )}
        </div>

        {showForm && (
          <div className="card p-5 mb-4 border-2 border-primary-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-charcoal-800">{editingId ? 'Edit Address' : 'New Address'}</h3>
              <button onClick={resetForm} className="flex h-8 w-8 items-center justify-center rounded-lg text-charcoal-500 hover:bg-cream-200"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Label (e.g. Home, Hostel A)</label>
                <input value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} placeholder="Home" className="input" />
              </div>
              <div>
                <label className="label">Hostel Name</label>
                <input value={formData.hostel_name} onChange={(e) => setFormData({ ...formData, hostel_name: e.target.value })} placeholder="Hostel Block A" className="input" />
              </div>
              <div>
                <label className="label">Room Number</label>
                <input value={formData.room_number} onChange={(e) => setFormData({ ...formData, room_number: e.target.value })} placeholder="204" className="input" />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="9876543210" className="input" />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !formData.label || !formData.hostel_name || !formData.room_number || !formData.phone} className="btn-primary mt-4">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" />{editingId ? 'Update' : 'Save'} Address</>}
            </button>
          </div>
        )}

        {addresses.length === 0 && !showForm ? (
          <div className="card p-8 text-center">
            <MapPin className="h-10 w-10 text-charcoal-300 mx-auto mb-3" />
            <p className="text-charcoal-600 text-sm mb-4">No saved addresses yet. Add one to speed up checkout.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="h-4 w-4" />Add Address</button>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <div key={addr.id} className="card p-4 flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700 shrink-0"><MapPin className="h-5 w-5" /></div>
                <div className="flex-1">
                  <p className="font-semibold text-charcoal-800">{addr.label}</p>
                  <p className="text-sm text-charcoal-500">{addr.hostel_name}, Room {addr.room_number}</p>
                  <p className="text-xs text-charcoal-400">{addr.phone}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(addr)} className="flex h-8 w-8 items-center justify-center rounded-lg text-charcoal-500 hover:bg-cream-200"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(addr.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <button onClick={() => navigate('/orders')} className="btn-ghost"><ArrowLeft className="h-4 w-4" />View My Orders</button>
      </div>
    </div>
  );
}