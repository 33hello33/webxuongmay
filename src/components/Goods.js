import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, ArrowDownLeft, ArrowUpRight, MoreVertical, X, Search, History, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { createPortal } from 'react-dom';
import { uploadImage } from '../lib/uploadHelper';

function Goods() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [view, setView] = useState('list'); // 'list' or 'history'
  const [showModal, setShowModal] = useState(null); // 'add_product', 'import', 'export'
  const [showHistory, setShowHistory] = useState(false);
  const [productHistory, setProductHistory] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    min_quantity: 5,
    tags: '',
    image_url: '',
    quantity: '',
    buyer: '',
    is_low_stock: false
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    fetchTransactions();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('name');
    if (data) setCustomers(data);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*, products(name), customers(name)')
      .order('date', { ascending: false });
    if (data) setTransactions(data);
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
      is_low_stock: product.is_low_stock || false
    });
    setImagePreview(product.image_url || null);
    setShowModal('edit_product');
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setLoading(true);

    let finalImageUrl = formData.image_url;

    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile);
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
      }
    }

    const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t);
    const productData = {
      name: formData.name,
      description: formData.description,
      tags: tagsArray,
      image_url: finalImageUrl,
      buyer: formData.buyer,
      is_low_stock: formData.is_low_stock,
    };

    if (showModal === 'add_product') {
      productData.quantity = formData.quantity;
      const { error } = await supabase.from('products').insert([productData]);
      if (!error) {
        setShowModal(null);
        fetchProducts();
        resetForm();
      }
    } else if (showModal === 'edit_product') {
      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', selectedProduct?.id);

      if (!error) {
        setShowModal(null);
        fetchProducts();
        resetForm();
      }
    }

    setLoading(false);
  };

  const handleToggleLowStock = async (product) => {
    const newStatus = !product.is_low_stock;
    setLoading(true);
    const { error } = await supabase
      .from('products')
      .update({ is_low_stock: newStatus })
      .eq('id', product.id);

    if (!error) {
      fetchProducts();
    } else {
      alert("Có lỗi xảy ra: " + error.message);
    }
    setLoading(false);
  };

  const handleTransaction = async (e) => {
    e.preventDefault();
    setLoading(true);
    const type = showModal; // 'import' or 'export'
    const qtyText = formData.quantity;

    // 1. Create transaction record
    const { error: txError } = await supabase.from('transactions').insert([
      {
        product_id: selectedProduct?.id,
        type,
        quantity: qtyText,
        date: new Date().toISOString(),
        buyer_id: type === 'export' ? formData.buyer_id : null
      }
    ]);

    // 2. Note: We don't automatically update quantity because it's text now
    // The user should update the product quantity manually via Edit if needed,
    // or we can add a quick update field here. For simplicity, we just log the transaction.

    if (!txError) {
      setShowModal(null);
      fetchProducts();
      fetchTransactions();
      resetForm();
    } else {
      alert("Lỗi: " + txError.message);
    }
    setLoading(false);
  };

  const getFilteredProducts = () => {
    if (!searchQuery.trim()) return products;
    const searchTags = searchQuery.toLowerCase().split(/[\s,]+/).filter(t => t.length > 0);
    return products
      .map(product => {
        const matches = (product.tags || []).filter(tag =>
          searchTags.some(st => tag.toLowerCase().includes(st))
        );
        return { ...product, matchCount: matches.length };
      })
      .filter(p => p.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount);
  };

  const filtered = getFilteredProducts();

  const resetForm = () => {
    setFormData({ name: '', description: '', min_quantity: 5, tags: '', image_url: '', quantity: '', buyer: '', is_low_stock: false });
    setSelectedProduct(null);
    setImageFile(null);
    setImagePreview(null);
  };

  return (
    <div className="fade-in">
      <div className="goods-header-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Nguyên vật liệu</h1>
        <div className="goods-actions-mobile" style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal('add_product'); }} style={{ width: '100%' }}>
            <Plus size={18} style={{ marginRight: '8px' }} /> Thêm NVL mới
          </button>
        </div>
      </div>

      {view === 'list' && (
        <div className="search-box card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', maxWidth: '400px' }}>
          <Search size={20} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Tìm theo tag..."
            style={{ border: 'none', background: 'transparent', padding: '0.5rem 0', width: '100%' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {view === 'list' ? (
        <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
          {/* Desktop Table */}
          <table className="desktop-only" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>ID</th>
                <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Ngày nhập</th>
                <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Sản phẩm</th>
                <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Phân loại (Tags)</th>
                <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Tình trạng</th>
                <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Số lượng</th>
                <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Người mua</th>
                <th style={{ textAlign: 'right', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: '700', color: 'var(--primary)' }}>#{p.id}</td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                    {p.created_at ? format(new Date(p.created_at), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '150px', height: '150px', background: '#f1f5f9', borderRadius: '16px', overflow: 'hidden', flexShrink: 0 }}>
                        {p.image_url && (
                          <img 
                            src={p.image_url.includes('drive.google.com') ? `https://drive.google.com/thumbnail?id=${p.image_url.match(/[-\w]{25,}/)}&sz=w600` : p.image_url} 
                            alt="" 
                            referrerPolicy="no-referrer"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.description || 'Không có mô tả'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(p.tags || []).map(t => <span key={t} className="badge badge-info" style={{ fontSize: '0.6rem' }}>{t}</span>)}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {p.is_low_stock ?
                      <span className="badge" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2' }}>Sắp hết</span> :
                      <span className="badge" style={{ background: '#f0fdf4', color: '#22c55e', border: '1px solid #dcfce7' }}>Sẵn hàng</span>
                    }
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span style={{ fontWeight: '700', color: p.is_low_stock ? '#ef4444' : 'var(--text-main)' }}>{p.quantity}</span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{p.buyer || '—'}</td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button className="btn" style={{ padding: '6px 10px', background: '#ecfdf5', color: '#059669', fontSize: '0.75rem' }} onClick={() => { setSelectedProduct(p); setShowModal('import'); }}>
                        Nhập
                      </button>
                      <button className="btn" style={{ padding: '6px 10px', background: '#fff1f2', color: '#e11d48', fontSize: '0.75rem' }} onClick={() => { setSelectedProduct(p); setShowModal('export'); }}>
                        Xuất
                      </button>
                      <button className="btn" style={{ padding: '6px', background: '#f8fafc', border: '1px solid var(--border)' }} onClick={() => handleEdit(p)} title="Sửa">
                        Sửa
                      </button>
                      <button className="btn" style={{ padding: '6px', background: '#f1f5f9', border: '1px solid var(--border)' }} onClick={() => handleShowHistory(p)} title="Lịch sử">
                        <History size={16} />
                      </button>
                      <button className="btn" style={{ padding: '6px 10px', background: p.is_low_stock ? '#fee2e2' : '#fffbeb', color: p.is_low_stock ? '#ef4444' : '#92400e', fontSize: '0.75rem' }} onClick={() => handleToggleLowStock(p)}>
                        {p.is_low_stock ? 'Đã nhập' : 'Báo hết'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card List */}
          <div className="mobile-only">
            {filtered.map(p => (
              <div key={p.id} className="mobile-table-card">
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '150px', height: '150px', background: '#f1f5f9', borderRadius: '16px', overflow: 'hidden', flexShrink: 0 }}>
                    {p.image_url && <img 
                      src={p.image_url.replace('drive.google.com/uc?id=', 'lh3.googleusercontent.com/d/').split('&')[0]} 
                      alt="" 
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '1rem' }}>#{p.id} - {p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Ngày nhập: {p.created_at ? format(new Date(p.created_at), 'dd/MM/yyyy') : '—'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{p.description || 'Không có mô tả'}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(p.tags || []).map(t => <span key={t} className="badge badge-info" style={{ fontSize: '0.6rem' }}>{t}</span>)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.875rem' }}>
                    Tình trạng: {p.is_low_stock ?
                      <span style={{ color: '#ef4444', fontWeight: '700' }}>Sắp hết</span> :
                      <span style={{ color: '#22c55e', fontWeight: '700' }}>Sẵn hàng</span>
                    }
                    <div style={{ marginTop: '4px' }}>
                      Số lượng: <span style={{ fontWeight: '700', color: p.is_low_stock ? '#ef4444' : 'var(--text-main)' }}>{p.quantity}</span>
                    </div>
                  </div>
                  {p.buyer && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: '500' }}>
                      Mua bởi: {p.buyer}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button className="btn" style={{ flex: 1, padding: '8px', background: '#ecfdf5', color: '#059669', fontSize: '0.75rem' }} onClick={() => { setSelectedProduct(p); setShowModal('import'); }}>
                    Nhập
                  </button>
                  <button className="btn" style={{ flex: 1, padding: '8px', background: '#fff1f2', color: '#e11d48', fontSize: '0.75rem' }} onClick={() => { setSelectedProduct(p); setShowModal('export'); }}>
                    Xuất
                  </button>
                  <button className="btn" style={{ flex: 1, padding: '8px', background: '#f1f5f9', color: 'var(--text-main)', fontSize: '0.75rem' }} onClick={() => handleEdit(p)}>
                    Sửa
                  </button>
                  <button className="btn" style={{ flex: 1, padding: '8px', background: '#f1f5f9', color: 'var(--text-main)', fontSize: '0.75rem' }} onClick={() => handleShowHistory(p)}>
                    Lịch sử
                  </button>
                  <button className="btn" style={{ flex: 1, padding: '8px', background: p.is_low_stock ? '#fee2e2' : '#fffbeb', color: p.is_low_stock ? '#ef4444' : '#92400e', fontSize: '0.75rem' }} onClick={() => handleToggleLowStock(p)}>
                    {p.is_low_stock ? 'Đã nhập' : 'Hết'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Thời gian</th>
                <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Hàng hóa</th>
                <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Loại</th>
                <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Số lượng</th>
                <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Người mua</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                    {format(new Date(t.date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{t.products?.name}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: t.type === 'import' ? '#059669' : '#e11d48' }}>
                      {t.type === 'import' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      <span style={{ fontWeight: '600' }}>{t.type === 'import' ? 'NHẬP' : 'XUẤT'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '700' }}>{t.quantity}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{t.customers?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(null)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}>
              {showModal === 'add_product' ? 'Thêm NVL mới' : showModal === 'edit_product' ? 'Sửa thông tin hàng hóa' : showModal === 'import' ? `Nhập hàng: ${selectedProduct?.name}` : `Xuất hàng: ${selectedProduct?.name}`}
            </h2>

            <form onSubmit={['add_product', 'edit_product'].includes(showModal) ? handleSaveProduct : handleTransaction}>
              {['add_product', 'edit_product'].includes(showModal) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Tên hàng hóa</label><input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                  <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Mô tả</label><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
                  <div className="grid grid-2">
                    <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>{showModal === 'add_product' ? 'Tồn ban đầu' : 'Số lượng hiện tại'}</label><input type="text" placeholder="VD: 10 cuộn, 5kg..." value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
                      <input
                        type="checkbox"
                        id="is_low_stock"
                        style={{ width: '20px', height: '20px' }}
                        checked={formData.is_low_stock}
                        onChange={e => setFormData({ ...formData, is_low_stock: e.target.checked })}
                      />
                      <label htmlFor="is_low_stock" style={{ fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}>Sắp hết hàng</label>
                    </div>
                  </div>
                  <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Người mua (Text)</label><input placeholder="Tên khách hàng..." value={formData.buyer} onChange={e => setFormData({ ...formData, buyer: e.target.value })} /></div>
                  <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Tags (cách nhau bởi dấu phẩy)</label><input placeholder="Vải, Cotton, Mùa hè..." value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} /></div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Hình ảnh sản phẩm</label>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div
                        onClick={() => document.getElementById('image-upload').click()}
                        style={{
                          width: '100px',
                          height: '100px',
                          border: '2px dashed var(--border)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          background: '#f8fafc',
                          overflow: 'hidden'
                        }}
                      >
                        {imagePreview ? (
                          <img 
                            src={imagePreview} 
                            alt="Preview" 
                            referrerPolicy="no-referrer"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        ) : (
                          <Plus size={24} color="var(--text-muted)" />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          className="btn"
                          onClick={() => document.getElementById('image-upload').click()}
                          style={{ fontSize: '0.875rem', marginBottom: '8px', width: '100%', background: '#fff', border: '1px solid var(--border)' }}
                        >
                          Chọn ảnh từ máy tính
                        </button>
                        {imagePreview && (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => { setImageFile(null); setImagePreview(null); }}
                            style={{ fontSize: '0.875rem', width: '100%', background: '#fff1f2', color: '#e11d48' }}
                          >
                            Xóa ảnh
                          </button>
                        )}
                        {!imagePreview && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hỗ trợ JPG, PNG, WEBP. Hệ thống sẽ tự động nén ảnh xuống dưới 100KB.</div>}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div><label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Số lượng {showModal === 'import' ? 'nhập' : 'xuất'} (Text)</label><input type="text" placeholder="VD: 2 cuộn..." required value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} /></div>
                  {showModal === 'export' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Khách hàng (Người mua)</label>
                      <select value={formData.buyer_id} onChange={e => setFormData({ ...formData, buyer_id: e.target.value })}>
                        <option value="">Người mua...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
              <div style={{ marginTop: '2rem', display: 'flex', gap: '10px' }}>
                <button type="button" className="btn" style={{ flex: 1, background: '#f1f5f9' }} onClick={() => setShowModal(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>{loading ? 'Đang xử lý...' : 'Xác nhận'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showHistory && createPortal(
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal-container" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowHistory(false)}>
              <X size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
              <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '10px' }}>
                <History color="var(--primary)" size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>Ghi chú nhập xuất: {selectedProduct?.name}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Mã hàng: #{selectedProduct?.id}</p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Thời gian</th>
                    <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Loại</th>
                    <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Số lượng</th>
                    <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Ghi chú / Khách</th>
                  </tr>
                </thead>
                <tbody>
                  {productHistory.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                        {format(new Date(t.date), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: t.type === 'import' ? '#ecfdf5' : t.type === 'export' ? '#fff1f2' : '#f5f3ff',
                          color: t.type === 'import' ? '#059669' : t.type === 'export' ? '#e11d48' : '#8b5cf6'
                        }}>
                          {t.type === 'import' ? 'NHẬP' : t.type === 'export' ? 'XUẤT' : 'GỬI'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '700' }}>{t.quantity}</td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {t.customers?.name || t.notes || '—'}
                      </td>
                    </tr>
                  ))}
                  {productHistory.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Chưa có lịch sử giao dịch cho sản phẩm này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'right' }}>
              <button className="btn" style={{ background: '#f1f5f9' }} onClick={() => setShowHistory(false)}>Đóng</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Goods;
