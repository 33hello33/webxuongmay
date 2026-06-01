import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { CalendarDays, Clock3, FileText, RefreshCcw, Settings2, Users } from 'lucide-react';
import { eachDayOfInterval, endOfMonth, format, isSunday, startOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';

const DEFAULT_DAILY_HOURS = 8;
const DEFAULT_OVERTIME_MULTIPLIER = 1.5;

const DEFAULT_CONFIG = {
  hourlyRate: '',
  overtimeMultiplier: DEFAULT_OVERTIME_MULTIPLIER.toString()
};

const DEFAULT_MONTHLY_DATA = {
  allowance: '',
  bonus: '',
  penalty: '',
  note: ''
};

const QUICK_HOUR_TAGS = [1, 2, 3];
const QUICK_MINUTE_TAGS = [10, 20, 30, 40, 50];

const parseNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = Number.parseFloat(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const sanitizeMoneyInput = (value) => value.replace(/[^\d]/g, '');

const formatMoneyInput = (value) => {
  const sanitized = sanitizeMoneyInput(String(value || ''));
  if (!sanitized) return '';
  return new Intl.NumberFormat('en-US').format(Number(sanitized));
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(parseNumber(value, 0));

const formatHourValue = (value) => {
  const numeric = parseNumber(value, 0);
  return Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(1);
};

const getMonthDates = (monthValue) => {
  const monthDate = new Date(`${monthValue}-01T00:00:00`);
  return eachDayOfInterval({
    start: startOfMonth(monthDate),
    end: endOfMonth(monthDate)
  });
};

const getPayrollMonthDate = (monthValue) => `${monthValue}-01`;
const getAttendanceKey = (employeeCode, date) => `${employeeCode}__${date}`;
const getMonthlyKey = (employeeCode, month) => `${employeeCode}__${month}`;

const getCurrentSessionUser = () => {
  try {
    const raw = localStorage.getItem('app_session');
    return raw ? JSON.parse(raw).user : null;
  } catch (error) {
    return null;
  }
};

const extractDurationParts = (value) => {
  const raw = String(value || '').trim();

  if (!raw) {
    return { sign: 1, hours: 0, minutes: 0 };
  }

  const sign = raw.startsWith('-') ? -1 : 1;
  const normalized = raw.replace(/^-/, '');
  const hourMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*giờ/i);
  const minuteMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*phút/i);

  if (!hourMatch && !minuteMatch && /^-?\d+(?:[.,]\d+)?$/.test(raw)) {
    const numericHours = Math.abs(parseFloat(raw.replace(',', '.')));
    const wholeHours = Math.floor(numericHours);
    const remainingMinutes = Math.round((numericHours - wholeHours) * 60);
    return { sign, hours: wholeHours, minutes: remainingMinutes };
  }

  return {
    sign,
    hours: hourMatch ? parseInt(hourMatch[1], 10) : 0,
    minutes: minuteMatch ? parseInt(minuteMatch[1], 10) : 0
  };
};

const buildDurationText = ({ sign = 1, hours = 0, minutes = 0 }) => {
  const parts = [];

  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0) parts.push(`${minutes} phút`);

  if (parts.length === 0) return '';

  const text = parts.join(' ');
  return sign < 0 ? `-${text}` : text;
};

const toDecimalHoursFromText = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 0;

  if (/^-?\d+(?:[.,]\d+)?$/.test(raw)) {
    return parseFloat(raw.replace(',', '.'));
  }

  const { sign, hours, minutes } = extractDurationParts(raw);
  return sign * (hours + minutes / 60);
};

const updateDurationText = (currentValue, type, amount) => {
  const currentParts = extractDurationParts(currentValue);
  const nextParts = {
    sign: 1,
    hours: type === 'hours' ? amount : currentParts.hours,
    minutes: type === 'minutes' ? amount : currentParts.minutes
  };

  return buildDurationText(nextParts);
};

const getEffectiveMonthEnd = (monthValue) => {
  const today = new Date();
  const currentMonth = format(today, 'yyyy-MM');

  if (monthValue < currentMonth) {
    return endOfMonth(new Date(`${monthValue}-01T00:00:00`));
  }

  if (monthValue > currentMonth) {
    return null;
  }

  return today;
};

const normalizeAttendanceRecord = (record) => {
  const isDayOff = Boolean(record?.isDayOff);
  const adjustmentText = isDayOff ? '' : String(record?.adjustmentText || '').trim();
  const note = String(record?.note || '').trim();

  if (!isDayOff && !adjustmentText && !note) {
    return null;
  }

  return {
    employeeCode: String(record.employeeCode),
    date: record.date,
    isDayOff,
    adjustmentText,
    note
  };
};

const calculateDayHours = (isDayOff, adjustmentText) => {
  if (isDayOff) {
    return {
      regularHours: 0,
      overtimeHours: 0,
      totalHours: 0
    };
  }

  const adjustment = toDecimalHoursFromText(adjustmentText);
  const regularHours = adjustment < 0 ? Math.max(DEFAULT_DAILY_HOURS + adjustment, 0) : DEFAULT_DAILY_HOURS;
  const overtimeHours = adjustment > 0 ? adjustment : 0;

  return {
    regularHours,
    overtimeHours,
    totalHours: regularHours + overtimeHours
  };
};

const calculateEmployeeSummary = ({ employeeCode, monthDates, monthValue, attendanceMap, payrollConfig, monthlyMap }) => {
  const effectiveMonthEnd = getEffectiveMonthEnd(monthValue);
  const monthlyData = {
    ...DEFAULT_MONTHLY_DATA,
    ...(monthlyMap[getMonthlyKey(employeeCode, monthValue)] || {})
  };

  let regularHours = 0;
  let overtimeHours = 0;
  let dayOffs = 0;
  let countedDays = 0;

  monthDates.forEach((date) => {
    if (!effectiveMonthEnd || date > effectiveMonthEnd) {
      return;
    }

    countedDays += 1;
    const dateKey = format(date, 'yyyy-MM-dd');
    const record = attendanceMap[getAttendanceKey(employeeCode, dateKey)];
    const isDayOff = Boolean(record?.isDayOff);
    const { regularHours: dailyRegular, overtimeHours: dailyOvertime } = calculateDayHours(isDayOff, record?.adjustmentText);

    if (isDayOff) {
      dayOffs += 1;
      return;
    }

    regularHours += dailyRegular;
    overtimeHours += dailyOvertime;
  });

  const hourlyRate = parseNumber(payrollConfig.hourlyRate, 0);
  const overtimeMultiplier = parseNumber(payrollConfig.overtimeMultiplier, DEFAULT_OVERTIME_MULTIPLIER) || DEFAULT_OVERTIME_MULTIPLIER;
  const allowance = parseNumber(monthlyData.allowance, 0);
  const bonus = parseNumber(monthlyData.bonus, 0);
  const penalty = parseNumber(monthlyData.penalty, 0);
  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * hourlyRate * overtimeMultiplier;
  const totalPay = regularPay + overtimePay + allowance + bonus - penalty;

  return {
    monthlyData,
    countedDays,
    workedDays: Math.max(countedDays - dayOffs, 0),
    dayOffs,
    regularHours,
    overtimeHours,
    hourlyRate,
    overtimeMultiplier,
    allowance,
    bonus,
    penalty,
    regularPay,
    overtimePay,
    totalPay
  };
};

const rollbackMapEntry = (setState, key, hadPrevious, previousValue) => {
  setState((previousMap) => {
    const nextMap = { ...previousMap };

    if (hadPrevious) {
      nextMap[key] = previousValue;
    } else {
      delete nextMap[key];
    }

    return nextMap;
  });
};

const downloadDataUrl = (dataUrl, fileName) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function AttendancePayroll() {
  const currentUser = useMemo(() => getCurrentSessionUser(), []);
  const isManager = (currentUser?.role || '').toLowerCase() === 'quản lý';

  const [employees, setEmployees] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState('');
  const [attendanceMap, setAttendanceMap] = useState({});
  const [monthlyMap, setMonthlyMap] = useState({});
  const [payrollConfig, setPayrollConfig] = useState(DEFAULT_CONFIG);
  const [, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingQuick, setSavingQuick] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [quickEntry, setQuickEntry] = useState({
    employeeCode: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    overtimeText: ''
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('tbl_nv')
        .select('manv, tennv, username, role, trangthai')
        .eq('trangthai', 'Đang Làm')
        .order('tennv');

      if (error) {
        console.error('Lỗi tải danh sách nhân viên:', error);
        setErrorMessage('Không tải được danh sách nhân viên.');
        setLoading(false);
        return;
      }

      const filteredEmployees = (data || []).filter((employee) => {
        const normalizedRole = (employee.role || '').toLowerCase();
        return normalizedRole !== 'quản lý';
      });

      const nextEmployees = (filteredEmployees.length > 0 ? filteredEmployees : (data || [])).filter((employee) => employee.manv);
      setEmployees(nextEmployees);
      setLoading(false);
    };

    fetchEmployees();
  }, []);

  useEffect(() => {
    if (!selectedEmployeeCode && employees.length > 0) {
      const preferredEmployee = employees.find((employee) => employee.manv === currentUser?.manv) || employees[0];
      setSelectedEmployeeCode(String(preferredEmployee.manv));
    }
  }, [currentUser?.manv, employees, selectedEmployeeCode]);

  useEffect(() => {
    if (!quickEntry.employeeCode && employees.length > 0) {
      const preferredEmployee = employees.find((employee) => employee.manv === currentUser?.manv) || employees[0];
      setQuickEntry((previous) => ({
        ...previous,
        employeeCode: String(preferredEmployee.manv)
      }));
    }
  }, [currentUser?.manv, employees, quickEntry.employeeCode]);

  useEffect(() => {
    if (!isManager && quickEntry.employeeCode && quickEntry.employeeCode !== selectedEmployeeCode) {
      setSelectedEmployeeCode(quickEntry.employeeCode);
    }
  }, [isManager, quickEntry.employeeCode, selectedEmployeeCode]);

  useEffect(() => {
    const fetchPayrollData = async () => {
      if (employees.length === 0) {
        setAttendanceMap({});
        setMonthlyMap({});
        setPayrollConfig(DEFAULT_CONFIG);
        return;
      }

      setLoading(true);
      setErrorMessage('');

      const employeeCodes = employees.map((employee) => employee.manv);
      const monthStart = getPayrollMonthDate(selectedMonth);
      const monthEnd = format(endOfMonth(new Date(`${selectedMonth}-01T00:00:00`)), 'yyyy-MM-dd');

      const [configResult, attendanceResult, monthlyResult] = await Promise.all([
        supabase
          .from('employee_payroll_configs')
          .select('hourly_rate, overtime_multiplier')
          .order('updated_at', { ascending: false })
          .limit(1),
        supabase
          .from('employee_attendance')
          .select('employee_manv, work_date, is_day_off, adjustment_hours, note')
          .in('employee_manv', employeeCodes)
          .gte('work_date', monthStart)
          .lte('work_date', monthEnd),
        supabase
          .from('employee_payroll_monthly')
          .select('employee_manv, allowance, bonus, penalty, note')
          .in('employee_manv', employeeCodes)
          .eq('payroll_month', monthStart)
      ]);

      const queryError = configResult.error || attendanceResult.error || monthlyResult.error;

      if (queryError) {
        console.error('Lỗi tải dữ liệu chấm công:', queryError);
        setErrorMessage('Không tải được dữ liệu chấm công.');
        setLoading(false);
        return;
      }

      const configRow = configResult.data?.[0];
      setPayrollConfig({
        hourlyRate: configRow?.hourly_rate?.toString() || '',
        overtimeMultiplier: configRow?.overtime_multiplier?.toString() || DEFAULT_OVERTIME_MULTIPLIER.toString()
      });

      const nextAttendanceMap = {};
      (attendanceResult.data || []).forEach((row) => {
        const normalizedRecord = normalizeAttendanceRecord({
          employeeCode: row.employee_manv,
          date: row.work_date,
          isDayOff: row.is_day_off,
          adjustmentText: row.adjustment_hours || '',
          note: row.note || ''
        });

        if (normalizedRecord) {
          nextAttendanceMap[getAttendanceKey(row.employee_manv, row.work_date)] = normalizedRecord;
        }
      });

      const nextMonthlyMap = {};
      (monthlyResult.data || []).forEach((row) => {
        nextMonthlyMap[getMonthlyKey(row.employee_manv, selectedMonth)] = {
          allowance: row.allowance?.toString() || '',
          bonus: row.bonus?.toString() || '',
          penalty: row.penalty?.toString() || '',
          note: row.note || ''
        };
      });

      setAttendanceMap(nextAttendanceMap);
      setMonthlyMap(nextMonthlyMap);
      setLoading(false);
    };

    fetchPayrollData();
  }, [employees, selectedMonth]);

  const monthDates = useMemo(() => getMonthDates(selectedMonth), [selectedMonth]);

  const employeeSummaries = useMemo(
    () =>
      employees.map((employee) => ({
        employee,
        summary: calculateEmployeeSummary({
          employeeCode: employee.manv,
          monthDates,
          monthValue: selectedMonth,
          attendanceMap,
          payrollConfig,
          monthlyMap
        })
      })),
    [employees, monthDates, selectedMonth, attendanceMap, payrollConfig, monthlyMap]
  );

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.manv) === String(selectedEmployeeCode)),
    [employees, selectedEmployeeCode]
  );

  const selectedSummary = useMemo(() => {
    if (!selectedEmployeeCode) return null;
    return calculateEmployeeSummary({
      employeeCode: selectedEmployeeCode,
      monthDates,
      monthValue: selectedMonth,
      attendanceMap,
      payrollConfig,
      monthlyMap
    });
  }, [selectedEmployeeCode, monthDates, selectedMonth, attendanceMap, payrollConfig, monthlyMap]);

  const selectedMonthlyData = {
    ...DEFAULT_MONTHLY_DATA,
    ...(monthlyMap[getMonthlyKey(selectedEmployeeCode, selectedMonth)] || {})
  };

  const handleAttendanceChange = async (date, changes) => {
    if (!selectedEmployeeCode) return;

    const dateKey = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    const recordKey = getAttendanceKey(selectedEmployeeCode, dateKey);
    const previousRecord = attendanceMap[recordKey];
    const currentRecord = previousRecord || {
      employeeCode: selectedEmployeeCode,
      date: dateKey,
      isDayOff: false,
      adjustmentText: '',
      note: ''
    };

    const nextRecord = normalizeAttendanceRecord({
      ...currentRecord,
      ...changes,
      employeeCode: selectedEmployeeCode,
      date: dateKey
    });

    setAttendanceMap((previousMap) => {
      const nextMap = { ...previousMap };

      if (nextRecord) {
        nextMap[recordKey] = nextRecord;
      } else {
        delete nextMap[recordKey];
      }

      return nextMap;
    });

    if (nextRecord) {
      const { error } = await supabase.from('employee_attendance').upsert(
        [
          {
            employee_manv: selectedEmployeeCode,
            work_date: dateKey,
            is_day_off: nextRecord.isDayOff,
            adjustment_hours: nextRecord.adjustmentText || null,
            note: nextRecord.note || null
          }
        ],
        { onConflict: 'employee_manv,work_date' }
      );

      if (error) {
        console.error('Lỗi lưu chấm công:', error);
        rollbackMapEntry(setAttendanceMap, recordKey, Boolean(previousRecord), previousRecord);
        alert(`Lỗi lưu chấm công: ${error.message}`);
      }

      return;
    }

    const { error } = await supabase
      .from('employee_attendance')
      .delete()
      .eq('employee_manv', selectedEmployeeCode)
      .eq('work_date', dateKey);

    if (error) {
      console.error('Lỗi xóa chấm công:', error);
      rollbackMapEntry(setAttendanceMap, recordKey, Boolean(previousRecord), previousRecord);
      alert(`Lỗi xóa chấm công: ${error.message}`);
    }
  };

  const handleGlobalConfigInputChange = (field, value) => {
    setPayrollConfig((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handleSaveGlobalConfig = async () => {
    if (employees.length === 0) return;

    setSavingConfig(true);

    const rows = employees.map((employee) => ({
      employee_manv: employee.manv,
      hourly_rate: parseNumber(payrollConfig.hourlyRate, 0),
      overtime_multiplier: parseNumber(payrollConfig.overtimeMultiplier, DEFAULT_OVERTIME_MULTIPLIER) || DEFAULT_OVERTIME_MULTIPLIER,
      default_daily_hours: DEFAULT_DAILY_HOURS,
      active: true
    }));

    const { error } = await supabase
      .from('employee_payroll_configs')
      .upsert(rows, { onConflict: 'employee_manv' });

    if (error) {
      console.error('Lỗi lưu cấu hình chung:', error);
      alert(`Lỗi lưu cấu hình chung: ${error.message}`);
    }

    setSavingConfig(false);
  };

  const handleMonthlyDataChange = async (field, value) => {
    if (!selectedEmployeeCode) return;

    const monthlyKey = getMonthlyKey(selectedEmployeeCode, selectedMonth);
    const previousMonthlyData = monthlyMap[monthlyKey];
    const nextMonthlyData = {
      ...DEFAULT_MONTHLY_DATA,
      ...(previousMonthlyData || {}),
      [field]: value
    };

    setMonthlyMap((previousMap) => ({
      ...previousMap,
      [monthlyKey]: nextMonthlyData
    }));

    const { error } = await supabase.from('employee_payroll_monthly').upsert(
      [
        {
          employee_manv: selectedEmployeeCode,
          payroll_month: getPayrollMonthDate(selectedMonth),
          allowance: parseNumber(nextMonthlyData.allowance, 0),
          bonus: parseNumber(nextMonthlyData.bonus, 0),
          penalty: parseNumber(nextMonthlyData.penalty, 0),
          note: nextMonthlyData.note || null
        }
      ],
      { onConflict: 'employee_manv,payroll_month' }
    );

    if (error) {
      console.error('Lỗi lưu lương tháng:', error);
      rollbackMapEntry(setMonthlyMap, monthlyKey, Boolean(previousMonthlyData), previousMonthlyData);
      alert(`Lỗi lưu lương tháng: ${error.message}`);
    }
  };

  const handleMarkSundaysOff = async () => {
    if (!selectedEmployeeCode) return;

    const previousMap = { ...attendanceMap };
    const nextMap = { ...attendanceMap };
    const rowsToUpsert = [];

    monthDates.forEach((date) => {
      if (!isSunday(date)) return;

      const dateKey = format(date, 'yyyy-MM-dd');
      const recordKey = getAttendanceKey(selectedEmployeeCode, dateKey);
      const nextRecord = {
        employeeCode: String(selectedEmployeeCode),
        date: dateKey,
        isDayOff: true,
        adjustmentText: '',
        note: attendanceMap[recordKey]?.note || ''
      };

      nextMap[recordKey] = nextRecord;
      rowsToUpsert.push({
        employee_manv: selectedEmployeeCode,
        work_date: dateKey,
        is_day_off: true,
        adjustment_hours: null,
        note: nextRecord.note || null
      });
    });

    setAttendanceMap(nextMap);

    if (rowsToUpsert.length === 0) return;

    const { error } = await supabase
      .from('employee_attendance')
      .upsert(rowsToUpsert, { onConflict: 'employee_manv,work_date' });

    if (error) {
      console.error('Lỗi đánh dấu ngày nghỉ:', error);
      setAttendanceMap(previousMap);
      alert(`Lỗi đánh dấu ngày nghỉ: ${error.message}`);
    }
  };

  const handleResetMonth = async () => {
    if (!selectedEmployeeCode) return;

    if (!window.confirm('Xóa toàn bộ chấm công ngoại lệ của nhân viên này trong tháng đã chọn?')) {
      return;
    }

    const previousMap = { ...attendanceMap };

    setAttendanceMap((previousMapState) => {
      const nextMap = { ...previousMapState };

      monthDates.forEach((date) => {
        delete nextMap[getAttendanceKey(selectedEmployeeCode, format(date, 'yyyy-MM-dd'))];
      });

      return nextMap;
    });

    const monthStart = getPayrollMonthDate(selectedMonth);
    const monthEnd = format(endOfMonth(new Date(`${selectedMonth}-01T00:00:00`)), 'yyyy-MM-dd');

    const { error } = await supabase
      .from('employee_attendance')
      .delete()
      .eq('employee_manv', selectedEmployeeCode)
      .gte('work_date', monthStart)
      .lte('work_date', monthEnd);

    if (error) {
      console.error('Lỗi khôi phục chấm công tháng:', error);
      setAttendanceMap(previousMap);
      alert(`Lỗi khôi phục chấm công tháng: ${error.message}`);
    }
  };

  const handleQuickTagClick = (type, amount) => {
    setQuickEntry((previous) => ({
      ...previous,
      overtimeText: updateDurationText(previous.overtimeText, type, amount)
    }));
  };

  const handleQuickAttendanceSave = async (event) => {
    event.preventDefault();

    if (!quickEntry.employeeCode || !quickEntry.date) return;

    setSavingQuick(true);

    const recordKey = getAttendanceKey(quickEntry.employeeCode, quickEntry.date);
    const previousRecord = attendanceMap[recordKey];
    const monthOfQuickEntry = quickEntry.date.slice(0, 7);
    const nextRecord = normalizeAttendanceRecord({
      employeeCode: quickEntry.employeeCode,
      date: quickEntry.date,
      isDayOff: false,
      adjustmentText: quickEntry.overtimeText,
      note: previousRecord?.note || ''
    });

    if (monthOfQuickEntry === selectedMonth) {
      setAttendanceMap((previousMap) => {
        const nextMap = { ...previousMap };

        if (nextRecord) {
          nextMap[recordKey] = nextRecord;
        } else {
          delete nextMap[recordKey];
        }

        return nextMap;
      });
    }

    if (nextRecord) {
      const { error } = await supabase.from('employee_attendance').upsert(
        [
          {
            employee_manv: quickEntry.employeeCode,
            work_date: quickEntry.date,
            is_day_off: false,
            adjustment_hours: nextRecord.adjustmentText,
            note: nextRecord.note || null
          }
        ],
        { onConflict: 'employee_manv,work_date' }
      );

      if (error) {
        console.error('Lỗi lưu chấm công nhanh:', error);
        if (monthOfQuickEntry === selectedMonth) {
          rollbackMapEntry(setAttendanceMap, recordKey, Boolean(previousRecord), previousRecord);
        }
        alert(`Lỗi lưu chấm công nhanh: ${error.message}`);
        setSavingQuick(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from('employee_attendance')
        .delete()
        .eq('employee_manv', quickEntry.employeeCode)
        .eq('work_date', quickEntry.date);

      if (error) {
        console.error('Lỗi xóa chấm công nhanh:', error);
        if (monthOfQuickEntry === selectedMonth) {
          rollbackMapEntry(setAttendanceMap, recordKey, Boolean(previousRecord), previousRecord);
        }
        alert(`Lỗi xóa chấm công nhanh: ${error.message}`);
        setSavingQuick(false);
        return;
      }
    }

    setQuickEntry((previous) => ({
      ...previous,
      overtimeText: ''
    }));
    setSavingQuick(false);
  };

  const handleExportPayroll = (employee, summary) => {
    const printWindow = window.open('', '_blank', 'width=960,height=720');

    if (!printWindow) {
      alert('Trình duyệt đang chặn cửa sổ in phiếu lương.');
      return;
    }

    const employeeName = employee?.tennv || employee?.username || 'Nhân viên';
    const createdAt = format(new Date(), 'dd/MM/yyyy HH:mm');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <title>Phiếu lương - ${employeeName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #0f172a;
              padding: 32px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 24px;
            }
            .title {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .meta {
              color: #475569;
              font-size: 14px;
            }
            .section {
              margin-top: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 10px 12px;
              text-align: left;
              font-size: 14px;
            }
            th {
              background: #f8fafc;
            }
            .total {
              font-size: 20px;
              font-weight: 700;
              color: #2563eb;
              text-align: right;
              margin-top: 20px;
            }
            .note {
              margin-top: 16px;
              padding: 12px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Phiếu lương nhân viên</div>
              <div class="meta">Tháng: ${selectedMonth}</div>
              <div class="meta">Nhân viên: ${employeeName}</div>
              <div class="meta">In lúc: ${createdAt}</div>
            </div>
            <div class="meta">Mặc định: ${DEFAULT_DAILY_HOURS} tiếng/ngày</div>
          </div>

          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Hạng mục</th>
                  <th>Giá trị</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Giờ công thường</td>
                  <td>${formatHourValue(summary.regularHours)} giờ x ${formatCurrency(summary.hourlyRate)}</td>
                  <td>${formatCurrency(summary.regularPay)}</td>
                </tr>
                <tr>
                  <td>Giờ tăng ca</td>
                  <td>${formatHourValue(summary.overtimeHours)} giờ x ${formatCurrency(summary.hourlyRate)} x ${formatHourValue(summary.overtimeMultiplier)}</td>
                  <td>${formatCurrency(summary.overtimePay)}</td>
                </tr>
                <tr>
                  <td>Phụ cấp</td>
                  <td>${formatCurrency(summary.allowance)}</td>
                  <td>${formatCurrency(summary.allowance)}</td>
                </tr>
                <tr>
                  <td>Thưởng</td>
                  <td>${formatCurrency(summary.bonus)}</td>
                  <td>${formatCurrency(summary.bonus)}</td>
                </tr>
                <tr>
                  <td>Phạt</td>
                  <td>${formatCurrency(summary.penalty)}</td>
                  <td>-${formatCurrency(summary.penalty).replace('₫', '').trim()} ₫</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Tổng ngày tính lương</th>
                  <th>Ngày nghỉ</th>
                  <th>Ngày đi làm</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${summary.countedDays}</td>
                  <td>${summary.dayOffs}</td>
                  <td>${summary.workedDays}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="total">Thực lĩnh: ${formatCurrency(summary.totalPay)}</div>

          <div class="note">
            Ghi chú: ${summary.monthlyData.note ? summary.monthlyData.note.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Không có'}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleDownloadAttendanceImage = (employee) => {
    const employeeCode = employee?.manv;
    if (!employeeCode) return;

    const canvas = document.createElement('canvas');
    const columns = [
      { key: 'date', label: 'Ngày', width: 160, align: 'left' },
      { key: 'working', label: 'Đi làm', width: 120, align: 'center' },
      { key: 'regular', label: 'Giờ công', width: 140, align: 'right' },
      { key: 'adjustment', label: '+/- giờ', width: 220, align: 'left' },
      { key: 'overtime', label: 'Tăng ca', width: 140, align: 'right' },
      { key: 'total', label: 'Tổng giờ', width: 140, align: 'right' },
      { key: 'note', label: 'Ghi chú', width: 360, align: 'left' }
    ];

    const rowHeight = 42;
    const headerHeight = 46;
    const titleHeight = 96;
    const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const canvasWidth = tableWidth + 48;
    const canvasHeight = titleHeight + headerHeight + monthDates.length * rowHeight + 48;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    context.fillStyle = '#0f172a';
    context.font = '700 28px Arial';
    context.fillText(`Bảng chấm công - ${employee.tennv || employee.username}`, 24, 38);
    context.fillStyle = '#475569';
    context.font = '16px Arial';
    context.fillText(`Tháng ${selectedMonth} | Mặc định ${DEFAULT_DAILY_HOURS} giờ/ngày`, 24, 66);

    const startX = 24;
    let currentX = startX;
    const tableTop = titleHeight;

    columns.forEach((column) => {
      context.fillStyle = '#f8fafc';
      context.fillRect(currentX, tableTop, column.width, headerHeight);
      context.strokeStyle = '#cbd5e1';
      context.strokeRect(currentX, tableTop, column.width, headerHeight);
      context.fillStyle = '#0f172a';
      context.font = '700 15px Arial';

      const textX =
        column.align === 'center'
          ? currentX + column.width / 2
          : column.align === 'right'
            ? currentX + column.width - 12
            : currentX + 12;

      context.textAlign = column.align === 'center' ? 'center' : column.align === 'right' ? 'right' : 'left';
      context.textBaseline = 'middle';
      context.fillText(column.label, textX, tableTop + headerHeight / 2);
      currentX += column.width;
    });

    monthDates.forEach((date, index) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const record = attendanceMap[getAttendanceKey(employeeCode, dateKey)];
      const isDayOff = Boolean(record?.isDayOff);
      const adjustmentText = record?.adjustmentText || '';
      const { regularHours, overtimeHours, totalHours } = calculateDayHours(isDayOff, adjustmentText);
      const rowTop = tableTop + headerHeight + index * rowHeight;
      const isStriped = index % 2 === 0;

      context.fillStyle = isStriped ? '#ffffff' : '#fbfdff';
      context.fillRect(startX, rowTop, tableWidth, rowHeight);

      currentX = startX;
      const rowValues = {
        date: `${format(date, 'dd/MM/yyyy')} - ${format(date, 'EEE', { locale: vi })}`,
        working: isDayOff ? 'Nghỉ' : 'Đi làm',
        regular: `${formatHourValue(regularHours)}h`,
        adjustment: adjustmentText || '-',
        overtime: `${formatHourValue(overtimeHours)}h`,
        total: `${formatHourValue(totalHours)}h`,
        note: record?.note || '-'
      };

      columns.forEach((column) => {
        context.strokeStyle = '#e2e8f0';
        context.strokeRect(currentX, rowTop, column.width, rowHeight);
        context.fillStyle = column.key === 'overtime' ? '#c2410c' : '#0f172a';
        context.font = '14px Arial';

        const textX =
          column.align === 'center'
            ? currentX + column.width / 2
            : column.align === 'right'
              ? currentX + column.width - 12
              : currentX + 12;

        context.textAlign = column.align === 'center' ? 'center' : column.align === 'right' ? 'right' : 'left';
        context.textBaseline = 'middle';
        context.fillText(String(rowValues[column.key]), textX, rowTop + rowHeight / 2, column.width - 24);
        currentX += column.width;
      });
    });

    downloadDataUrl(canvas.toDataURL('image/png'), `bang-cham-cong-${employeeCode}-${selectedMonth}.png`);
  };

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock3 size={18} />
            Chấm công nhanh
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Chọn người chấm, ngày và nhập số giờ tăng ca theo dạng text.
          </p>
        </div>

        <form
          onSubmit={handleQuickAttendanceSave}
          className="attendance-quick-form"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.3fr 1fr 1.2fr auto',
            gap: '1rem',
            alignItems: 'end'
          }}
        >
          <div>
            <label>Người chấm</label>
            <select
              value={quickEntry.employeeCode}
              onChange={(e) => setQuickEntry((previous) => ({ ...previous, employeeCode: e.target.value }))}
            >
              {employees.map((employee) => (
                <option key={employee.manv} value={employee.manv}>
                  {employee.tennv || employee.username}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Ngày</label>
            <input
              type="date"
              value={quickEntry.date}
              onChange={(e) => setQuickEntry((previous) => ({ ...previous, date: e.target.value }))}
            />
          </div>
          <div>
            <label>Số giờ tăng ca</label>
            <input
              type="text"
              value={quickEntry.overtimeText}
              onChange={(e) => setQuickEntry((previous) => ({ ...previous, overtimeText: e.target.value }))}
              placeholder="VD: 1 giờ 30 phút"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
              {QUICK_HOUR_TAGS.map((hour) => (
                <button
                  key={`hour-${hour}`}
                  type="button"
                  className="btn"
                  style={{ padding: '0.375rem 0.75rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                  onClick={() => handleQuickTagClick('hours', hour)}
                >
                  {hour} giờ
                </button>
              ))}
              {QUICK_MINUTE_TAGS.map((minute) => (
                <button
                  key={`minute-${minute}`}
                  type="button"
                  className="btn"
                  style={{ padding: '0.375rem 0.75rem', background: '#f8fafc', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                  onClick={() => handleQuickTagClick('minutes', minute)}
                >
                  {minute} phút
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingQuick} style={{ minWidth: '120px' }}>
            {savingQuick ? 'Đang lưu...' : 'Lưu'}
          </button>
        </form>
      </div>

      {errorMessage && (
        <div className="card" style={{ marginBottom: '1.5rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>Chấm công nhân viên</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Mặc định {DEFAULT_DAILY_HOURS} tiếng mỗi ngày, cuối ngày chỉ cần nhập thêm số giờ tăng ca hoặc thiếu giờ.
          </p>
        </div>

        {isManager && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', minWidth: '280px' }}>
            <div className="card" style={{ padding: '0.75rem 1rem', margin: 0, minWidth: '160px' }}>
              <label style={{ marginBottom: '6px' }}>Tháng</label>
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
            </div>
            <div className="card" style={{ padding: '0.75rem 1rem', margin: 0, minWidth: '220px' }}>
              <label style={{ marginBottom: '6px' }}>Nhân viên đang xem</label>
              <select value={selectedEmployeeCode} onChange={(e) => setSelectedEmployeeCode(e.target.value)}>
                {employees.map((employee) => (
                  <option key={employee.manv} value={employee.manv}>
                    {employee.tennv || employee.username}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {selectedSummary && (
        <div
          className="grid grid-4"
          style={{
            marginBottom: '1.5rem',
            gridTemplateColumns: isManager ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)'
          }}
        >
          <div className="card" style={{ borderLeft: '4px solid #2563eb' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Giờ công thường</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '0.25rem' }}>{formatHourValue(selectedSummary.regularHours)}h</div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #ea580c' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Giờ tăng ca</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '0.25rem' }}>{formatHourValue(selectedSummary.overtimeHours)}h</div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #7c3aed' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Ngày nghỉ</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', marginTop: '0.25rem' }}>{selectedSummary.dayOffs}</div>
          </div>
          {isManager && (
            <div className="card" style={{ borderLeft: '4px solid #16a34a' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Thực lĩnh tạm tính</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.5rem' }}>{formatCurrency(selectedSummary.totalPay)}</div>
            </div>
          )}
        </div>
      )}

      {isManager && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings2 size={18} />
              Cấu hình lương dùng chung
            </h2>

            <div className="attendance-global-config" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
              <div>
                <label>Đơn giá giờ thường</label>
                <input
                  type="text"
                  value={formatMoneyInput(payrollConfig.hourlyRate)}
                  onChange={(e) => handleGlobalConfigInputChange('hourlyRate', sanitizeMoneyInput(e.target.value))}
                  placeholder="VD: 25,000"
                />
              </div>
              <div>
                <label>Hệ số tăng ca</label>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={payrollConfig.overtimeMultiplier}
                  onChange={(e) => handleGlobalConfigInputChange('overtimeMultiplier', e.target.value)}
                  placeholder="VD: 1.5"
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={handleSaveGlobalConfig} disabled={savingConfig} style={{ minWidth: '150px' }}>
                {savingConfig ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} />
                Tổng kết theo tháng
              </h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Tổng hợp giờ công, tăng ca, ngày nghỉ và lương từng nhân viên.</p>
            </div>

            <div className="desktop-only" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.875rem' }}>Nhân viên</th>
                    <th style={{ textAlign: 'right', padding: '0.875rem' }}>Giờ công</th>
                    <th style={{ textAlign: 'right', padding: '0.875rem' }}>Tăng ca</th>
                    <th style={{ textAlign: 'right', padding: '0.875rem' }}>Ngày nghỉ</th>
                    <th style={{ textAlign: 'right', padding: '0.875rem' }}>Phụ cấp</th>
                    <th style={{ textAlign: 'right', padding: '0.875rem' }}>Thưởng</th>
                    <th style={{ textAlign: 'right', padding: '0.875rem' }}>Phạt</th>
                    <th style={{ textAlign: 'right', padding: '0.875rem' }}>Thực lĩnh</th>
                    <th style={{ textAlign: 'right', padding: '0.875rem' }}>Tác vụ</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeSummaries.map(({ employee, summary }) => (
                    <tr key={employee.manv} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.875rem' }}>
                        <div style={{ fontWeight: '700' }}>{employee.tennv || employee.username}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{employee.username}</div>
                      </td>
                      <td style={{ padding: '0.875rem', textAlign: 'right', fontWeight: '600' }}>{formatHourValue(summary.regularHours)}h</td>
                      <td style={{ padding: '0.875rem', textAlign: 'right', fontWeight: '600', color: '#ea580c' }}>{formatHourValue(summary.overtimeHours)}h</td>
                      <td style={{ padding: '0.875rem', textAlign: 'right', fontWeight: '600' }}>{summary.dayOffs}</td>
                      <td style={{ padding: '0.875rem', textAlign: 'right' }}>{formatCurrency(summary.allowance)}</td>
                      <td style={{ padding: '0.875rem', textAlign: 'right' }}>{formatCurrency(summary.bonus)}</td>
                      <td style={{ padding: '0.875rem', textAlign: 'right' }}>{formatCurrency(summary.penalty)}</td>
                      <td style={{ padding: '0.875rem', textAlign: 'right', fontWeight: '800', color: '#16a34a' }}>{formatCurrency(summary.totalPay)}</td>
                      <td style={{ padding: '0.875rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            className="btn"
                            style={{ background: '#f8fafc', border: '1px solid var(--border)' }}
                            onClick={() => {
                              setSelectedEmployeeCode(String(employee.manv));
                              handleDownloadAttendanceImage(employee);
                            }}
                          >
                            Chi tiết
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => handleExportPayroll(employee, summary)}
                          >
                            <FileText size={16} />
                            Phiếu lương
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {employeeSummaries.map(({ employee, summary }) => (
                <div key={employee.manv} className="card" style={{ padding: '1rem', background: '#fbfdff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: '800' }}>{employee.tennv || employee.username}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{employee.username}</div>
                    </div>
                    <div style={{ fontWeight: '800', color: '#16a34a', textAlign: 'right' }}>{formatCurrency(summary.totalPay)}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Giờ công</div>
                      <div style={{ fontWeight: '700' }}>{formatHourValue(summary.regularHours)}h</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tăng ca</div>
                      <div style={{ fontWeight: '700', color: '#ea580c' }}>{formatHourValue(summary.overtimeHours)}h</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ngày nghỉ</div>
                      <div style={{ fontWeight: '700' }}>{summary.dayOffs}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phụ cấp</div>
                      <div style={{ fontWeight: '700' }}>{formatCurrency(summary.allowance)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Thưởng</div>
                      <div style={{ fontWeight: '700' }}>{formatCurrency(summary.bonus)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phạt</div>
                      <div style={{ fontWeight: '700' }}>{formatCurrency(summary.penalty)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      className="btn"
                      style={{ flex: 1, background: '#f8fafc', border: '1px solid var(--border)' }}
                      onClick={() => {
                        setSelectedEmployeeCode(String(employee.manv));
                        handleDownloadAttendanceImage(employee);
                      }}
                    >
                      Chi tiết
                    </button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleExportPayroll(employee, summary)}>
                      Phiếu lương
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedEmployee && selectedSummary && (
            <div className="attendance-layout" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card">
                  <h2 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1rem' }}>Phụ cấp, thưởng, phạt</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label>Phụ cấp</label>
                      <input
                        type="text"
                        value={formatMoneyInput(selectedMonthlyData.allowance)}
                        onChange={(e) => handleMonthlyDataChange('allowance', sanitizeMoneyInput(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label>Thưởng</label>
                      <input
                        type="text"
                        value={formatMoneyInput(selectedMonthlyData.bonus)}
                        onChange={(e) => handleMonthlyDataChange('bonus', sanitizeMoneyInput(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label>Phạt</label>
                      <input
                        type="text"
                        value={formatMoneyInput(selectedMonthlyData.penalty)}
                        onChange={(e) => handleMonthlyDataChange('penalty', sanitizeMoneyInput(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label>Ghi chú phiếu lương</label>
                      <textarea
                        rows="3"
                        value={selectedMonthlyData.note}
                        onChange={(e) => handleMonthlyDataChange('note', e.target.value)}
                        placeholder="Ghi chú thêm nếu cần"
                      />
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h2 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1rem' }}>Tác vụ nhanh</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button className="btn" style={{ background: '#f8fafc', border: '1px solid var(--border)' }} onClick={handleMarkSundaysOff}>
                      Đánh dấu chủ nhật là nghỉ
                    </button>
                    <button className="btn" style={{ background: '#fff7ed', color: '#c2410c' }} onClick={handleResetMonth}>
                      <RefreshCcw size={16} style={{ marginRight: '6px' }} />
                      Khôi phục mặc định tháng
                    </button>
                    <button className="btn btn-primary" onClick={() => handleExportPayroll(selectedEmployee, selectedSummary)}>
                      Xuất phiếu lương
                    </button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div style={{ marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CalendarDays size={18} />
                    Bảng chấm công {selectedEmployee.tennv || selectedEmployee.username}
                  </h2>
                  <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Nhập `1 giờ 30 phút`, `20 phút`, hoặc `-1 giờ` để hệ thống tự quy đổi khi tính lương.
                  </p>
                </div>

                <div className="desktop-only" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.875rem' }}>Ngày</th>
                        <th style={{ textAlign: 'center', padding: '0.875rem' }}>Đi làm</th>
                        <th style={{ textAlign: 'right', padding: '0.875rem' }}>Giờ công</th>
                        <th style={{ textAlign: 'left', padding: '0.875rem' }}>+/- giờ</th>
                        <th style={{ textAlign: 'right', padding: '0.875rem' }}>Tăng ca</th>
                        <th style={{ textAlign: 'right', padding: '0.875rem' }}>Tổng giờ</th>
                        <th style={{ textAlign: 'left', padding: '0.875rem' }}>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthDates.map((date) => {
                        const dateKey = format(date, 'yyyy-MM-dd');
                        const record = attendanceMap[getAttendanceKey(selectedEmployeeCode, dateKey)];
                        const isDayOff = Boolean(record?.isDayOff);
                        const adjustmentText = record?.adjustmentText || '';
                        const { regularHours, overtimeHours, totalHours } = calculateDayHours(isDayOff, adjustmentText);
                        const effectiveMonthEnd = getEffectiveMonthEnd(selectedMonth);
                        const isFutureForPayroll = !effectiveMonthEnd || date > effectiveMonthEnd;

                        return (
                          <tr key={dateKey} style={{ borderBottom: '1px solid #f1f5f9', opacity: isFutureForPayroll ? 0.7 : 1 }}>
                            <td style={{ padding: '0.875rem' }}>
                              <div style={{ fontWeight: '700' }}>{format(date, 'dd/MM/yyyy')}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                {format(date, 'EEEE', { locale: vi })}
                                {isFutureForPayroll ? ' • chưa tính lương' : ''}
                              </div>
                            </td>
                            <td style={{ padding: '0.875rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={!isDayOff}
                                onChange={(e) =>
                                  handleAttendanceChange(dateKey, {
                                    isDayOff: !e.target.checked,
                                    adjustmentText: e.target.checked ? adjustmentText : ''
                                  })
                                }
                                style={{ width: '18px', height: '18px' }}
                              />
                            </td>
                            <td style={{ padding: '0.875rem', textAlign: 'right', fontWeight: '600' }}>{formatHourValue(regularHours)}h</td>
                            <td style={{ padding: '0.875rem', minWidth: '180px' }}>
                              <input
                                type="text"
                                value={isDayOff ? '' : adjustmentText}
                                disabled={isDayOff}
                                onChange={(e) => handleAttendanceChange(dateKey, { adjustmentText: e.target.value })}
                                placeholder="VD: 1 giờ 30 phút"
                              />
                            </td>
                            <td style={{ padding: '0.875rem', textAlign: 'right', color: '#ea580c', fontWeight: '600' }}>{formatHourValue(overtimeHours)}h</td>
                            <td style={{ padding: '0.875rem', textAlign: 'right', fontWeight: '700' }}>{formatHourValue(totalHours)}h</td>
                            <td style={{ padding: '0.875rem' }}>
                              <input
                                type="text"
                                value={record?.note || ''}
                                onChange={(e) => handleAttendanceChange(dateKey, { note: e.target.value })}
                                placeholder="Ghi chú cuối ngày"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {monthDates.map((date) => {
                    const dateKey = format(date, 'yyyy-MM-dd');
                    const record = attendanceMap[getAttendanceKey(selectedEmployeeCode, dateKey)];
                    const isDayOff = Boolean(record?.isDayOff);
                    const adjustmentText = record?.adjustmentText || '';
                    const { regularHours, overtimeHours, totalHours } = calculateDayHours(isDayOff, adjustmentText);
                    const effectiveMonthEnd = getEffectiveMonthEnd(selectedMonth);
                    const isFutureForPayroll = !effectiveMonthEnd || date > effectiveMonthEnd;

                    return (
                      <div key={dateKey} className="card" style={{ padding: '1rem', background: '#fbfdff', opacity: isFutureForPayroll ? 0.75 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={{ fontWeight: '800' }}>{format(date, 'dd/MM/yyyy')}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              {format(date, 'EEEE', { locale: vi })}
                              {isFutureForPayroll ? ' • chưa tính lương' : ''}
                            </div>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={!isDayOff}
                              onChange={(e) =>
                                handleAttendanceChange(dateKey, {
                                  isDayOff: !e.target.checked,
                                  adjustmentText: e.target.checked ? adjustmentText : ''
                                })
                              }
                              style={{ width: '18px', height: '18px' }}
                            />
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Đi làm</span>
                          </label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Giờ công</div>
                            <div style={{ fontWeight: '700' }}>{formatHourValue(regularHours)}h</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tăng ca</div>
                            <div style={{ fontWeight: '700', color: '#ea580c' }}>{formatHourValue(overtimeHours)}h</div>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ marginBottom: '6px' }}>+/- giờ</label>
                            <input
                              type="text"
                              value={isDayOff ? '' : adjustmentText}
                              disabled={isDayOff}
                              onChange={(e) => handleAttendanceChange(dateKey, { adjustmentText: e.target.value })}
                              placeholder="VD: 1 giờ 30 phút"
                            />
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label style={{ marginBottom: '6px' }}>Ghi chú</label>
                            <input
                              type="text"
                              value={record?.note || ''}
                              onChange={(e) => handleAttendanceChange(dateKey, { note: e.target.value })}
                              placeholder="Ghi chú cuối ngày"
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tổng giờ</div>
                            <div style={{ fontWeight: '800' }}>{formatHourValue(totalHours)}h</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AttendancePayroll;
