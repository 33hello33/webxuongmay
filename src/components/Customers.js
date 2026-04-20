import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, User, Phone, MapPin, Edit2, Trash2, Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('name');
    if (data) setCustomers(data);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (editingCustomer) {
      const { error } = await supabase
        .from('customers')
        .update(formData)
        .eq('id', editingCustomer.id);
      if (!error) {
        setShowModal(false);
        fetchCustomers();
      }
    } else {
      const { error } = await supabase.from('customers').insert([formData]);
      if (!error) {
        setShowModal(false);
        fetchCustomers();
      }
    }
    setLoading(false);
  };

  const deleteCustomer = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa khách hàng này?')) {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (!error) fetchCustomers();
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '' });
    setEditingCustomer(null);
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Quản lý khách hàng</h1>
          <p style={{ color: 'var(--text-muted)' }}>Danh sách đối tác và khách mua hàng của xưởng.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={18} style={{ marginRight: '8px' }} /> Thêm khách hàng
        </button>
      </div>

      <div className="card" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Search size={20} color="var(--text-muted)" />
        <input 
          type="text" 
          placeholder="Tìm tên hoặc số điện thoại..." 
          style={{ border: 'none', background: 'transparent' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-3">
        {loading ? (
          <div style={{ textAlign: 'center', gridColumn: '1/4', padding: '3rem' }}>Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', gridColumn: '1/4', padding: '3rem', color: 'var(--text-muted)' }}>
            Không tìm thấy khách hàng nào.
          </div>
        ) : (
          filtered.map(c => (
            <div key={c.id} className="card fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '12px' }}>
                  <User size={24} color="var(--primary)" />
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => { setEditingCustomer(c); setFormData({name: c.name, phone: c.phone, address: c.address}); setShowModal(true); }}>
                    <Edit2 size={16} color="var(--text-muted)" />
                  </button>
                  <button className="btn" style={{ padding: '6px', background: 'transparent' }} onClick={() => deleteCustomer(c.id)}>
                    <Trash2 size={16} color="#ef4444" />
                  </button>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '4px' }}>{c.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '4px' }}>
                  <Phone size={14} /> <span>{c.phone || 'Chưa có SĐT'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  <MapPin size={14} /> <span>{c.address || 'Chưa có địa chỉ'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingCustomer ? 'Sửa thông tin' : 'Thêm khách hàng'}</h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Tên khách hàng</label><input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Số điện thoại</label><input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
              <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Địa chỉ</label><textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '10px' }}>
                <button type="button" className="btn" style={{ flex: 1, background: '#f1f5f9' }} onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>{loading ? 'Đang lưu...' : 'Lưu thông tin'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Customers;
