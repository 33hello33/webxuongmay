import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, X, Search, Calendar, User, Trash2, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { createPortal } from 'react-dom';
import { uploadImage } from '../lib/uploadHelper';

function DefectiveGoods() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form states
  const [formData, setFormData] = useState({
    returner: '',
    return_date: format(new Date(), 'yyyy-MM-dd'),
    quantity: '',
    notes: '',
    image_url: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('defective_goods')
      .select('*')
      .order('return_date', { ascending: false });
    
    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      returner: '',
      return_date: format(new Date(), 'yyyy-MM-dd'),
      quantity: '',
      notes: '',
      image_url: ''
    });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let finalImageUrl = formData.image_url;
    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile);
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
      }
    }

    const { error } = await supabase.from('defective_goods').insert([{
      ...formData,
      image_url: finalImageUrl
    }]);

    if (!error) {
      setShowModal(false);
      resetForm();
      fetchItems();
    } else {
      alert("Lỗi khi lưu: " + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mục này?')) return;
    
    const { error } = await supabase.from('defective_goods').delete().eq('id', id);
    if (!error) {
      fetchItems();
    } else {
      alert("Lỗi khi xóa: " + error.message);
    }
  };

  const filteredItems = items.filter(item => 
    item.returner.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.notes || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Quản lý hàng lỗi</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={18} style={{ marginRight: '8px' }} /> Thêm hàng lỗi
        </button>
      </div>

      <div className="search-box card" style={{ marginBottom: '1.5rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Search size={20} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Tìm theo người trả hoặc ghi chú..."
          style={{ border: 'none', background: 'transparent', width: '100%' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading && items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Đang tải dữ liệu...</div>
      ) : (
        <div className="grid grid-3">
          {filteredItems.map(item => (
            <div key={item.id} className="card fade-in" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ height: '200px', background: '#f1f5f9', position: 'relative' }}>
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt="Defective"
                    referrerPolicy="no-referrer"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                    <Camera size={48} />
                  </div>
                )}
                <button 
                  onClick={() => handleDelete(item.id)}
                  style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer', color: '#ef4444' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    <Calendar size={14} />
                    {format(new Date(item.return_date), 'dd/MM/yyyy')}
                  </div>
                  <div style={{ fontWeight: '700', color: '#ef4444' }}>SL: {item.quantity}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ background: '#f1f5f9', padding: '6px', borderRadius: '50%' }}>
                    <User size={16} color="var(--primary)" />
                  </div>
                  <span style={{ fontWeight: '600' }}>{item.returner}</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, minHeight: '3em' }}>
                  {item.notes || 'Không có ghi chú'}
                </p>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && !loading && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'white', borderRadius: '12px' }}>
              Chưa có dữ liệu hàng lỗi.
            </div>
          )}
        </div>
      )}

      {showModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-container" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}>Thêm hàng lỗi mới</h2>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label>Người trả</label>
                  <input required value={formData.returner} onChange={e => setFormData({...formData, returner: e.target.value})} placeholder="Tên khách hàng/xưởng..." />
                </div>
                <div>
                  <label>Ngày trả</label>
                  <input type="date" required value={formData.return_date} onChange={e => setFormData({...formData, return_date: e.target.value})} />
                </div>
              </div>

              <div>
                <label>Số lượng</label>
                <input required value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} placeholder="VD: 5 cái, 2m..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '1rem' }}>
                <div>
                  <label>Hình ảnh</label>
                  <div 
                    onClick={() => document.getElementById('defective-image').click()}
                    style={{ width: '100%', height: '130px', border: '2px dashed var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#f8fafc', overflow: 'hidden' }}
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Camera size={20} />
                        <div style={{ fontSize: '0.65rem' }}>Chọn ảnh</div>
                      </div>
                    )}
                  </div>
                  <input id="defective-image" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                </div>

                <div>
                  <label>Ghi chú lỗi</label>
                  <textarea 
                    rows="3" 
                    style={{ height: '130px' }}
                    value={formData.notes} 
                    onChange={e => setFormData({...formData, notes: e.target.value})} 
                    placeholder="Mô tả chi tiết lỗi..." 
                  />
                </div>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '10px' }}>
                <button type="button" className="btn" style={{ flex: 1, background: '#f1f5f9' }} onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? 'Đang lưu...' : 'Lưu thông tin'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default DefectiveGoods;
