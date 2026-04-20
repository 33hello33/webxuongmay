import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Search, AlertTriangle, Package, ExternalLink, Tag, Truck, Box } from 'lucide-react';
const STATUS_LIST = [
  { id: 'tiếp nhận', label: 'Tiếp nhận', color: '#64748b', bg: '#f1f5f9' },
  { id: 'soạn hàng', label: 'Soạn hàng', color: '#0ea5e9', bg: '#f0f9ff' },
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
      const inProgress = ['tiếp nhận', 'soạn hàng', 'lên chuyền', 'kiểm hàng'];
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

  return (
    <div className="fade-in">
      <div className="overview-header-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>Chào buổi chiều! 👋</h1>
          <p style={{ color: 'var(--text-muted)' }}>Đây là tình hình kho bãi của bạn hôm nay.</p>
        </div>
        
      </div>

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

        <div className="card summary-card-mobile" style={{ borderLeft: '4px solid #10b981' }}>
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
                      src={product.image_url.includes('drive.google.com') ? `https://drive.google.com/thumbnail?id=${product.image_url.match(/[-\w]{25,}/)}&sz=w600` : product.image_url} 
                      alt="" 
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                    <div style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: '600' }}>
                      Số lượng: {product.quantity}
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
                      src={s.image_url.includes('drive.google.com') ? `https://drive.google.com/thumbnail?id=${s.image_url.match(/[-\w]{25,}/)}&sz=w600` : s.image_url} 
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

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Box size={24} color="var(--primary)" /> Kho nguyên vật liệu {searchQuery && <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>— Kết quả tìm kiếm ({filtered.length})</span>}
          </h2>
          
          <div className="search-box card" style={{ padding: '0.25rem 1rem', display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '300px', width: '100%', margin: 0 }}>
            <Search size={20} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="Tìm theo tag..." 
              style={{ border: 'none', background: 'transparent', padding: '0.5rem 0', width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>Đang tải dữ liệu...</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
             Không tìm thấy hàng hóa nào phù hợp.
          </div>
        ) : (
          <div className="grid grid-3">
            {filtered.map(product => (
              <div key={product.id} className="card fade-in" style={{ padding: '0', overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '220px', background: '#f1f5f9', position: 'relative', overflow: 'hidden' }}>
                  {product.image_url ? (
                    <img 
                      src={product.image_url.includes('drive.google.com') ? `https://drive.google.com/thumbnail?id=${product.image_url.match(/[-\w]{25,}/)}&sz=w600` : product.image_url} 
                      alt={product.name} 
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                      <Package size={48} />
                      <span style={{ fontSize: '0.875rem', marginTop: '10px' }}>Chưa có hình ảnh</span>
                    </div>
                  )}
                  {product.is_low_stock && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                      <span className="badge badge-warning">Sắp hết hàng</span>
                    </div>
                  )}
                </div>
                
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{product.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: product.is_low_stock ? '#ef4444' : 'var(--text-main)', fontWeight: '700' }}>
                      <span style={{ fontSize: '1.25rem' }}>{product.quantity}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1rem' }}>
                    {(product.tags || []).map(tag => (
                      <span key={tag} className="badge badge-info" style={{ fontSize: '0.65rem' }}>{tag}</span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Người mua: {product.buyer || '—'}</span>
                    <button className="btn" style={{ padding: '4px', background: 'transparent' }} title="Xem chi tiết">
                      <ExternalLink size={16} color="var(--primary)" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Overview;
