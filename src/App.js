import React, { useState, useEffect } from 'react';
import './index.css';
import Overview from './components/Overview';
import Goods from './components/Goods';
import Customers from './components/Customers';
import Shipping from './components/Shipping';
import Config from './components/Config';
import Expenses from './components/Expenses';
import DefectiveGoods from './components/DefectiveGoods';
import BaTam from './components/BaTam';
import Login from './components/Login';
import { LayoutDashboard, Box, Users, Bell, Truck, Settings, Wallet, X, AlertCircle, ShoppingBag, LogOut, User } from 'lucide-react';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [previewImage, setPreviewImage] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    // Check if user is already logged in and session is still valid
    const sessionDataStr = localStorage.getItem('app_session');
    if (sessionDataStr) {
      try {
        const { user: savedUser, expiresAt } = JSON.parse(sessionDataStr);
        const now = new Date().getTime();
        
        if (now < expiresAt) {
          setUser(savedUser);
        } else {
          // Session expired
          localStorage.removeItem('app_session');
        }
      } catch (e) {
        localStorage.removeItem('app_session');
      }
    }

    const handleGlobalClick = (e) => {
      // Check if the clicked element is an image
      if (e.target.tagName === 'IMG' && e.target.src && !e.target.closest('.image-viewer-container')) {
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

  const handleLogin = (userData) => {
    setUser(userData);
    const sessionData = {
      user: userData,
      expiresAt: new Date().getTime() + (24 * 60 * 60 * 1000) // 1 day from now
    };
    localStorage.setItem('app_session', JSON.stringify(sessionData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('app_session');
    setActiveTab('overview');
  };

  const renderContent = () => {
    if (!user) return <Login onLogin={handleLogin} />;

    switch (activeTab) {
      case 'overview': return <Overview />;
      case 'goods': return <Goods />;
      case 'customers': return <Customers />;
      case 'shipping': return <Shipping />;
      case 'defective': return <DefectiveGoods />;
      case 'batam': return <BaTam />;
      case 'expenses': return <Expenses />;
      case 'config': return <Config />;
      default: return <Overview />;
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

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
            className={`tab-btn ${activeTab === 'batam' ? 'active' : ''}`}
            onClick={() => setActiveTab('batam')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag size={18} />
              <span>Bà tám</span>
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
          
          {user.role === 'Quản lý' && (
            <>
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
            </>
          )}

          {user.role === 'Quản lý' && (
            <button
              className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
              onClick={() => setActiveTab('config')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} />
                <span>Cấu hình</span>
              </div>
            </button>
          )}
        </nav>

        <div className="header-actions">
          <div style={{ position: 'relative' }}>
            <button 
              className="btn user-profile-btn" 
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{ 
                background: '#f1f5f9', 
                color: 'var(--text-main)', 
                borderRadius: '24px', 
                padding: '4px 12px',
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {user.tennv ? user.tennv.charAt(0).toUpperCase() : 'U'}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: '600', lineHeight: '1.2' }}>{user.tennv}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{user.role}</div>
              </div>
            </button>

            {showUserMenu && (
              <div className="user-dropdown fade-in">
                <div className="user-dropdown-header">
                  <strong>{user.tennv}</strong>
                  <span>{user.username}</span>
                </div>
                <div className="user-dropdown-divider"></div>
                <button className="dropdown-item" onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
          
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

