import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Save, Cloud, Key, Folder, Info } from 'lucide-react';

function Config() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    auth_type: 'oauth',
    client_id: '',
    api_key: '',
    folder_id: ''
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data } = await supabase
        .from('tbl_config')
        .select('value')
        .eq('key', 'gdrive_config')
        .single();

      if (data && data.value) {
        setConfig(data.value);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('tbl_config')
      .upsert({ 
        key: 'gdrive_config', 
        value: config,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      alert('Lỗi khi lưu cấu hình: ' + error.message);
    } else {
      alert('Đã lưu cấu hình thành công!');
    }
    setSaving(false);
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải cấu hình...</div>;

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Cấu hình hệ thống</h1>
          <p style={{ color: 'var(--text-muted)' }}>Quản lý kết nối Google Drive (OAuth 2.0)</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={handleSave} 
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Save size={18} />
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <Cloud size={24} color="var(--primary)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Kết nối Google Drive</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="grid grid-2">
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '600' }}>
                <Folder size={14} /> ID Thư mục Google Drive
              </label>
              <input 
                type="text" 
                placeholder="ID của thư mục lưu ảnh..." 
                value={config.folder_id} 
                onChange={e => setConfig({...config, folder_id: e.target.value})}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Chuỗi ký tự trong URL thư mục (ví dụ: 1ABC-xyz...)
              </p>
            </div>
            
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '600' }}>
                <Key size={14} /> Client ID (OAuth 2.0)
              </label>
              <input 
                type="text" 
                placeholder="Điền Client ID từ Google Console..." 
                value={config.client_id} 
                onChange={e => setConfig({...config, client_id: e.target.value})}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ background: '#f8fafc', border: '1px dashed var(--border)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={18} /> Hướng dẫn lấy thông tin (OAuth 2.0)
        </h3>
        <ul style={{ fontSize: '0.875rem', color: 'var(--text-main)', paddingLeft: '1.25rem', lineHeight: '1.6' }}>
          <li>Truy cập <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud Console</a>.</li>
          <li>Bật <strong>Google Drive API</strong>.</li>
          <li>Tạo <strong>OAuth Client ID</strong> (Loại ứng dụng Web).</li>
          <li>Thêm URL trang web này vào mục <strong>Authorized JavaScript Origins</strong>.</li>
          <li>Copy Client ID dán vào ô bên trên và Lưu.</li>
        </ul>
      </div>
    </div>
  );
}

export default Config;

