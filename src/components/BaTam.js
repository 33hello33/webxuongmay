import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { createPortal } from 'react-dom';
import { ShoppingBag, Calendar, X, Search, History, Clock, Package, Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { uploadImage } from '../lib/uploadHelper';

function BaTam() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  
  // States from Goods.js for management functionality
  const [showModal, setShowModal] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productHistory, setProductHistory] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    min_quantity: 5,
    tags: '',
    image_url: '',
    quantity: '',
    buyer: '',
    recorder: 'bà tám',
    is_low_stock: false
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    fetchBaTamTransactions();
  }, []);

  const fetchBaTamTransactions = async () => {
    setLoading(true);
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

    const { data, error } = await supabase
      .from('transactions')
      .select('*, products(*), customers(name)')
      .eq('notes', 'bà tám')
      .eq('type', 'export')
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transitions:', error);
    } else {
      setTransactions(data);
    }
    setLoading(false);
  };

  const fetchProductHistory = async (productId) => {
    const { data } = await supabase
      .from('transactions')
      .select('*, products(name), customers(name)')
      .eq('product_id', productId)
      .order('date', { ascending: false });
    if (data) setProductHistory(data);
  };

  const handleShowHistory = (product) => {
    setSelectedProduct(product);
    fetchProductHistory(product.id);
    setShowHistory(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      min_quantity: product.min_quantity,
      tags: (product.tags || []).join(', '),
      image_url: product.image_url || '',
      quantity: product.quantity || '',
      buyer: product.buyer || '',
      recorder: 'bà tám',
      is_low_stock: product.is_low_stock || false
    });
    setImagePreview(product.image_url || null);
    setShowModal('edit_product');
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setActionLoading(true);

    let finalImageUrl = formData.image_url;
    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile);
      if (uploadedUrl) finalImageUrl = uploadedUrl;
    }

    const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t);
    const productData = {
      name: formData.name,
      description: formData.description,
      tags: tagsArray,
      image_url: finalImageUrl,
      buyer: formData.buyer,
      is_low_stock: formData.is_low_stock,
      quantity: formData.quantity
    };

    const { error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', selectedProduct?.id);

    if (!error) {
      setShowModal(null);
      fetchBaTamTransactions();
      resetForm();
    }
    setActionLoading(false);
  };

  const handleToggleLowStock = async (product) => {
    const newStatus = !product.is_low_stock;
    setActionLoading(true);
    const { error } = await supabase
      .from('products')
      .update({ is_low_stock: newStatus })
      .eq('id', product.id);

    if (!error) {
      fetchBaTamTransactions();
    } else {
      alert("Có lỗi xảy ra: " + error.message);
    }
    setActionLoading(false);
  };

  const smartUpdateQuantity = (current, delta, isAdd) => {
    const parse = (str) => {
      const list = [];
      const map = {};
      const regex = /(\d+(?:\.\d+)?)\s*(\D+?)(?=\s*\d|$)/g;
      let match;
      while ((match = regex.exec(str)) !== null) {
        const val = parseFloat(match[1]);
        const unit = match[2].trim().toLowerCase();
        if (!unit) continue;
        if (map[unit] === undefined) {
          list.push(unit);
          map[unit] = val;
        } else {
          map[unit] += val;
        }
      }
      return { list, map };
    };

    const curr = parse(current || "");
    const dlt = parse(delta || "");
    if (dlt.list.length === 0) return current;

    dlt.list.forEach(unit => {
      if (curr.map[unit] === undefined) {
        curr.list.push(unit);
        curr.map[unit] = isAdd ? dlt.map[unit] : -dlt.map[unit];
      } else {
        curr.map[unit] += isAdd ? dlt.map[unit] : -dlt.map[unit];
      }
    });

    return curr.list
      .map(unit => {
        const v = curr.map[unit];
        const displayVal = Number.isInteger(v) ? v : v.toFixed(2).replace(/\.?0+$/, "");
        return `${displayVal} ${unit}`;
      })
      .join(' ');
  };

  const handleTransaction = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    const type = showModal; 
    const qtyText = formData.quantity;
    const prevQty = selectedProduct?.quantity || "";
    const newQty = smartUpdateQuantity(prevQty, qtyText, type === 'import');

    const { error: txError } = await supabase.from('transactions').insert([
      {
        product_id: selectedProduct?.id,
        type,
        quantity: qtyText,
        prev_quantity: prevQty,
        new_quantity: newQty,
        date: new Date().toISOString(),
        notes: formData.recorder
      }
    ]);

    if (!txError && selectedProduct) {
      await supabase.from('products').update({ quantity: newQty }).eq('id', selectedProduct.id);
    }

    if (!txError) {
      setShowModal(null);
      fetchBaTamTransactions();
      resetForm();
    } else {
      alert("Lỗi: " + txError.message);
    }
    setActionLoading(false);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', min_quantity: 5, tags: '', image_url: '', quantity: '', buyer: '', recorder: 'bà tám', is_low_stock: false });
    setSelectedProduct(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const filteredTransactions = transactions.filter(t => {
    if (!filterDate) return true;
    return format(new Date(t.date), 'yyyy-MM-dd') === filterDate;
  });

  return (
    <div className="fade-in">
      <div className="goods-header-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Lịch sử lấy hàng (Bà Tám)</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#fffbeb', color: '#92400e', borderRadius: '20px', fontSize: '0.875rem', fontWeight: '600' }}>
          <ShoppingBag size={18} />
          30 ngày gần nhất
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '10px', flex: '0 0 250px', margin: 0, height: '45px' }}>
          <Calendar size={20} color="var(--text-muted)" />
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none', width: '100%', height: '100%', padding: 0, cursor: 'pointer' }}
          />
          {filterDate && <X size={16} onClick={() => setFilterDate('')} style={{ cursor: 'pointer', color: '#ef4444' }} />}
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>Đang tải dữ liệu...</div>
        ) : filteredTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <p>Không có dữ liệu lấy hàng phù hợp</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <table className="desktop-only" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Thời gian</th>
                  <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Hình ảnh</th>
                  <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Sản phẩm</th>
                  <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Số lượng</th>
                  <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Khách hàng</th>
                  <th style={{ textAlign: 'right', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', minWidth: '150px' }}>
                      {format(new Date(t.date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ width: '60px', height: '60px', background: '#f1f5f9', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}>
                        {t.products?.image_url ? (
                          <img
                            src={t.products.image_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Không ảnh</div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600' }}>{t.products?.name || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tồn: {t.products?.quantity || '0'}</div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{ 
                        fontWeight: '700', 
                        color: 'var(--primary)', 
                        background: '#eff6ff', 
                        padding: '4px 12px', 
                        borderRadius: '16px',
                        fontSize: '0.9rem'
                      }}>
                        {t.quantity}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {t.customers?.name || t.notes || '—'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {t.products && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button className="btn" style={{ padding: '6px 10px', background: '#ecfdf5', color: '#059669', fontSize: '0.75rem' }} onClick={() => { setSelectedProduct(t.products); setShowModal('import'); }}>
                            Nhập
                          </button>
                          <button className="btn" style={{ padding: '6px 10px', background: '#fff1f2', color: '#e11d48', fontSize: '0.75rem' }} onClick={() => { setSelectedProduct(t.products); setShowModal('export'); }}>
                            Xuất
                          </button>
                          <button className="btn" style={{ padding: '6px', background: '#f8fafc', border: '1px solid var(--border)' }} onClick={() => handleEdit(t.products)} title="Sửa">
                            Sửa
                          </button>
                          <button className="btn" style={{ padding: '6px', background: '#f1f5f9', border: '1px solid var(--border)' }} onClick={() => handleShowHistory(t.products)} title="Lịch sử">
                            <History size={16} />
                          </button>
                          <button className="btn" style={{ padding: '6px 10px', background: t.products.is_low_stock ? '#fee2e2' : '#fffbeb', color: t.products.is_low_stock ? '#ef4444' : '#92400e', fontSize: '0.75rem' }} onClick={() => handleToggleLowStock(t.products)}>
                            {t.products.is_low_stock ? 'Đã nhập' : 'Báo hết'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="mobile-only">
              {filteredTransactions.map(t => (
                <div key={t.id} className="mobile-table-card">
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ width: '100px', height: '100px', background: '#f1f5f9', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
                      {t.products?.image_url && (
                        <img
                          src={t.products.image_url}
                          alt=""
                          referrerPolicy="no-referrer"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{t.products?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        {format(new Date(t.date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đã lấy:</span>
                        <span style={{ fontWeight: '700', color: 'var(--primary)', background: '#eff6ff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                          {t.quantity}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Tồn kho: </span>
                      <span style={{ fontWeight: '600' }}>{t.products?.quantity || '0'}</span>
                    </div>
                    {t.customers?.name && (
                      <div style={{ fontWeight: '500', color: 'var(--primary)' }}>
                        Cho: {t.customers.name}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button className="btn" style={{ flex: 1, padding: '8px', background: '#ecfdf5', color: '#059669', fontSize: '0.7rem' }} onClick={() => { setSelectedProduct(t.products); setShowModal('import'); }}>
                      Nhập
                    </button>
                    <button className="btn" style={{ flex: 1, padding: '8px', background: '#fff1f2', color: '#e11d48', fontSize: '0.7rem' }} onClick={() => { setSelectedProduct(t.products); setShowModal('export'); }}>
                      Xuất
                    </button>
                    <button className="btn" style={{ flex: 1, padding: '8px', background: '#f1f5f9', color: 'var(--text-main)', fontSize: '0.7rem' }} onClick={() => handleEdit(t.products)}>
                      Sửa
                    </button>
                    <button className="btn" style={{ flex: 1, padding: '8px', background: '#f1f5f9', color: 'var(--text-main)', fontSize: '0.7rem' }} onClick={() => handleShowHistory(t.products)}>
                      <History size={14} />
                    </button>
                    <button className="btn" style={{ flex: 1, padding: '8px', background: t.products?.is_low_stock ? '#fee2e2' : '#fffbeb', color: t.products?.is_low_stock ? '#ef4444' : '#92400e', fontSize: '0.7rem' }} onClick={() => handleToggleLowStock(t.products)}>
                      {t.products?.is_low_stock ? 'Đã nhập' : 'Hết'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals from Goods.js */}
      {showModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(null)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}>
              {showModal === 'edit_product' ? 'Sửa thông tin hàng hóa' : showModal === 'import' ? `Nhập hàng: ${selectedProduct?.name}` : `Xuất hàng: ${selectedProduct?.name}`}
            </h2>

            <form onSubmit={showModal === 'edit_product' ? handleSaveProduct : handleTransaction}>
              {showModal === 'edit_product' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 2.5fr', gap: '1.5rem' }}>
                    <div>
                      <label>Ảnh sản phẩm</label>
                      <div
                        onClick={() => document.getElementById('image-upload-bt').click()}
                        style={{
                          width: '100%',
                          aspectRatio: '1/1',
                          border: '2px dashed var(--border)',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          background: '#f8fafc',
                          overflow: 'hidden'
                        }}
                      >
                        {imagePreview ? (
                          <img src={imagePreview} alt="Preview" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ textAlign: 'center' }}>
                            <Plus size={24} color="var(--text-muted)" />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Chọn ảnh</div>
                          </div>
                        )}
                      </div>
                      <input id="image-upload-bt" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <label>Tên hàng hóa</label>
                        <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                      </div>
                      <div>
                        <label>Số lượng hiện tại</label>
                        <input type="text" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" id="is_low_stock_bt" checked={formData.is_low_stock} onChange={e => setFormData({ ...formData, is_low_stock: e.target.checked })} />
                        <label htmlFor="is_low_stock_bt" style={{ margin: 0 }}>Đánh dấu là sắp hết hàng</label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label>Tags</label>
                    <input value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} />
                  </div>
                  <div>
                    <label>Mô tả</label>
                    <textarea value={formData.description} rows="2" onChange={e => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div><label>Số lượng {showModal === 'import' ? 'nhập' : 'xuất'}</label><input type="text" required value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} /></div>
                  <div>
                    <label>Người thực hiện</label>
                    <input type="text" value={formData.recorder} onChange={e => setFormData({ ...formData, recorder: e.target.value })} />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      {['của mình', 'bà tám'].map(name => (
                        <button key={name} type="button" onClick={() => setFormData({ ...formData, recorder: name })} className={`btn ${formData.recorder === name ? 'btn-primary' : ''}`} style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '20px', background: formData.recorder === name ? 'var(--primary)' : 'white', color: formData.recorder === name ? 'white' : 'var(--text-main)', border: '1px solid var(--border)' }}>{name}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div style={{ marginTop: '2rem', display: 'flex', gap: '10px' }}>
                <button type="button" className="btn" style={{ flex: 1, background: '#f1f5f9' }} onClick={() => setShowModal(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={actionLoading}>{actionLoading ? 'Đang xử lý...' : 'Xác nhận'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showHistory && createPortal(
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowHistory(false)}><X size={20} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
              <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '10px' }}><History color="var(--primary)" size={24} /></div>
              <div>
                <h2>Ghi chú nhập xuất: {selectedProduct?.name}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Mã hàng: #{selectedProduct?.id}</p>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Thời gian</th>
                    <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Loại</th>
                    <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Thay đổi</th>
                    <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Trước → Sau</th>
                    <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {productHistory.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{format(new Date(t.date), 'dd/MM/yyyy HH:mm', { locale: vi })}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '4px 8px', borderRadius: '4px', background: t.type === 'import' ? '#ecfdf5' : '#fff1f2', color: t.type === 'import' ? '#059669' : '#e11d48' }}>{t.type === 'import' ? 'NHẬP' : 'XUẤT'}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '700' }}>{t.quantity}</td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{t.prev_quantity || '—'}</div>
                        <div style={{ margin: '2px 0', lineHeight: 1, color: 'var(--primary)' }}>↓</div>
                        <div style={{ fontWeight: '600' }}>{t.new_quantity || '—'}</div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.customers?.name || t.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '2rem', textAlign: 'right' }}><button className="btn" style={{ background: '#f1f5f9' }} onClick={() => setShowHistory(false)}>Đóng</button></div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default BaTam;
