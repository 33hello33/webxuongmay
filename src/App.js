import React, { useState, useEffect } from 'react';
import './index.css';
import Overview from './components/Overview';
import Goods from './components/Goods';
import Customers from './components/Customers';
import Shipping from './components/Shipping';
import Config from './components/Config';
import Expenses from './components/Expenses';
import DefectiveGoods from './components/DefectiveGoods';
import { LayoutDashboard, Box, Users, Bell, Truck, Settings, Wallet, X, AlertCircle } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      // Check if the clicked element is an image
      if (e.target.tagName === 'IMG' && e.target.src && !e.target.closest('.image-viewer-container')) {
        // Avoid clicking icons or small UI elements if they are images
        // Most product images in this app have a specific source or are within cards
        const isProductImage = e.target.closest('.card') || 
                              e.target.closest('.modal-container') || 
                              e.target.src.includes('supabase') || 
                              e.target.src.includes('googleusercontent');
        
        if (isProductImage) {
          setPreviewImage(e.target.src);
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <Overview />;
      case 'goods': return <Goods />;
      case 'customers': return <Customers />;
      case 'shipping': return <Shipping />;
      case 'defective': return <DefectiveGoods />;
      case 'expenses': return <Expenses />;
      case 'config': return <Config />;
      default: return <Overview />;
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <div className="logo">Xưởng May Pro</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hệ thống quản lý kho</span>
        </div>

        <nav className="tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutDashboard size={18} />
              <span>Tổng quan</span>
            </div>
          </button>
          <button
            className={`tab-btn ${activeTab === 'goods' ? 'active' : ''}`}
            onClick={() => setActiveTab('goods')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Box size={18} />
              <span>Nguyên vật liệu</span>
            </div>
          </button>
          <button
            className={`tab-btn ${activeTab === 'shipping' ? 'active' : ''}`}
            onClick={() => setActiveTab('shipping')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={18} />
              <span>Hàng gửi</span>
            </div>
          </button>
          <button
            className={`tab-btn ${activeTab === 'defective' ? 'active' : ''}`}
            onClick={() => setActiveTab('defective')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} />
              <span>Hàng lỗi</span>
            </div>
          </button>
          <button
            className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
            onClick={() => setActiveTab('expenses')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={18} />
              <span>Chi phí</span>
            </div>
          </button>
          <button
            className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} />
              <span>Khách hàng</span>
            </div>
          </button>
        </nav>

        <div className="header-actions">
          <button className="btn" style={{ background: '#f1f5f9', color: 'var(--text-main)', borderRadius: '50%', width: '40px', height: '40px', padding: '0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Bell size={20} />
          </button>
        </div>
      </header>

      <main className="content-area">
        {renderContent()}
      </main>

      {/* Global Image Viewer Modal */}
      {previewImage && (
        <div 
          className="image-viewer-overlay" 
          onClick={() => setPreviewImage(null)}
        >
          <div className="image-viewer-container" onClick={e => e.stopPropagation()}>
            <button className="image-viewer-close" onClick={() => setPreviewImage(null)}>
              <X size={32} />
            </button>
            <img src={previewImage} alt="Full view" />
          </div>
        </div>
      )}
    </div>
  );
}


export default App;
