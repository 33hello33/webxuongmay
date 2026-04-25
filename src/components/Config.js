import React from 'react';
import { Cloud, Info, Database } from 'lucide-react';

function Config() {
  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Cấu hình hệ thống</h1>
          <p style={{ color: 'var(--text-muted)' }}>Quản lý lưu trữ và tài liệu</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <Database size={24} color="var(--primary)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Lưu trữ hình ảnh</h2>
        </div>

        <div style={{ padding: '1rem', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
          <p style={{ color: '#0369a1', fontSize: '1rem', fontWeight: '500', marginBottom: '0.5rem' }}>
            Hệ thống đang sử dụng Supabase Storage (assets bucket)
          </p>
          <p style={{ color: '#0c4a6e', fontSize: '0.875rem' }}>
            Toàn bộ hình ảnh sản phẩm và vật liệu được lưu trữ trực tiếp trên hạ tầng Supabase để đảm bảo tốc độ tải nhanh và ổn định nhất.
          </p>
        </div>
      </div>

      <div className="card" style={{ background: '#f8fafc', border: '1px dashed var(--border)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={18} /> Ghi chú về bộ nhớ
        </h3>
        <ul style={{ fontSize: '0.875rem', color: 'var(--text-main)', paddingLeft: '1.25rem', lineHeight: '1.6' }}>
          <li>Ảnh được nén tự động xuống dưới 100KB trước khi tải lên.</li>
          <li>Định dạng khuyên dùng: JPG, PNG, WEBP.</li>
          <li>Bạn không cần phải cấu hình Google Drive như trước đây.</li>
        </ul>
      </div>
    </div>
  );
}

export default Config;

