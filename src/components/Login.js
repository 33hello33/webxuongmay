import React, { useState } from 'react';
import { supabase } from '../supabase';
import { LogIn, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('tbl_nv')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .eq('trangthai', 'Đang Làm')
        .single();

      if (fetchError) {
        throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
      }

      if (data) {
        onLogin(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-header">
          <div className="login-logo">Xưởng May Vanni</div>
          <h1>Đăng nhập hệ thống</h1>
          <p>Hệ thống quản lý kho & doanh thu</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Tên đăng nhập</label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input
                id="username"
                type="text"
                placeholder="Nhập username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                type="password"
                placeholder="Nhập password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Đang kiểm tra...</span>
              </>
            ) : (
              <>
                <LogIn size={20} />
                <span>Đăng nhập</span>
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          &copy; {new Date().getFullYear()} Xưởng May Vanni. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Login;
