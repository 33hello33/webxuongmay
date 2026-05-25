import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Search, AlertTriangle, Package, ExternalLink, Tag, Truck, Box, X } from 'lucide-react';
import { createPortal } from 'react-dom';
const STATUS_LIST = [
  { id: 'tiếp nhận', label: 'Tiếp nhận', color: '#64748b', bg: '#f1f5f9' },
  { id: 'soạn hàng', label: 'Soạn hàng', color: '#0ea5e9', bg: '#f0f9ff' },
  { id: 'cắt vải', label: 'Cắt vải', color: '#6366f1', bg: '#e0e7ff' },
  { id: 'lên chuyền', label: 'Lên chuyền', color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'kiểm hàng', label: 'Kiểm hàng', color: '#f59e0b', bg: '#fffbeb' },
  { id: 'hoàn thành', label: 'Hoàn thành', color: '#10b981', bg: '#ecfdf5' },
  { id: 'đã gửi', label: 'Đã gửi', color: '#d946ef', bg: '#fdf4ff' }
];

function Overview() {
  const [products, setProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [shippingCount, setShippingCount] = useState(0);
  const [activeShippings, setActiveShippings] = useState([]);

  const [showModal, setShowModal] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState({ quantity: '', recorder: 'của mình' });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setProducts(data);
      setLowStock(data.filter(p => p.is_low_stock));
    }

    // Fetch active shipping count & list
    const { data: shippingData } = await supabase
      .from('transactions')
      .select('*')
      .eq('type', 'shipping')
      .neq('status', 'đã gửi');

    if (shippingData) {
      setShippingCount(shippingData.length);
      // Filter for specific in-progress statuses
      const inProgress = ['tiếp nhận', 'soạn hàng', 'cắt vải', 'lên chuyền', 'kiểm hàng'];
      setActiveShippings(shippingData.filter(s => inProgress.includes(s.status)));
    }

    setLoading(false);
  };

  const handleUpdateStatus = async (id, newStatus) => {
    const { error } = await supabase
      .from('transactions')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      fetchData();
    } else {
      alert("Lỗi: " + error.message);
    }
  };

  const handleToggleLowStock = async (product) => {
    const newStatus = !product.is_low_stock;
    const { error } = await supabase.from('products').update({ is_low_stock: newStatus }).eq('id', product.id);
    if (!error) fetchData();
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
    setIsProcessing(true);
    const type = showModal;
    const qtyText = formData.quantity;
    const prevQty = selectedProduct?.quantity || "";
    const newQty = smartUpdateQuantity(prevQty, qtyText, type === 'import');

    const { error: txError } = await supabase.from('transactions').insert([{
      product_id: selectedProduct?.id,
      type,
      quantity: qtyText,
      prev_quantity: prevQty,
      new_quantity: newQty,
      date: new Date().toISOString(),
      notes: formData.recorder
    }]);

    if (!txError && selectedProduct) {
      await supabase.from('products').update({ quantity: newQty }).eq('id', selectedProduct.id);
      setShowModal(null);
      fetchData();
      setFormData({ quantity: '', recorder: 'của mình' });
      setSelectedProduct(null);
    } else if (txError) {
      alert("Lỗi: " + txError.message);
    }
    setIsProcessing(false);
  };

  const getFilteredProducts = () => {
    if (!searchQuery.trim()) return products;
    const searchTerms = searchQuery.toLowerCase().split(/[\s,]+/).filter(t => t.length > 0);

    return products.filter(product => {
      const productTags = (product.tags || []).map(t => t.toLowerCase());
      const buyer = (product.buyer || '').toLowerCase();
      const description = (product.description || '').toLowerCase();
      const name = (product.name || '').toLowerCase();

      return searchTerms.every(term =>
        productTags.some(tag => tag.includes(term)) ||
        buyer.includes(term) ||
        description.includes(term) ||
        name.includes(term)
      );
    });
  };

  const filtered = getFilteredProducts();

  return (
    <div className="fade-in">
      <div className="grid grid-4 summary-grid-mobile" style={{ marginBottom: '3rem' }}>
        <div className="card summary-card-mobile" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <div className="card-icon" style={{ background: '#fef2f2', padding: '10px', borderRadius: '10px' }}>
              <AlertTriangle color="#ef4444" size={24} />
            </div>
            <span className="card-label" style={{ fontWeight: '600', color: '#b91c1c' }}>Hàng gần hết</span>
          </div>
          <div className="card-number" style={{ fontSize: '2.5rem', fontWeight: '800' }}>{lowStock.length}</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Sản phẩm cần nhập thêm gấp</p>
        </div>

        <div className="card summary-card-mobile" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <div className="card-icon" style={{ background: '#f5f3ff', padding: '10px', borderRadius: '10px' }}>
              <Truck color="#8b5cf6" size={24} />
            </div>
            <span className="card-label" style={{ fontWeight: '600', color: '#6d28d9' }}>Hàng đang gửi</span>
          </div>
          <div className="card-number" style={{ fontSize: '2.5rem', fontWeight: '800' }}>{shippingCount}</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Đơn hàng đang trong quá trình gửi</p>
        </div>

        <div className="card summary-card-mobile" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <div className="card-icon" style={{ background: '#eff6ff', padding: '10px', borderRadius: '10px' }}>
              <Package color="var(--primary)" size={24} />
            </div>
            <span className="card-label" style={{ fontWeight: '600', color: 'var(--primary)' }}>Tổng hàng hóa</span>
          </div>
          <div className="card-number" style={{ fontSize: '2.5rem', fontWeight: '800' }}>{products.length}</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Mã hàng hiện có trong hệ thống</p>
        </div>

        <div className="card summary-card-mobile desktop-only" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <div className="card-icon" style={{ background: '#ecfdf5', padding: '10px', borderRadius: '10px' }}>
              <Tag color="#10b981" size={24} />
            </div>
            <span className="card-label" style={{ fontWeight: '600', color: '#047857' }}>Danh mục</span>
          </div>
          <div className="card-number" style={{ fontSize: '2.5rem', fontWeight: '800' }}>
            {new Set(products.flatMap(p => p.tags || [])).size}
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Các loại nhãn hàng khác nhau</p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
            <AlertTriangle size={24} /> Danh sách hàng gần hết
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {lowStock.map(product => (
              <div key={`low-${product.id}`} className="card" style={{ border: '1px solid #fee2e2', background: '#fffafb' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '100px', height: '100px', background: '#fef2f2', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}>
                    {product.image_url && <img
                      src={product.image_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                    <div style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: '600', marginBottom: '8px' }}>
                      Số lượng: {product.quantity}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn" style={{ flex: 1, padding: '6px', background: '#ecfdf5', color: '#059669', fontSize: '0.75rem' }} onClick={() => { setSelectedProduct(product); setShowModal('import'); }}>Nhập</button>
                      <button className="btn" style={{ flex: 1, padding: '6px', background: product.is_low_stock ? '#fee2e2' : '#fffbeb', color: product.is_low_stock ? '#ef4444' : '#92400e', fontSize: '0.75rem' }} onClick={() => handleToggleLowStock(product)}>{product.is_low_stock ? 'Đã nhập' : 'Báo hết'}</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeShippings.length > 0 && (
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#8b5cf6' }}>
            <Truck size={24} /> Danh sách hàng đang xử lý (Gửi)
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {activeShippings.map(s => (
              <div key={`ship-${s.id}`} className="card" style={{ border: '1px solid #ddd6fe', background: '#fcfaff' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '100px', height: '100px', background: '#f5f3ff', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}>
                    {s.image_url && <img
                      src={s.image_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.product_name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap', gap: '4px' }}>
                      {(() => {
                        const currentStatus = STATUS_LIST.find(st => st.id === s.status) || STATUS_LIST[0];
                        return (
                          <div style={{ position: 'relative', flex: 1 }}>
                            <select
                              value={s.status}
                              onChange={(e) => handleUpdateStatus(s.id, e.target.value)}
                              style={{
                                appearance: 'none',
                                fontSize: '0.7rem',
                                padding: '4px 12px',
                                paddingRight: '20px',
                                borderRadius: '20px',
                                border: `1px solid ${currentStatus.color}40`,
                                background: currentStatus.bg,
                                color: currentStatus.color,
                                fontWeight: '700',
                                cursor: 'pointer',
                                width: 'auto',
                                transition: 'all 0.2s'
                              }}
                            >
                              {STATUS_LIST.map(st => (
                                <option key={st.id} value={st.id} style={{ color: 'var(--text-main)', background: 'white' }}>
                                  {st.label}
                                </option>
                              ))}
                            </select>
                            <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '10px', color: currentStatus.color }}>
                              ▼
                            </div>
                          </div>
                        );
                      })()}
                      <span style={{ fontSize: '0.875rem', fontWeight: '800', color: 'var(--primary)', marginLeft: '8px' }}>{s.quantity}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(null)}><X size={20} /></button>
            <h2 style={{ marginBottom: '1.5rem' }}>
              {showModal === 'import' ? `Nhập hàng: ${selectedProduct?.name}` : `Xuất hàng: ${selectedProduct?.name}`}
            </h2>

            <form onSubmit={handleTransaction}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Số lượng {showModal === 'import' ? 'nhập' : 'xuất'} (Text)</label>
                  <input type="text" placeholder="VD: 2 cuộn..." required value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>Người {showModal === 'import' ? 'nhập' : 'xuất'}</label>
                  <input type="text" value={formData.recorder} onChange={e => setFormData({ ...formData, recorder: e.target.value })} placeholder="Chọn hoặc nhập tên..." />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    {['của mình', 'bà tám'].map(name => (
                      <button key={name} type="button" onClick={() => setFormData({ ...formData, recorder: name })} style={{ padding: '4px 12px', fontSize: '0.75rem', borderRadius: '20px', border: '1px solid var(--border)', background: formData.recorder === name ? 'var(--primary)' : 'white', color: formData.recorder === name ? 'white' : 'var(--text-main)', cursor: 'pointer' }}>
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', gap: '10px' }}>
                <button type="button" className="btn" style={{ flex: 1, background: '#f1f5f9' }} onClick={() => setShowModal(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={isProcessing}>{isProcessing ? 'Đang xử lý...' : 'Xác nhận'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Overview;
