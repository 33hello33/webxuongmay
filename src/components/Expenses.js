import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, X, Search, Calendar, DollarSign, User, Receipt, Trash2, Edit, Wallet, History } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { createPortal } from 'react-dom';

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(null); // 'add' or 'edit'
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilterType, setDateFilterType] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [openingBalance, setOpeningBalance] = useState({ viet: 0, hoa: 0, hkd: 0, ngaylap: null });
  const [viewMode, setViewMode] = useState('history'); // 'history' or 'balance'
  const [showBalancePortal, setShowBalancePortal] = useState(false);
  const [showBalanceHistoryPortal, setShowBalanceHistoryPortal] = useState(false);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [balanceFormData, setBalanceFormData] = useState({
    viet: '',
    hoa: '',
    hkd: '',
    reason: ''
  });

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    payer: '',
    purpose: '',
    type: 'Chi'
  });

  useEffect(() => {
    fetchExpenses();
    fetchOpeningBalance();
  }, []);

  const fetchOpeningBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('tbl_tiendauky')
        .select('*')
        .order('id', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setOpeningBalance({
          viet: parseFloat(data[0].viet) || 0,
          hoa: parseFloat(data[0].hoa) || 0,
          hkd: parseFloat(data[0].hkd) || 0,
          ngaylap: data[0].ngaylap
        });
      }
    } catch (err) {
      console.error('Error fetching opening balance:', err);
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    if (data) setExpenses(data);
    if (error) console.error('Error fetching expenses:', error);
    setLoading(false);
  };
  const handleSaveOpeningBalance = async (e) => {
    e.preventDefault();
    setLoading(true);

    const newData = {
      viet: balanceFormData.viet.toString().replace(/[^\d]/g, '') || openingBalance.viet.toString(),
      hoa: balanceFormData.hoa.toString().replace(/[^\d]/g, '') || openingBalance.hoa.toString(),
      hkd: balanceFormData.hkd.toString().replace(/[^\d]/g, '') || openingBalance.hkd.toString(),
      nguoilap: 'Admin',
      ngaylap: new Date().toISOString()
    };

    // Record the balance adjustment history
    const historyData = {
      noidung: balanceFormData.reason || 'Cân đối định kỳ',
      viet: { old: openingBalance.viet, new: parseFloat(newData.viet) },
      hoa: { old: openingBalance.hoa, new: parseFloat(newData.hoa) },
      hkd: { old: openingBalance.hkd, new: parseFloat(newData.hkd) },
      nguoilap: 'Admin'
    };

    const { error: err1 } = await supabase.from('tbl_tiendauky').insert([newData]);
    const { error: err2 } = await supabase.from('tbl_candoidongtien').insert([historyData]);

    if (!err1 && !err2) {
      setShowBalancePortal(false);
      fetchOpeningBalance();
      alert('Cân đối dòng tiền thành công!');
    } else {
      alert('Lỗi: ' + (err1?.message || err2?.message));
    }
    setLoading(false);
  };

  const fetchBalanceHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tbl_candoidongtien')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setBalanceHistory(data);
    if (error) console.error('Error fetching balance history:', error);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    const expenseData = {
      ...formData,
      amount: parseFloat(formData.amount.toString().replace(/[^\d]/g, '')) || 0
    };

    if (showModal === 'add') {
      const { error } = await supabase.from('expenses').insert([expenseData]);
      if (!error) {
        setShowModal(null);
        fetchExpenses();
        resetForm();
      } else {
        alert('Lỗi khi thêm chi phí: ' + error.message);
      }
    } else if (showModal === 'edit') {
      const { error } = await supabase
        .from('expenses')
        .update(expenseData)
        .eq('id', selectedExpense.id);

      if (!error) {
        setShowModal(null);
        fetchExpenses();
        resetForm();
      } else {
        alert('Lỗi khi cập nhật chi phí: ' + error.message);
      }
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa khoản chi này?')) {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (!error) fetchExpenses();
    }
  };

  const handleEdit = (expense) => {
    setSelectedExpense(expense);
    setFormData({
      date: expense.date,
      amount: expense.amount.toString(),
      payer: expense.payer,
      purpose: expense.purpose,
      type: expense.type || 'Chi'
    });
    setShowModal('edit');
  };

  const formatAmount = (val) => {
    if (!val) return '';
    const num = val.toString().replace(/[^\d]/g, '');
    return new Intl.NumberFormat('en-US').format(num);
  };

  const resetForm = (type = 'Chi') => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      payer: '',
      purpose: '',
      type: type
    });
    setSelectedExpense(null);
  };

  const today = new Date();
  const currentYearMonth = format(today, 'yyyy-MM');
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastYearMonth = format(lastMonthDate, 'yyyy-MM');

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = (exp.purpose?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (exp.payer?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    
    let matchesDate = true;
    if (dateFilterType === 'this_month') {
      matchesDate = exp.date?.startsWith(currentYearMonth);
    } else if (dateFilterType === 'last_month') {
      matchesDate = exp.date?.startsWith(lastYearMonth);
    } else if (dateFilterType === 'custom') {
      if (fromDate && exp.date < fromDate) matchesDate = false;
      if (toDate && exp.date > toDate) matchesDate = false;
    }
    
    return matchesSearch && matchesDate;
  });

  const totalChi = filteredExpenses.filter(e => e.type !== 'Thu').reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
  const totalThu = filteredExpenses.filter(e => e.type === 'Thu').reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

  const calculateCurrentBalance = (personKey, initial) => {
    const personName = personKey.toLowerCase();
    const thu = expenses
      .filter(e => e.type === 'Thu' && e.payer?.toLowerCase().includes(personName))
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const chi = expenses
      .filter(e => e.type !== 'Thu' && e.payer?.toLowerCase().includes(personName))
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    return initial + thu - chi;
  };

  const walletBalances = {
    viet: calculateCurrentBalance('việt', openingBalance.viet),
    hoa: calculateCurrentBalance('hoa', openingBalance.hoa),
    hkd: calculateCurrentBalance('hkd', openingBalance.hkd)
  };

  return (
    <div className="fade-in">
      <div className="expenses-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Sổ thu chi</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Quản lý các khoản thu và chi tiêu của xưởng</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="card" style={{ padding: '0 12px', height: '42px', display: 'flex', alignItems: 'center', margin: 0, background: '#f8fafc', border: '1px solid var(--border)' }}>
              <Calendar size={18} color="var(--text-muted)" style={{ marginRight: '8px' }} />
              <select 
                value={dateFilterType} 
                onChange={e => setDateFilterType(e.target.value)}
                style={{ height: '100%', border: 'none', outline: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-main)', fontSize: '0.875rem', fontWeight: '600' }}
              >
                <option value="all">Tất cả thời gian</option>
                <option value="this_month">Tháng này</option>
                <option value="last_month">Tháng trước</option>
                <option value="custom">Tùy chọn...</option>
              </select>
            </div>

            {dateFilterType === 'custom' && (
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 1rem', margin: 0, height: '42px', border: '1px solid var(--border)' }}>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.875rem' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>-</span>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.875rem' }}
                />
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }} onClick={() => { resetForm('Thu'); setShowModal('add'); }}>
            <Plus size={18} style={{ marginRight: '4px' }} /> Phiếu thu
          </button>
          <button className="btn btn-primary" onClick={() => { resetForm('Chi'); setShowModal('add'); }}>
            <Plus size={18} style={{ marginRight: '4px' }} /> Phiếu chi
          </button>
        </div>
      </div>

      <div className="expenses-top-section" style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', alignItems: 'flex-start' }}>
        {/* Left Side: Controls */}
        <div className="card expenses-controls-card" style={{ width: '220px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', flexShrink: 0 }}>
          <div className="expenses-controls-info" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Ngày mốc:</div>
            <div style={{ fontWeight: '700', fontSize: '1.125rem', color: 'var(--text-main)' }}>
              {openingBalance.ngaylap ? format(new Date(openingBalance.ngaylap), 'dd/MM/yyyy') : '--/--/----'}
            </div>
          </div>
          
          <div className="expenses-controls-btns" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button 
              onClick={() => {
                setBalanceFormData({
                  viet: walletBalances.viet.toString(),
                  hoa: walletBalances.hoa.toString(),
                  hkd: walletBalances.hkd.toString(),
                  reason: ''
                });
                setShowBalancePortal(true);
              }}
              className="btn" 
              style={{ 
                width: '100%', 
                padding: '1rem',
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '8px',
                background: '#8b5cf6',
                color: 'white',
                transition: 'all 0.2s',
                border: 'none',
                height: 'auto',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
              }}
            >
              <Wallet size={20} />
              <span style={{ fontSize: '0.875rem', fontWeight: '700', lineHeight: '1.2' }}>Cân Đối<br/>Dòng Tiền</span>
            </button>
            <button 
              onClick={() => {
                fetchBalanceHistory();
                setShowBalanceHistoryPortal(true);
              }}
              className="btn" 
              style={{ 
                width: '100%', 
                padding: '1rem',
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '8px',
                background: '#475569',
                color: 'white',
                transition: 'all 0.2s',
                border: 'none',
                height: 'auto'
              }}
            >
              <History size={20} />
              <span style={{ fontSize: '0.875rem', fontWeight: '700', lineHeight: '1.2' }}>Lịch Sử<br/>Cân Đối</span>
            </button>
          </div>
        </div>

        {/* Right Side: Stat Cards & Wallet Cards */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Original Stat Cards Row */}
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div className="card stats-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
              <div style={{ background: '#ecfdf5', color: '#059669', padding: '12px', borderRadius: '12px' }}>
                <DollarSign size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Tổng thu</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#059669' }}>
                  +{new Intl.NumberFormat('en-US').format(totalThu)} đ
                </div>
              </div>
            </div>
            <div className="card stats-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
              <div style={{ background: '#fff1f2', color: '#e11d48', padding: '12px', borderRadius: '12px' }}>
                <DollarSign size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Tổng chi</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#e11d48' }}>
                  -{new Intl.NumberFormat('en-US').format(totalChi)} đ
                </div>
              </div>
            </div>
            <div className="card stats-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
              <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '12px', color: 'var(--primary)' }}>
                <Receipt size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Số dư</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: (totalThu - totalChi) >= 0 ? '#059669' : '#e11d48' }}>
                  {(totalThu - totalChi) >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US').format(totalThu - totalChi)} đ
                </div>
              </div>
            </div>
          </div>

          {/* New Personal Wallet Cards Row */}
          <div className="wallet-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {/* Wallet VIỆT */}
            <div className="card wallet-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: '4px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="wallet-card-label" style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>VIỆT:</span>
                <span className="wallet-card-value" style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                  {new Intl.NumberFormat('en-US').format(openingBalance.viet)}
                </span>
              </div>
              <div className="wallet-card-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <span className="wallet-card-label" style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>HIỆN TẠI:</span>
                <span className="wallet-card-value" style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {new Intl.NumberFormat('en-US').format(walletBalances.viet)}
                </span>
              </div>
            </div>

            {/* Wallet HOA */}
            <div className="card wallet-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: '4px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="wallet-card-label" style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>HOA:</span>
                <span className="wallet-card-value" style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                  {new Intl.NumberFormat('en-US').format(openingBalance.hoa)}
                </span>
              </div>
              <div className="wallet-card-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <span className="wallet-card-label" style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>HIỆN TẠI:</span>
                <span className="wallet-card-value" style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {new Intl.NumberFormat('en-US').format(walletBalances.hoa)}
                </span>
              </div>
            </div>

            {/* Wallet HKD */}
            <div className="card wallet-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: '4px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="wallet-card-label" style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>HKD:</span>
                <span className="wallet-card-value" style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                  {new Intl.NumberFormat('en-US').format(openingBalance.hkd)}
                </span>
              </div>
              <div className="wallet-card-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <span className="wallet-card-label" style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>HIỆN TẠI:</span>
                <span className="wallet-card-value" style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {new Intl.NumberFormat('en-US').format(walletBalances.hkd)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'history' && (
        <>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
            <div className="search-box card" style={{ flex: '1 1 400px', maxWidth: '600px', padding: '0', display: 'flex', alignItems: 'stretch', margin: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', flex: 1 }}>
                <Search size={20} color="var(--text-muted)" style={{ marginRight: '10px' }} />
                <input
                  type="text"
                  placeholder="Tìm theo nội dung, người thực hiện..."
                  style={{ border: 'none', background: 'transparent', padding: '0.75rem 0', width: '100%', outline: 'none', minWidth: '150px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && <X size={16} onClick={() => setSearchQuery('')} style={{ cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '10px' }} />}
              </div>
            </div>
          </div>
        </>
      )}

      {viewMode === 'history' && (
        <>
          <div className="desktop-only card" style={{ padding: '0', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Ngày</th>
                  <th style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Loại</th>
                  <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Nội dung</th>
                  <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Người thực hiện</th>
                  <th style={{ textAlign: 'right', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Số tiền</th>
                  <th style={{ textAlign: 'right', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(exp => (
                  <tr key={exp.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      {format(new Date(exp.date), 'dd/MM/yyyy')}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '4px 8px', borderRadius: '4px', background: exp.type === 'Thu' ? '#ecfdf5' : '#fff1f2', color: exp.type === 'Thu' ? '#059669' : '#e11d48' }}>
                        {exp.type === 'Thu' ? 'THU' : 'CHI'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600' }}>{exp.purpose}</div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={14} />
                        </div>
                        {exp.payer}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: exp.type === 'Thu' ? '#059669' : '#e11d48' }}>
                      {exp.type === 'Thu' ? '+' : '-'}{new Intl.NumberFormat('en-US').format(exp.amount)} đ
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button className="btn" style={{ padding: '6px', background: '#f8fafc', border: '1px solid var(--border)' }} onClick={() => handleEdit(exp)} title="Sửa">
                          <Edit size={16} />
                        </button>
                        <button className="btn" style={{ padding: '6px', background: '#fff1f2', color: '#e11d48', border: '1px solid #fee2e2' }} onClick={() => handleDelete(exp.id)} title="Xóa">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredExpenses.map(exp => (
              <div key={exp.id} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {format(new Date(exp.date), 'dd/MM/yyyy')}
                      <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: exp.type === 'Thu' ? '#ecfdf5' : '#fff1f2', color: exp.type === 'Thu' ? '#059669' : '#e11d48' }}>
                        {exp.type === 'Thu' ? 'THU' : 'CHI'}
                      </span>
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>{exp.purpose}</div>
                  </div>
                  <div style={{ fontWeight: '800', fontSize: '1.125rem', color: exp.type === 'Thu' ? '#059669' : '#e11d48' }}>
                    {exp.type === 'Thu' ? '+' : '-'}{new Intl.NumberFormat('en-US').format(exp.amount)} đ
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    <User size={14} />
                    <span>{exp.payer}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn" style={{ padding: '6px 12px', background: '#f8fafc', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }} onClick={() => handleEdit(exp)}>
                      <Edit size={14} /> Sửa
                    </button>
                    <button className="btn" style={{ padding: '6px 12px', background: '#fff1f2', color: '#e11d48', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }} onClick={() => handleDelete(exp.id)}>
                      <Trash2 size={14} /> Xóa
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredExpenses.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              {loading ? 'Đang tải dữ liệu...' : 'Không có dữ liệu chi phí nào'}
            </div>
          )}
        </>
      )}

      {showModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <button className="modal-close" onClick={() => setShowModal(null)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}>
              {showModal === 'add' ? (formData.type === 'Thu' ? 'Thêm khoản thu mới' : 'Thêm khoản chi mới') : (formData.type === 'Thu' ? 'Sửa khoản thu' : 'Sửa khoản chi')}
            </h2>

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>
                    <Calendar size={14} /> Ngày {formData.type === 'Thu' ? 'thu' : 'chi'}
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>
                    <DollarSign size={14} /> Số tiền (đ)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 500.000"
                    required
                    value={formatAmount(formData.amount)}
                    onChange={e => setFormData({ ...formData, amount: e.target.value.replace(/[^\d]/g, '') })}
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>
                    <User size={14} /> {formData.type === 'Thu' ? 'Người nộp' : 'Người chi'}
                  </label>
                  <input
                    type="text"
                    placeholder={formData.type === 'Thu' ? 'Tên người nộp' : 'Tên người chi'}
                    required
                    value={formData.payer}
                    onChange={e => setFormData({ ...formData, payer: e.target.value })}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    {['Việt', 'Hoa', 'HKD'].map(name => (
                      <button 
                        key={name} 
                        type="button" 
                        onClick={() => setFormData({ ...formData, payer: name })}
                        style={{ 
                          padding: '4px 12px', 
                          fontSize: '0.75rem', 
                          borderRadius: '20px', 
                          background: formData.payer === name ? 'var(--primary)' : '#f1f5f9', 
                          color: formData.payer === name ? 'white' : 'var(--text-main)', 
                          border: '1px solid var(--border)',
                          cursor: 'pointer'
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>
                    <Receipt size={14} /> Nội dung {formData.type === 'Thu' ? 'thu' : 'chi'}
                  </label>
                  <textarea
                    placeholder={formData.type === 'Thu' ? 'Nhập nguồn thu...' : 'Nhập lý do chi tiêu...'}
                    required
                    rows="3"
                    value={formData.purpose}
                    onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', gap: '10px' }}>
                <button type="button" className="btn" style={{ flex: 1, background: '#f1f5f9' }} onClick={() => setShowModal(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? 'Đang xử lý...' : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {showBalancePortal && createPortal(
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowBalancePortal(false)}>
              <X size={20} />
            </button>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>Cân Đối Dòng Tiền</h2>
            </div>

            <form onSubmit={handleSaveOpeningBalance}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" style={{ background: '#f8fafc', padding: '1rem' }}>
                  <label style={{ color: 'var(--text-main)', fontWeight: '700' }}>Nội dung cân đối</label>
                  <input 
                    placeholder="Lý do cân đối số dư..." 
                    value={balanceFormData.reason}
                    onChange={e => setBalanceFormData({...balanceFormData, reason: e.target.value})}
                    style={{ background: 'white' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Card Việt */}
                  <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>VIỆT</div>
                    <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                      <span>Đầu kỳ:</span>
                      <span>{new Intl.NumberFormat('en-US').format(openingBalance.viet)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: '#0ea5e9' }}>
                      <span>Sổ sách:</span>
                      <span style={{ fontWeight: '700' }}>{new Intl.NumberFormat('en-US').format(walletBalances.viet)}</span>
                    </div>
                    <input 
                      type="text" 
                      value={formatAmount(balanceFormData.viet)}
                      onChange={e => setBalanceFormData({...balanceFormData, viet: e.target.value.replace(/[^\d]/g, '')})}
                      style={{ marginTop: '12px', textAlign: 'center', fontWeight: '800', fontSize: '1.125rem', color: '#8b5cf6', borderColor: '#8b5cf6' }}
                    />
                  </div>

                  {/* Card Hoa */}
                  <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>HOA</div>
                    <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                      <span>Đầu kỳ:</span>
                      <span>{new Intl.NumberFormat('en-US').format(openingBalance.hoa)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: '#0ea5e9' }}>
                      <span>Sổ sách:</span>
                      <span style={{ fontWeight: '700' }}>{new Intl.NumberFormat('en-US').format(walletBalances.hoa)}</span>
                    </div>
                    <input 
                      type="text" 
                      value={formatAmount(balanceFormData.hoa)}
                      onChange={e => setBalanceFormData({...balanceFormData, hoa: e.target.value.replace(/[^\d]/g, '')})}
                      style={{ marginTop: '12px', textAlign: 'center', fontWeight: '800', fontSize: '1.125rem', color: '#8b5cf6', borderColor: '#8b5cf6' }}
                    />
                  </div>

                  {/* Card HKD */}
                  <div className="card" style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>HKD</div>
                    <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                      <span>Đầu kỳ:</span>
                      <span>{new Intl.NumberFormat('en-US').format(openingBalance.hkd)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', color: '#0ea5e9' }}>
                      <span>Sổ sách:</span>
                      <span style={{ fontWeight: '700' }}>{new Intl.NumberFormat('en-US').format(walletBalances.hkd)}</span>
                    </div>
                    <input 
                      type="text" 
                      value={formatAmount(balanceFormData.hkd)}
                      onChange={e => setBalanceFormData({...balanceFormData, hkd: e.target.value.replace(/[^\d]/g, '')})}
                      style={{ marginTop: '12px', textAlign: 'center', fontWeight: '800', fontSize: '1.125rem', color: '#8b5cf6', borderColor: '#8b5cf6' }}
                    />
                  </div>
                </div>

                <div style={{ background: '#fffbeb', padding: '1rem', borderRadius: '12px', border: '1px solid #fef3c7' }}>
                  <p style={{ fontSize: '0.875rem', color: '#92400e', lineHeight: '1.5' }}>
                    Cập nhật số tiền <strong>Đầu kỳ mới</strong> để hệ thống bắt đầu thống kê lại theo mốc thực tế.
                  </p>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  style={{ 
                    width: '100%', 
                    padding: '1rem', 
                    borderRadius: '12px', 
                    background: '#8b5cf6', 
                    color: 'white', 
                    fontWeight: '800', 
                    fontSize: '1rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
                  }}
                >
                  {loading ? 'Đang xử lý...' : 'Xác Nhận Cân Đối'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showBalanceHistoryPortal && createPortal(
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowBalanceHistoryPortal(false)}>
              <X size={20} />
            </button>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>Lịch Sử Cân Đối Số Dư</h2>
              <p style={{ color: 'var(--text-muted)' }}>Chi tiết các lần điều chỉnh tiền đầu kỳ</p>
            </div>

            <div style={{ position: 'relative', paddingLeft: '2rem' }}>
              {/* Vertical Line */}
              <div style={{ position: 'absolute', left: '7px', top: '0', bottom: '0', width: '2px', background: '#e2e8f0' }}></div>

              {balanceHistory.map((h, idx) => (
                <div key={h.id} style={{ position: 'relative', marginBottom: '2.5rem' }}>
                  {/* Tree Node Dot */}
                  <div style={{ 
                    position: 'absolute', 
                    left: '-2rem', 
                    top: '0', 
                    width: '16px', 
                    height: '16px', 
                    borderRadius: '50%', 
                    background: idx === 0 ? '#8b5cf6' : 'white', 
                    border: '3px solid #8b5cf6',
                    zIndex: 1
                  }}></div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                        {format(new Date(h.created_at), 'dd/MM/yyyy HH:mm')}
                      </span>
                      <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>{h.noidung}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>bởi {h.nguoilap}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                      {['viet', 'hoa', 'hkd'].map(key => (
                        <div key={key} className="card" style={{ padding: '0.75rem 1rem', background: '#fcfdff', boxShadow: 'none', border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{key}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                              {new Intl.NumberFormat('en-US').format(h[key]?.old || 0)}
                            </span>
                            <span style={{ fontSize: '0.875rem', color: '#8b5cf6', fontWeight: '800' }}>
                              → {new Intl.NumberFormat('en-US').format(h[key]?.new || 0)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {balanceHistory.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  {loading ? 'Đang tải dữ liệu...' : 'Chưa có lịch sử cân đối nào'}
                </div>
              )}
            </div>
            <div style={{ marginTop: '2rem', textAlign: 'right' }}>
              <button className="btn" style={{ background: '#f1f5f9' }} onClick={() => setShowBalanceHistoryPortal(false)}>Đóng</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Expenses;
