import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, X, Truck, Clock, CheckCircle, Package, AlertCircle, Camera } from 'lucide-react';
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
  
  // Form state
  const [formData, setFormData] = useState({
    product_name: '',
    quantity: '',
    buyer_id: '',
    notes: '',
    image_url: ''
  });
  const [materialRows, setMaterialRows] = useState([{ product_id: '', qty: '' }]);
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

  const resetForm = () => {
    setFormData({ product_name: '', quantity: '', buyer_id: '', notes: '', image_url: '' });
    setMaterialRows([{ product_id: '', qty: '' }]);
    setImageFile(null);
    setImagePreview(null);
  };

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

      <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
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
            {shippings.map(s => {
              const currentStatus = STATUS_LIST.find(status => status.id === s.status) || STATUS_LIST[0];
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: '700', color: 'var(--primary)' }}>#{s.id}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '150px', height: '150px', background: '#f1f5f9', borderRadius: '16px', overflow: 'hidden', flexShrink: 0 }}>
                        {s.image_url && (
                          <img 
                            src={s.image_url.includes('drive.google.com') ? `https://drive.google.com/thumbnail?id=${s.image_url.match(/[-\w]{25,}/)}&sz=w600` : s.image_url} 
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
                    <select 
                      value={s.status} 
                      onChange={(e) => handleUpdateStatus(s.id, e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    >
                      {STATUS_LIST.map(st => (
                        <option key={st.id} value={st.id}>{st.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shippings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            Chưa có vận đơn nào.
          </div>
        )}
      </div>

      {showModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-container" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}>Tạo đơn gửi sản phẩm hoàn chỉnh</h2>
            
            <form onSubmit={handleAddShipping}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 1. Hình ảnh lên đầu tiên */}
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '600' }}>Ảnh sản phẩm hoàn chỉnh</label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div
                      onClick={() => document.getElementById('shipping-image').click()}
                      style={{
                        width: '120px', height: '120px', border: '2px dashed var(--border)', borderRadius: '12px',
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
                        <Camera size={32} color="var(--text-muted)" />
                      )}
                    </div>
                    <input id="shipping-image" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '4px' }}>Chụp ảnh sản phẩm đã hoàn thiện</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hệ thống sẽ tự động nén ảnh xuống dưới 100KB.</p>
                    </div>
                  </div>
                </div>

                {/* 2. Tên sản phẩm */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '600' }}>Tên sản phẩm gửi đi</label>
                  <input required type="text" placeholder="Tên bộ quần áo, túi xách, đơn hàng..." value={formData.product_name} onChange={e => setFormData({ ...formData, product_name: e.target.value })} />
                </div>

                <div className="grid grid-2">
                  {/* 3. Số lượng gửi */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '600' }}>Số lượng sản phẩm</label>
                    <input required type="text" placeholder="VD: 100 bộ..." value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                  </div>
                  {/* 4. Khách hàng */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '600' }}>Khách hàng (Người nhận)</label>
                    <select required value={formData.buyer_id} onChange={e => setFormData({ ...formData, buyer_id: e.target.value })}>
                      <option value="">Chọn khách hàng...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* 5. Ghi chú */}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '600' }}>Ghi chú vận đơn</label>
                  <textarea rows="2" placeholder="Thông tin thêm về quy cách đóng gói, vận chuyển..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                </div>

                {/* 6. Danh sách hàng hóa (nguyên liệu) */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--primary)' }}>Nguyên liệu sử dụng (Hàng hóa)</label>
                    <button type="button" className="btn btn-primary" onClick={addMaterialRow} style={{ padding: '4px 12px', fontSize: '0.75rem' }}>
                      <Plus size={14} style={{ marginRight: '4px' }} /> Thêm hàng hóa
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {materialRows.map((row, index) => (
                      <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select 
                          style={{ flex: 2 }}
                          value={row.product_id} 
                          onChange={e => updateMaterialRow(index, 'product_id', e.target.value)}
                        >
                          <option value="">Chọn hàng hóa...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} (#{p.id})</option>)}
                        </select>
                        <input 
                          style={{ flex: 1 }}
                          type="text" 
                          placeholder="SL/ĐV" 
                          value={row.qty} 
                          onChange={e => updateMaterialRow(index, 'qty', e.target.value)}
                        />
                        <button 
                          type="button" 
                          onClick={() => removeMaterialRow(index)}
                          style={{ padding: '8px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '2.5rem', display: 'flex', gap: '10px' }}>
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
