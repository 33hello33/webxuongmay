import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, X, Truck, Clock, CheckCircle, Package, AlertCircle, Camera, Search, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { createPortal } from 'react-dom';
import { uploadImage } from '../lib/uploadHelper';


const STATUS_LIST = [
  { id: 'tiếp nhận', label: 'Tiếp nhận', color: '#64748b', bg: '#f1f5f9' },
  { id: 'soạn hàng', label: 'Soạn hàng', color: '#0ea5e9', bg: '#f0f9ff' },
  { id: 'lên chuyền', label: 'Lên chuyền', color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'kiểm hàng', label: 'Kiểm hàng', color: '#f59e0b', bg: '#fffbeb' },
  { id: 'hoàn thành', label: 'Hoàn thành', color: '#10b981', bg: '#ecfdf5' },
  { id: 'đã gửi', label: 'Đã gửi', color: '#d946ef', bg: '#fdf4ff' }
];

function Shipping() {
  const [shippings, setShippings] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterBuyer, setFilterBuyer] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    product_name: '',
    quantity: '',
    buyer_id: '',
    notes: '',
    image_url: ''
  });
  const [materialRows, setMaterialRows] = useState([{ product_id: '', qty: '' }]);
  const [materialSearch, setMaterialSearch] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    fetchShippings();
    fetchProducts();
    fetchCustomers();
  }, []);

  const fetchShippings = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*, customers(name)')
      .eq('type', 'shipping')
      .order('date', { ascending: false });
    if (data) setShippings(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('name');
    if (data) setCustomers(data);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };


  const addMaterialRow = () => {
    setMaterialRows([...materialRows, { product_id: '', qty: '' }]);
  };

  const updateMaterialRow = (index, field, value) => {
    const newRows = [...materialRows];
    newRows[index][field] = value;
    setMaterialRows(newRows);
  };

  const removeMaterialRow = (index) => {
    if (materialRows.length > 1) {
      setMaterialRows(materialRows.filter((_, i) => i !== index));
    }
  };

  const handleAddShipping = async (e) => {
    e.preventDefault();
    setLoading(true);

    let finalImageUrl = '';
    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile);
      if (uploadedUrl) finalImageUrl = uploadedUrl;
    }

    // Map material names for metadata if needed, but we store JSON
    const materialsData = materialRows.filter(m => m.product_id).map(m => {
      const product = products.find(p => p.id.toString() === m.product_id.toString());
      return {
        product_id: m.product_id,
        product_name: product?.name || '?',
        quantity: m.qty
      };
    });

    const { error } = await supabase.from('transactions').insert([
      {
        product_name: formData.product_name,
        type: 'shipping',
        quantity: formData.quantity,
        buyer_id: formData.buyer_id || null,
        notes: formData.notes,
        image_url: finalImageUrl,
        materials: materialsData,
        status: 'tiếp nhận',
        date: new Date().toISOString()
      }
    ]);

    if (!error) {
      setShowModal(false);
      resetForm();
      fetchShippings();
    } else {
      alert("Lỗi: " + error.message);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (id, newStatus) => {
    const { error } = await supabase
      .from('transactions')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      fetchShippings();
    } else {
      alert("Lỗi: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa vận đơn này?')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (!error) fetchShippings();
    }
  };

  const resetForm = () => {
    setFormData({ product_name: '', quantity: '', buyer_id: '', notes: '', image_url: '' });
    setMaterialRows([{ product_id: '', qty: '' }]);
    setMaterialSearch('');
    setImageFile(null);
    setImagePreview(null);
  };

  const filteredShippings = shippings.filter(s => {
    // 1. Filter by literal date
    if (filterDate) {
      if (format(new Date(s.date), 'yyyy-MM-dd') !== filterDate) return false;
    }

    // 2. Filter by Buyer (Customer)
    if (filterBuyer) {
      if (s.buyer_id?.toString() !== filterBuyer) return false;
    }

    // 3. Robust Search Query
    if (!searchQuery.trim()) return true;
    const searchTerms = searchQuery.toLowerCase().split(/[\s,]+/).filter(t => t.length > 0);
    
    const customerName = (s.customers?.name || '').toLowerCase();
    const productName = (s.product_name || '').toLowerCase();
    const notes = (s.notes || '').toLowerCase();
    const materialNames = (s.materials || []).map(m => m.product_name.toLowerCase());
    const materialTags = (s.materials || []).flatMap(m => {
      const prod = products.find(p => p.id.toString() === m.product_id.toString());
      return prod ? (prod.tags || []) : [];
    }).map(t => t.toLowerCase());

    return searchTerms.every(term => 
      customerName.includes(term) ||
      productName.includes(term) ||
      notes.includes(term) ||
      materialNames.some(mn => mn.includes(term)) ||
      materialTags.some(mt => mt.includes(term))
    );
  });

  return (
    <div className="fade-in">
      <div className="shipping-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Quản lý hàng gửi</h1>
          <p style={{ color: 'var(--text-muted)' }}>Theo dõi trạng thái các sản phẩm hoàn chỉnh đã gửi</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={18} style={{ marginRight: '8px' }} /> Tạo đơn gửi mới
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div className="search-box card" style={{ flex: '1 1 350px', maxWidth: '500px', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <Search size={20} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Tìm theo khách, sản phẩm, vật liệu, tag..."
            style={{ border: 'none', background: 'transparent', padding: '0.5rem 0', width: '100%', outline: 'none' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && <X size={16} onClick={() => setSearchQuery('')} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} />}
        </div>
        
        <div style={{ display: 'flex', gap: '10px', flex: '1 1 300px', maxWidth: '450px' }}>
          <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, margin: 0, height: '45px' }}>
            <select
              value={filterBuyer}
              onChange={e => setFilterBuyer(e.target.value)}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none', cursor: 'pointer', width: '100%', padding: 0 }}
            >
              <option value="">Khách hàng</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {filterBuyer && <X size={16} onClick={() => setFilterBuyer('')} style={{ cursor: 'pointer', color: '#ef4444' }} />}
          </div>
          
          <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, margin: 0, height: '45px' }}>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none', width: '100%', padding: 0 }}
            />
            {filterDate && <X size={16} onClick={() => setFilterDate('')} style={{ cursor: 'pointer', color: '#ef4444' }} />}
          </div>
        </div>
      </div>

      <div className="desktop-only card" style={{ padding: '0', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>ID</th>
              <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Sản phẩm / Vận đơn</th>
              <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Nguyên liệu sử dụng</th>
              <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Số lượng gửi</th>
              <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Khách hàng</th>
              <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Trạng thái</th>
              <th style={{ textAlign: 'right', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredShippings.map(s => {
              const currentStatus = STATUS_LIST.find(status => status.id === s.status) || STATUS_LIST[0];
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: '700', color: 'var(--primary)' }}>#{s.id}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '100px', height: '100px', background: '#f1f5f9', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}>
                        {s.image_url && (
                          <img 
                            src={s.image_url} 
                            alt="" 
                            referrerPolicy="no-referrer"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700' }}>{s.product_name || 'Hàng không tên'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {format(new Date(s.date), 'dd/MM HH:mm', { locale: vi })}
                        </div>
                        {s.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>{s.notes}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(s.materials || []).map((m, idx) => (
                        <div key={idx} style={{ background: '#f8fafc', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontWeight: '600' }}>{m.product_name}</span>: {m.quantity}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '800', color: 'var(--primary)' }}>{s.quantity}</td>
                  <td style={{ padding: '1rem' }}>{s.customers?.name || '—'}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span className="badge" style={{ background: currentStatus.bg, color: currentStatus.color, border: `1px solid ${currentStatus.color}40` }}>
                      {currentStatus.label}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      <select 
                        value={s.status} 
                        onChange={(e) => handleUpdateStatus(s.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                      >
                        {STATUS_LIST.map(st => (
                          <option key={st.id} value={st.id}>{st.label}</option>
                        ))}
                      </select>
                      <button 
                        onClick={() => handleDelete(s.id)}
                        className="btn"
                        style={{ padding: '4px 8px', background: '#fff1f2', color: '#e11d48', border: '1px solid #fee2e2', fontSize: '0.75rem' }}
                      >
                        <Trash2 size={14} /> Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredShippings.map(s => {
          const currentStatus = STATUS_LIST.find(status => status.id === s.status) || STATUS_LIST[0];
          return (
            <div key={s.id} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ width: '70px', height: '70px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                  {s.image_url && (
                    <img 
                      src={s.image_url} 
                      alt="" 
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>{s.product_name || 'Hàng không tên'}</div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)' }}>#{s.id}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {format(new Date(s.date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Số lượng</div>
                  <div style={{ fontWeight: '700', fontSize: '1.125rem' }}>{s.quantity}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Khách hàng</div>
                  <div style={{ fontWeight: '600' }}>{s.customers?.name || '—'}</div>
                </div>
              </div>

              {s.materials?.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Nguyên liệu sử dụng:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {s.materials.map((m, idx) => (
                      <span key={idx} style={{ background: '#fff', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                        {m.product_name}: <span style={{ fontWeight: 600 }}>{m.quantity}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {s.notes && (
                <div style={{ background: '#fffbeb', padding: '8px', borderRadius: '6px', fontSize: '0.8125rem', border: '1px solid #fef3c7' }}>
                  <span style={{ fontWeight: 600, color: '#92400e' }}>Ghi chú:</span> {s.notes}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                <span className="badge" style={{ background: currentStatus.bg, color: currentStatus.color, border: `1px solid ${currentStatus.color}40`, margin: 0 }}>
                  {currentStatus.label}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select 
                    style={{ fontSize: '0.8125rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'white' }}
                    value={s.status} 
                    onChange={(e) => handleUpdateStatus(s.id, e.target.value)}
                  >
                    {STATUS_LIST.map(st => (
                      <option key={st.id} value={st.id}>{st.label}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => handleDelete(s.id)}
                    style={{ background: '#fff1f2', border: '1px solid #fee2e2', color: '#e11d48', padding: '4px 10px', borderRadius: '6px' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredShippings.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          {searchQuery ? 'Không tìm thấy vận đơn nào phù hợp với tag này.' : 'Chưa có vận đơn nào.'}
        </div>
      )}

      {showModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}>Tạo đơn gửi sản phẩm hoàn chỉnh</h2>
            
            <form onSubmit={handleAddShipping}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                {/* Cột trái: Hình ảnh */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label>Ảnh sản phẩm</label>
                  <div
                    onClick={() => document.getElementById('shipping-image').click()}
                    style={{
                      width: '140px', height: '140px', border: '2px dashed var(--border)', borderRadius: '12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#f8fafc', overflow: 'hidden'
                    }}
                  >
                    {imagePreview ? (
                      <img 
                        src={imagePreview} 
                        alt="" 
                        referrerPolicy="no-referrer"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <Camera size={24} color="var(--text-muted)" style={{ marginBottom: '4px' }} />
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Chụp ảnh</div>
                      </div>
                    )}
                  </div>
                  <input id="shipping-image" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>Tự động nén về &lt; 100KB</p>
                </div>

                {/* Cột phải: Thông tin cơ bản */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label>Tên sản phẩm gửi đi</label>
                    <input required type="text" placeholder="Tên bộ quần áo, đơn hàng..." value={formData.product_name} onChange={e => setFormData({ ...formData, product_name: e.target.value })} />
                  </div>

                  <div className="grid grid-2" style={{ gap: '10px' }}>
                    <div>
                      <label>Số lượng gửi</label>
                      <input required type="text" placeholder="VD: 100 bộ..." value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                    </div>
                    <div>
                      <label>Khách hàng (Người nhận)</label>
                      <select required value={formData.buyer_id} onChange={e => setFormData({ ...formData, buyer_id: e.target.value })}>
                        <option value="">Chọn khách hàng...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label>Ghi chú vận đơn</label>
                    <textarea rows="2" placeholder="Quy cách đóng gói, vận chuyển..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ height: '60px' }} />
                  </div>
                </div>
              </div>

              {/* Danh sách hàng hóa (nguyên liệu) */}
              <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--primary)', margin: 0 }}>Nguyên liệu sử dụng (Hàng hóa)</label>
                  <button type="button" className="btn btn-primary" onClick={addMaterialRow} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                    <Plus size={12} style={{ marginRight: '4px' }} /> Thêm hàng
                  </button>
                </div>

                <div className="search-box" style={{ marginBottom: '0.75rem', background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input 
                    type="text" 
                    placeholder="Tìm nhanh hàng theo tag..." 
                    value={materialSearch}
                    onChange={e => setMaterialSearch(e.target.value)}
                    style={{ border: 'none', background: 'transparent', padding: '4px 0', width: '100%', fontSize: '0.8125rem', outline: 'none' }}
                  />
                  {materialSearch && (
                    <button type="button" onClick={() => setMaterialSearch('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                  {materialRows.map((row, index) => (
                    <div key={index} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <select 
                        style={{ flex: 2, padding: '4px 8px' }}
                        value={row.product_id} 
                        onChange={e => updateMaterialRow(index, 'product_id', e.target.value)}
                      >
                        <option value="">Chọn hàng hóa...</option>
                        {products
                          .filter(p => {
                            if (!materialSearch.trim()) return true;
                            if (row.product_id?.toString() === p.id.toString()) return true;
                            
                            const searchTerms = materialSearch.toLowerCase().split(/[\s,]+/).filter(t => t.length > 0);
                            const pTags = (p.tags || []).map(t => t.toLowerCase());
                            
                            return searchTerms.every(term => 
                              pTags.some(tag => tag.includes(term))
                            );
                          })
                          .map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} (#{p.id}) {p.tags?.length > 0 ? `[${p.tags.join(', ')}]` : ''}
                            </option>
                          ))
                        }
                      </select>
                      <input 
                        style={{ flex: 1, padding: '4px 8px' }}
                        type="text" 
                        placeholder="SL/ĐV" 
                        value={row.qty} 
                        onChange={e => updateMaterialRow(index, 'qty', e.target.value)}
                      />
                      <button 
                        type="button" 
                        onClick={() => removeMaterialRow(index)}
                        style={{ padding: '4px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '10px' }}>
                <button type="button" className="btn" style={{ flex: 1, background: '#f1f5f9' }} onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>{loading ? 'Đang xử lý...' : 'Xác nhận tạo vận đơn'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Shipping;
