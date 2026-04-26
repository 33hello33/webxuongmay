import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, X, Search, Calendar, DollarSign, User, Receipt, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { createPortal } from 'react-dom';

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(null); // 'add' or 'edit'
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    payer: '',
    purpose: ''
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

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
      purpose: expense.purpose
    });
    setShowModal('edit');
  };

  const formatAmount = (val) => {
    if (!val) return '';
    const num = val.toString().replace(/[^\d]/g, '');
    return new Intl.NumberFormat('en-US').format(num);
  };

  const resetForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      payer: '',
      purpose: ''
    });
    setSelectedExpense(null);
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = (exp.purpose?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                          (exp.payer?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesDate = filterDate ? exp.date === filterDate : true;
    return matchesSearch && matchesDate;
  });

  const totalAmount = filteredExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Chi phí đã chi</h1>
          <p style={{ color: 'var(--text-muted)' }}>Quản lý các khoản chi tiêu của xưởng</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal('add'); }}>
          <Plus size={18} style={{ marginRight: '8px' }} /> Thêm khoản chi mới
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '12px', color: 'var(--primary)' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Tổng chi phí (lọc)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
              {new Intl.NumberFormat('en-US').format(totalAmount)} đ
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="search-box card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '300px', margin: 0 }}>
          <Search size={20} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Tìm theo mục đích chi, người chi..."
            style={{ border: 'none', background: 'transparent', padding: '0.5rem 0', width: '100%' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <Calendar size={20} color="var(--text-muted)" />
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-main)', outline: 'none' }}
          />
          {filterDate && <X size={16} onClick={() => setFilterDate('')} style={{ cursor: 'pointer', color: '#ef4444' }} />}
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Ngày chi</th>
              <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Mục đích chi</th>
              <th style={{ textAlign: 'left', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Người chi</th>
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
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: '#e11d48' }}>
                  {new Intl.NumberFormat('en-US').format(exp.amount)} đ
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
            {filteredExpenses.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  {loading ? 'Đang tải dữ liệu...' : 'Không có dữ liệu chi phí nào'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(null)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}>
              {showModal === 'add' ? 'Thêm khoản chi mới' : 'Sửa khoản chi'}
            </h2>

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>
                    <Calendar size={14} /> Ngày chi
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
                    <User size={14} /> Người chi
                  </label>
                  <input 
                    type="text" 
                    placeholder="Tên người chi" 
                    required 
                    value={formData.payer} 
                    onChange={e => setFormData({ ...formData, payer: e.target.value })} 
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.875rem', fontWeight: '500' }}>
                    <Receipt size={14} /> Mục đích chi
                  </label>
                  <textarea 
                    placeholder="Nhập lý do chi tiêu..." 
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
    </div>
  );
}

export default Expenses;
