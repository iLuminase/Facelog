'use client';

import {
  AttendanceAnalytics, AttendanceRow, AttendanceSessionDetail, AuditRow, AuthUser, EmployeeInput, EmployeeMeta, EmployeeRow, Pagination,
  createEmployee, deleteAttendanceSession, deleteEmployee, getAttendanceReport,
  getAttendanceSessionDetail,
  getAuditLogs, getEmployeeMeta,
  getEmployees, getHealth, updateEmployee
} from '@/lib/api';
import {
  Activity, ArrowUpDown, BarChart3, CalendarClock, Camera, ChevronLeft, ChevronRight, Clock3, Download,
  Edit2, Eye, FileClock, FilterX, Loader2, LogOut, Plus, RefreshCw, ScanFace, Search, ShieldCheck, Trash2, UserCog, Users
} from 'lucide-react';
import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AccountPanel, ShiftPanel } from './admin-panels';
import { FaceIdPanel } from './faceid-panel';

type ViewKey = 'dashboard' | 'employees' | 'attendance' | 'faceid' | 'reports' | 'shifts' | 'accounts' | 'audit';
type SortOrder = 'asc' | 'desc';
const emptyPagination: Pagination = { page: 1, pageSize: 10, total: 0, totalPages: 0 };
const emptyAttendanceAnalytics: AttendanceAnalytics = {
  totalRecords: 0, presentCount: 0, lateCount: 0, incompleteCount: 0,
  earlyLeaveCount: 0, overtimeCount: 0, totalLateMinutes: 0, totalWorkUnits: 0, averageWorkedMinutes: 0, daily: []
};

const navItems: Array<{ key: ViewKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: 'dashboard', label: 'Tổng quan', icon: BarChart3 },
  { key: 'employees', label: 'Nhân sự', icon: Users },
  { key: 'attendance', label: 'Chấm công', icon: ScanFace },
  { key: 'faceid', label: 'Đăng ký FaceID', icon: Camera },
  { key: 'reports', label: 'Báo cáo', icon: Download },
  { key: 'shifts', label: 'Ca làm', icon: CalendarClock },
  { key: 'accounts', label: 'Tài khoản', icon: UserCog },
  { key: 'audit', label: 'Nhật ký hệ thống', icon: FileClock }
];

function statusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    ACTIVE: 'Đang làm', ON_LEAVE: 'Tạm nghỉ', SUSPENDED: 'Tạm khóa', RESIGNED: 'Đã nghỉ',
    PRESENT: 'Có mặt', LATE: 'Đi trễ', ABSENT: 'Vắng', LEAVE: 'Nghỉ phép', HOLIDAY: 'Ngày lễ',
    INCOMPLETE: 'Thiếu lượt ra', LOW_QUALITY: 'Cần cập nhật', NOT_ENROLLED: 'Chưa tạo',
    PENDING_REVIEW: 'Chờ duyệt', DISABLED: 'Đã khóa'
  };
  return status ? labels[status] ?? status : 'Chưa có';
}

function faceStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    ACTIVE: 'Đã đăng ký', NOT_ENROLLED: 'Chưa đăng ký', PENDING_REVIEW: 'Chờ duyệt',
    LOW_QUALITY: 'Cần đăng ký lại', DISABLED: 'Đã vô hiệu hóa'
  };
  return status ? labels[status] ?? status : 'Chưa đăng ký';
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatWorkUnits(value: unknown) {
  const units = Number(value);
  return Number.isFinite(units) ? units.toFixed(2) : '0.00';
}

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function DashboardShell({ currentUser, onLogout }: { currentUser: AuthUser; onLogout: () => void }) {
  const canManageHr = ['SUPER_ADMIN', 'HR_MANAGER', 'HR_STAFF'].includes(currentUser.role);
  const canViewReports = ['SUPER_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'SECURITY'].includes(currentUser.role);
  const canViewAudit = ['SUPER_ADMIN', 'HR_MANAGER'].includes(currentUser.role);
  const [activeView, setActiveView] = useState<ViewKey>('dashboard');
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [faceEmployees, setFaceEmployees] = useState<EmployeeRow[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRow[]>([]);
  const [recentSort, setRecentSort] = useState({ sortBy: 'workDate', sortOrder: 'desc' as SortOrder });
  const [meta, setMeta] = useState<EmployeeMeta>({ departments: [], positions: [] });
  const [notice, setNotice] = useState<string | null>(null);

  const [employeeRows, setEmployeeRows] = useState<EmployeeRow[]>([]);
  const [employeePagination, setEmployeePagination] = useState(emptyPagination);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState({ keyword: '', departmentId: '', status: '', sortBy: 'employeeCode', sortOrder: 'asc' as SortOrder, page: 1, pageSize: 10 });

  const [reportRows, setReportRows] = useState<AttendanceRow[]>([]);
  const [reportPagination, setReportPagination] = useState(emptyPagination);
  const [reportAnalytics, setReportAnalytics] = useState<AttendanceAnalytics>(emptyAttendanceAnalytics);
  const [reportSearch, setReportSearch] = useState('');
  const [reportQuery, setReportQuery] = useState({ keyword: '', from: '', to: '', departmentId: '', status: '', sortBy: 'workDate', sortOrder: 'desc' as SortOrder, page: 1, pageSize: 10 });
  const [reportUpdatedAt, setReportUpdatedAt] = useState<Date | null>(null);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const [exportingReport, setExportingReport] = useState(false);

  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditPagination, setAuditPagination] = useState(emptyPagination);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditQuery, setAuditQuery] = useState({ keyword: '', actionCode: '', page: 1, pageSize: 10 });
  const [attendanceDetail, setAttendanceDetail] = useState<AttendanceSessionDetail | null>(null);
  const [auditDetail, setAuditDetail] = useState<AuditRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCore = useCallback(async () => {
    setLoading(true);
    const [healthResult, employeesResult, attendanceResult, metaResult] = await Promise.all([
      getHealth().catch(() => null),
      canManageHr ? getEmployees({ status: 'ACTIVE', pageSize: 100 }).catch(() => null) : Promise.resolve(null),
      canViewReports ? getAttendanceReport({ pageSize: 8, ...recentSort }).catch(() => null) : Promise.resolve(null),
      canManageHr ? getEmployeeMeta().catch(() => null) : Promise.resolve(null)
    ]);
    if (healthResult) {
      setHealth(healthResult.database === 'ok' ? 'online' : 'offline');
      setServerTime(healthResult.timestamp);
    } else setHealth('offline');
    if (employeesResult) setFaceEmployees(employeesResult.data);
    if (attendanceResult) {
      setRecentAttendance(attendanceResult.data);
      setReportUpdatedAt(new Date());
    }
    if (metaResult) setMeta(metaResult);
    setLoading(false);
  }, [canManageHr, canViewReports, recentSort]);

  const loadEmployeeRows = useCallback(async () => {
    if (!canManageHr) return;
    try {
      const result = await getEmployees(employeeQuery);
      setEmployeeRows(result.data); setEmployeePagination(result.pagination);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể tải nhân sự'); }
  }, [canManageHr, employeeQuery]);

  const loadReportRows = useCallback(async () => {
    if (!canViewReports) return;
    try {
      const result = await getAttendanceReport(reportQuery);
      setReportRows(result.data); setReportPagination(result.pagination);
      setReportAnalytics(result.analytics);
      setReportUpdatedAt(new Date());
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể tải báo cáo'); }
  }, [canViewReports, reportQuery]);

  const loadAuditRows = useCallback(async () => {
    if (!canViewAudit) return;
    try {
      const result = await getAuditLogs(auditQuery);
      setAuditRows(result.data); setAuditPagination(result.pagination);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể tải nhật ký'); }
  }, [auditQuery, canViewAudit]);

  useEffect(() => { void loadCore(); }, [loadCore]);
  useEffect(() => { void loadEmployeeRows(); }, [loadEmployeeRows]);
  useEffect(() => { void loadReportRows(); }, [loadReportRows]);
  useEffect(() => { void loadAuditRows(); }, [loadAuditRows]);

  useEffect(() => {
    if (health !== 'offline') {
      setOfflineNotice(false);
      return;
    }
    setOfflineNotice(true);
    const timeoutId = window.setTimeout(() => setOfflineNotice(false), 10_000);
    return () => window.clearTimeout(timeoutId);
  }, [health]);

  useEffect(() => {
    if (!canViewReports || (activeView !== 'dashboard' && activeView !== 'reports')) return;
    let disposed = false;
    let refreshing = false;
    let failureCount = 0;
    let retryAfter = 0;
    const refreshLiveAttendance = async () => {
      if (disposed || refreshing || document.visibilityState !== 'visible' || Date.now() < retryAfter) return;
      refreshing = true;
      try {
        if (activeView === 'reports') {
          const result = await getAttendanceReport(reportQuery);
          if (!disposed) {
            setReportRows(result.data);
            setReportPagination(result.pagination);
            setReportAnalytics(result.analytics);
            setReportUpdatedAt(new Date());
          }
        } else {
          const result = await getAttendanceReport({ pageSize: 8, ...recentSort });
          if (!disposed) { setRecentAttendance(result.data); setReportUpdatedAt(new Date()); }
        }
        failureCount = 0;
        retryAfter = 0;
      } catch {
        failureCount += 1;
        retryAfter = Date.now() + Math.min(30_000, 2_000 * 2 ** Math.min(failureCount - 1, 4));
      } finally { refreshing = false; }
    };
    const intervalId = window.setInterval(() => void refreshLiveAttendance(), 1000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') void refreshLiveAttendance(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { disposed = true; window.clearInterval(intervalId); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, [activeView, canViewReports, reportQuery, recentSort]);

  const activeCount = faceEmployees.length;
  const faceReadyCount = faceEmployees.filter((employee) => employee.faceStatus === 'ACTIVE').length;
  const lateCount = recentAttendance.filter((row) => row.status === 'LATE').length;
  const incompleteCount = recentAttendance.filter((row) => row.status === 'INCOMPLETE' || row.status === 'ABSENT').length;

  async function refreshAll() {
    await Promise.all([loadCore(), loadEmployeeRows(), loadReportRows(), loadAuditRows()]);
  }

  function openEmployeeForm(employee: EmployeeRow | null = null) {
    setEditingEmployee(employee); setFormOpen(true); setNotice(null);
  }

  async function handleSaveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: EmployeeInput = {
      fullName: String(data.get('fullName')),
      gender: (String(data.get('gender')) || null) as EmployeeInput['gender'],
      dateOfBirth: String(data.get('dateOfBirth')), email: String(data.get('email')) || null,
      phone: String(data.get('phone')) || null, address: String(data.get('address')) || null,
      departmentId: data.get('departmentId') ? Number(data.get('departmentId')) : null,
      positionId: data.get('positionId') ? Number(data.get('positionId')) : null,
      employmentType: String(data.get('employmentType')) as EmployeeInput['employmentType'],
      employmentStatus: String(data.get('employmentStatus')) as EmployeeInput['employmentStatus'],
      hireDate: String(data.get('hireDate')), terminationDate: String(data.get('terminationDate')) || null,
      note: String(data.get('note')) || null
    };
    setSaving(true);
    try {
      const result = editingEmployee
        ? await updateEmployee(editingEmployee.employeeId, input)
        : await createEmployee(input);
      setFormOpen(false);
      setNotice(`${editingEmployee ? 'Đã cập nhật' : 'Đã thêm'} nhân viên · Mã ${result.data.employeeCode}`);
      await refreshAll();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể lưu nhân viên'); }
    finally { setSaving(false); }
  }

  async function handleDeleteEmployee(employee: EmployeeRow) {
    if (!window.confirm(`Chuyển ${employee.fullName} sang trạng thái đã nghỉ? Lịch sử chấm công vẫn được giữ.`)) return;
    try {
      await deleteEmployee(employee.employeeId);
      setNotice('Đã cập nhật trạng thái nghỉ việc và vô hiệu hóa FaceID');
      await refreshAll();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể cập nhật nhân viên'); }
  }

  async function handleDeleteAttendanceSession(row: AttendanceRow) {
    const sessionKey = `${row.employeeId}:${row.workDate}`;
    const displayDate = new Intl.DateTimeFormat('vi-VN').format(new Date(`${row.workDate}T00:00:00`));
    if (!window.confirm(`Xóa toàn bộ phiên chấm công của ${row.fullName} ngày ${displayDate}? Nhân viên sẽ có thể chấm công lại từ đầu.`)) return;
    setDeletingSession(sessionKey);
    try {
      const result = await deleteAttendanceSession(row.employeeId, row.workDate);
      setNotice(`Đã xóa phiên chấm công và ${result.data.deletedLogCount} lượt vào/ra của ${row.fullName}`);
      await Promise.all([loadCore(), loadReportRows(), loadAuditRows()]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể xóa phiên chấm công');
    } finally { setDeletingSession(null); }
  }

  function sortEmployees(sortBy: string) {
    setEmployeeQuery((current) => ({ ...current, sortBy, sortOrder: current.sortBy === sortBy && current.sortOrder === 'asc' ? 'desc' : 'asc', page: 1 }));
  }

  function sortReports(sortBy: string) {
    setReportQuery((current) => ({ ...current, sortBy, sortOrder: current.sortBy === sortBy && current.sortOrder === 'asc' ? 'desc' : 'asc', page: 1 }));
  }

  function sortRecent(sortBy: string) {
    setRecentSort((current) => ({ sortBy, sortOrder: current.sortBy === sortBy && current.sortOrder === 'asc' ? 'desc' : 'asc' }));
  }

  async function showAttendanceDetail(row: AttendanceRow) {
    setDetailLoading(true);
    try { setAttendanceDetail(await getAttendanceSessionDetail(row.employeeId, row.workDate)); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể tải chi tiết chấm công'); }
    finally { setDetailLoading(false); }
  }

  function clearReportFilters() {
    setReportSearch('');
    setReportQuery({ keyword: '', from: '', to: '', departmentId: '', status: '', sortBy: 'workDate', sortOrder: 'desc' as SortOrder, page: 1, pageSize: 10 });
  }

  function setReportRange(days: number) {
    const to = new Date(); const from = new Date(); from.setDate(to.getDate() - days + 1);
    setReportQuery((current) => ({ ...current, from: localDate(from), to: localDate(to), page: 1 }));
  }

  async function exportExcel() {
    setExportingReport(true);
    try {
      const firstPage = await getAttendanceReport({ ...reportQuery, page: 1, pageSize: 100 });
      const allRows = [...firstPage.data];
      for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
        const result = await getAttendanceReport({ ...reportQuery, page, pageSize: 100 });
        allRows.push(...result.data);
      }
      await downloadAttendanceWorkbook(allRows, firstPage.analytics, {
        from: reportQuery.from,
        to: reportQuery.to,
        department: meta.departments.find((item) => String(item.departmentId) === reportQuery.departmentId)?.departmentName,
        status: reportQuery.status ? statusLabel(reportQuery.status) : undefined
      });
      setNotice(`Đã xuất báo cáo Excel gồm ${allRows.length} dòng dữ liệu`);
    } catch (error) {
      setNotice(error instanceof Error ? `Không thể xuất Excel: ${error.message}` : 'Không thể xuất báo cáo Excel');
    } finally {
      setExportingReport(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Image src="/logo2.png" alt="Logo HUTECH" width={42} height={42} priority /></div><div><strong>HUTECH</strong><span>Quản lý nhân sự</span></div></div>
        <nav className="nav-list">{navItems.filter((item) => {
          if (['employees', 'faceid'].includes(item.key)) return canManageHr;
          if (item.key === 'reports') return canViewReports;
          if (item.key === 'shifts') return ['SUPER_ADMIN', 'HR_MANAGER'].includes(currentUser.role);
          if (item.key === 'accounts') return currentUser.role === 'SUPER_ADMIN';
          if (item.key === 'audit') return canViewAudit;
          return true;
        }).map((item) => {
          const Icon = item.icon; return (
            <button key={item.key} className={activeView === item.key ? 'nav-item active' : 'nav-item'} type="button" onClick={() => setActiveView(item.key)}>
              <Icon size={18} /><span>{item.label}</span>
            </button>);
        })}</nav>
        <div className="sidebar-user"><div className="avatar">{(currentUser.fullName ?? currentUser.username).slice(0, 1)}</div><div><strong>{currentUser.fullName ?? currentUser.username}</strong><span>{currentUser.role}</span></div><button title="Đăng xuất" type="button" onClick={onLogout}><LogOut size={17} /></button></div>
      </aside>

      <section className="workspace">
        <section className="system-banner" aria-label="Nhận diện hệ thống">
          <div className="system-banner-logo"><Image src="/logo1.png" alt="HUTECH University" width={3508} height={1125} priority /></div>
          <div className="system-banner-title"><span>HỆ THỐNG</span><strong>QUẢN LÝ NHÂN SỰ - CHẤM CÔNG TỰ ĐỘNG</strong></div>
        </section>
        <header className="topbar">
          <div><p className="eyebrow">֍==============================================֎</p><h1>{({ dashboard: 'Tổng quan chấm công', employees: 'Quản lý nhân sự', attendance: 'Chấm công bằng khuôn mặt', faceid: 'Đăng ký FaceID', reports: 'Báo cáo ra vào', shifts: 'Thiết lập ca làm', accounts: 'Quản lý tài khoản', audit: 'Nhật ký hệ thống' } as Record<ViewKey, string>)[activeView]}</h1></div>
          <div className="topbar-actions">
            {activeView === 'reports' && (
              <button className="button secondary" type="button" onClick={clearReportFilters}>
                <FilterX size={17} />
                Xóa bộ lọc
              </button>
            )}
            <button className="button secondary" type="button" onClick={() => void refreshAll()}>{loading ? <Loader2 size={17} className="spin" /> : <RefreshCw size={17} />}Tải lại</button>
            {canManageHr && <button className="button primary" type="button" onClick={() => openEmployeeForm()}><Plus size={17} />Thêm nhân viên</button>}
          </div>
        </header>
        {notice && <div className="notice"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>×</button></div>}
        {offlineNotice && <div className="backend-offline-toast" role="status"><span />Không thể kết nối backend. Hệ thống sẽ tự thử lại.</div>}

        {activeView === 'dashboard' && <div className="content-stack">
          <section className="metric-grid">
            <Metric icon={Users} label="Nhân sự hoạt động" value={activeCount} tone="blue" />
            <Metric icon={ShieldCheck} label="FaceID sẵn sàng" value={faceReadyCount} tone="green" />
            <Metric icon={Clock3} label="Lượt đi trễ gần đây" value={lateCount} tone="amber" />
            <Metric icon={Activity} label="Cần xử lý" value={incompleteCount} tone="red" />
          </section>
          <section className="panel"><div className="panel-header"><div><h2>Nhật ký gần đây</h2><p>Dữ liệu tổng hợp chấm công mới nhất</p></div><LiveStatus updatedAt={reportUpdatedAt} serverTime={serverTime} /></div><AttendanceTable rows={recentAttendance} onSort={sortRecent} onView={(row) => void showAttendanceDetail(row)} detailLoading={detailLoading} /></section>
        </div>}

        {activeView === 'employees' && <section className="panel">
          <div className="panel-header"><div><h2>Danh sách nhân viên</h2><p>{employeePagination.total} hồ sơ phù hợp</p></div></div>
          <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); setEmployeeQuery((current) => ({ ...current, keyword: employeeSearch, page: 1 })); }}>
            <label className="search-box"><Search size={17} /><input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Tìm mã, tên, email, SĐT..." /></label>
            <select value={employeeQuery.departmentId} onChange={(event) => setEmployeeQuery((current) => ({ ...current, departmentId: event.target.value, page: 1 }))}><option value="">Tất cả phòng ban</option>{meta.departments.map((item) => <option key={item.departmentId} value={item.departmentId}>{item.departmentName}</option>)}</select>
            <select value={employeeQuery.status} onChange={(event) => setEmployeeQuery((current) => ({ ...current, status: event.target.value, page: 1 }))}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang làm</option><option value="ON_LEAVE">Tạm nghỉ</option><option value="SUSPENDED">Tạm khóa</option><option value="RESIGNED">Đã nghỉ</option></select>
            <button className="button primary" type="submit">Tìm kiếm</button>
          </form>
          <EmployeeTable employees={employeeRows} onSort={sortEmployees} onEdit={openEmployeeForm} onDelete={(employee) => void handleDeleteEmployee(employee)} />
          <Pager pagination={employeePagination} onPage={(page) => setEmployeeQuery((current) => ({ ...current, page }))} />
        </section>}

        {activeView === 'attendance' && <FaceIdPanel key="attendance" employees={faceEmployees} mode="attendance" onDone={refreshAll} isAdmin={currentUser.role === 'SUPER_ADMIN'} serverTime={serverTime} />}
        {activeView === 'faceid' && <FaceIdPanel key="enroll" employees={faceEmployees} mode="enroll" onDone={refreshAll} isAdmin={currentUser.role === 'SUPER_ADMIN'} serverTime={serverTime} />}

        {activeView === 'reports' && <section className="panel">
          <div className="panel-header"><div><h2>Báo cáo chấm công</h2><p>{reportPagination.total} dòng dữ liệu phù hợp</p></div><div className="topbar-actions"><LiveStatus updatedAt={reportUpdatedAt} serverTime={serverTime} /><button className="button secondary" type="button" onClick={() => void exportExcel()} disabled={!reportPagination.total || exportingReport}>{exportingReport ? <Loader2 size={17} className="spin" /> : <Download size={17} />}{exportingReport ? 'Đang tạo Excel...' : 'Xuất Excel đầy đủ'}</button></div></div>
          <form className="filter-bar report-filters" onSubmit={(event) => { event.preventDefault(); setReportQuery((current) => ({ ...current, keyword: reportSearch, page: 1 })); }}>
            <label className="search-box"><Search size={17} /><input value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} placeholder="Tìm mã hoặc tên nhân viên..." /></label>
            <input aria-label="Từ ngày" type="date" value={reportQuery.from} onChange={(event) => setReportQuery((current) => ({ ...current, from: event.target.value, page: 1 }))} />
            <input aria-label="Đến ngày" type="date" value={reportQuery.to} onChange={(event) => setReportQuery((current) => ({ ...current, to: event.target.value, page: 1 }))} />
            <select value={reportQuery.departmentId} onChange={(event) => setReportQuery((current) => ({ ...current, departmentId: event.target.value, page: 1 }))}><option value="">Tất cả phòng ban</option>{meta.departments.map((item) => <option key={item.departmentId} value={item.departmentId}>{item.departmentName}</option>)}</select>
            <select value={reportQuery.status} onChange={(event) => setReportQuery((current) => ({ ...current, status: event.target.value, page: 1 }))}><option value="">Tất cả trạng thái</option><option value="PRESENT">Có mặt</option><option value="LATE">Đi trễ</option><option value="INCOMPLETE">Thiếu lượt ra</option><option value="ABSENT">Vắng</option></select>
            <button className="button secondary" type="button" onClick={() => setReportRange(1)}>Hôm nay</button><button className="button secondary" type="button" onClick={() => setReportRange(7)}>7 ngày</button><button className="button primary" type="submit">Tìm kiếm</button>
          </form>
          <ReportAnalyticsPanel analytics={reportAnalytics} />
          <AttendanceTable rows={reportRows} onSort={sortReports} onDelete={currentUser.role === 'SUPER_ADMIN' ? (row) => void handleDeleteAttendanceSession(row) : undefined} deletingSession={deletingSession} />
          <Pager pagination={reportPagination} onPage={(page) => setReportQuery((current) => ({ ...current, page }))} />
        </section>}

        {activeView === 'shifts' && <ShiftPanel />}
        {activeView === 'accounts' && currentUser.role === 'SUPER_ADMIN' && <AccountPanel employees={faceEmployees} />}

        {activeView === 'audit' && <section className="panel">
          <div className="panel-header"><div><h2>Lịch sử thay đổi</h2><p>{auditPagination.total} sự kiện đã ghi nhận</p></div></div>
          <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); setAuditQuery((current) => ({ ...current, keyword: auditSearch, page: 1 })); }}><label className="search-box"><Search size={17} /><input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Tìm hành động, dữ liệu, IP, tài khoản..." /></label><select value={auditQuery.actionCode} onChange={(event) => setAuditQuery((current) => ({ ...current, actionCode: event.target.value, page: 1 }))}><option value="">Tất cả phân loại</option><option value="ADD">ADD · Thêm mới</option><option value="UD">UD · Cập nhật</option><option value="DEL">DEL · Xóa/Vô hiệu</option><option value="ATT">ATT · Chấm công</option><option value="AUTH">AUTH · Xác thực</option><option value="SYS">SYS · Hệ thống</option></select><button className="button primary" type="submit">Tìm kiếm</button></form>
          <AuditTable rows={auditRows} onView={setAuditDetail} /><Pager pagination={auditPagination} onPage={(page) => setAuditQuery((current) => ({ ...current, page }))} />
        </section>}
      </section>

      {formOpen && <EmployeeModal employee={editingEmployee} meta={meta} saving={saving} onClose={() => setFormOpen(false)} onSubmit={handleSaveEmployee} />}
      {attendanceDetail && <DetailModal title="Chi tiết phiên chấm công" onClose={() => setAttendanceDetail(null)}><DetailObject title="Thông tin nhân viên" value={attendanceDetail.employee} /><DetailObject title="Tổng hợp phiên" value={attendanceDetail.summary} /><DetailList title="Sự kiện vào/ra và vị trí máy" values={attendanceDetail.logs} /><DetailList title="Kết quả nhận diện và lỗi" values={attendanceDetail.recognitionAttempts} /></DetailModal>}
      {auditDetail && <DetailModal title={`${auditActionCode(auditDetail.action)} · Chi tiết nhật ký`} onClose={() => setAuditDetail(null)}><DetailObject title="Thông tin sự kiện" value={auditDetail as unknown as Record<string, unknown>} /><DetailObject title="Dữ liệu trước thay đổi" value={parseAuditJson(auditDetail.beforeJson)} /><DetailObject title="Dữ liệu sau thay đổi" value={parseAuditJson(auditDetail.afterJson)} /></DetailModal>}
    </main>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ size?: number }>; label: string; value: number; tone: 'blue' | 'green' | 'amber' | 'red' }) {
  return <article className={`metric ${tone}`}><div className="metric-icon"><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong></div></article>;
}

function LiveStatus({ updatedAt, serverTime }: { updatedAt: Date | null; serverTime: string | null }) {
  const [clock, setClock] = useState(() => new Date(serverTime ?? Date.now()));

  useEffect(() => {
    const offset = serverTime ? new Date(serverTime).getTime() - Date.now() : 0;
    const updateClock = () => setClock(new Date(Date.now() + offset));
    updateClock();
    const intervalId = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(intervalId);
  }, [serverTime]);

  const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(clock);
  return <div className="live-status" title="Giờ hệ thống lấy từ máy chủ backend và được đồng bộ theo timestamp máy chủ"><span />Giờ hệ thống {time} {updatedAt && <small>· cập nhật {new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(updatedAt)}</small>}</div>;
}

function SortHead({ label, field, onSort }: { label: string; field: string; onSort: (field: string) => void }) {
  return <th><button className="sort-button" type="button" onClick={() => onSort(field)}>{label}<ArrowUpDown size={13} /></button></th>;
}

function ReportAnalyticsPanel({ analytics }: { analytics: AttendanceAnalytics }) {
  const violationMetrics = [
    { label: 'Đi trễ', value: analytics.lateCount, className: 'late' },
    { label: 'Quên chấm ra', value: analytics.incompleteCount, className: 'incomplete' },
    { label: 'Về sớm', value: analytics.earlyLeaveCount, className: 'early' },
    { label: 'Tăng ca', value: analytics.overtimeCount, className: 'overtime' }
  ];
  const maxViolation = Math.max(1, ...violationMetrics.map((item) => item.value));
  const maxDaily = Math.max(1, ...analytics.daily.flatMap((item) => [item.lateCount, item.incompleteCount, item.earlyLeaveCount]));

  return (
    <div className="report-analytics">
      <div className="report-kpi-grid">
        <div className="report-kpi total"><BarChart3 size={21} /><span>Tổng công ghi nhận</span><strong>{formatWorkUnits(analytics.totalWorkUnits)}</strong><small>{analytics.totalRecords} ngày có chấm công</small></div>
        <div className="report-kpi late"><Clock3 size={21} /><span>Ca đi trễ</span><strong>{analytics.lateCount}</strong><small>{analytics.totalLateMinutes} phút đi trễ</small></div>
        <div className="report-kpi incomplete"><LogOut size={21} /><span>Quên chấm ra</span><strong>{analytics.incompleteCount}</strong><small>Cần HR kiểm tra</small></div>
        <div className="report-kpi early"><Activity size={21} /><span>Ca về sớm</span><strong>{analytics.earlyLeaveCount}</strong><small>TB {analytics.averageWorkedMinutes} phút công</small></div>
      </div>

      <div className="report-chart-grid">
        <div className="report-chart-card">
          <div><strong>Phân loại ca cần chú ý</strong><span>Tổng hợp trên toàn bộ dữ liệu đang lọc</span></div>
          <div className="violation-bars">
            {violationMetrics.map((item) => (
              <div className="violation-row" key={item.label}>
                <span>{item.label}</span>
                <div><i className={item.className} style={{ width: `${Math.max(item.value ? 6 : 0, (item.value / maxViolation) * 100)}%` }} /></div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="report-chart-card">
          <div><strong>Xu hướng vi phạm 14 ngày</strong><span>Trễ · thiếu lượt ra · về sớm</span></div>
          {analytics.daily.length ? (
            <div className="daily-chart">
              {analytics.daily.map((item) => (
                <div className="daily-column" key={item.workDate} title={`${item.workDate}: trễ ${item.lateCount}, thiếu ra ${item.incompleteCount}, về sớm ${item.earlyLeaveCount}`}>
                  <div className="daily-bars">
                    <i className="late" style={{ height: `${Math.max(item.lateCount ? 5 : 0, (item.lateCount / maxDaily) * 100)}%` }} />
                    <i className="incomplete" style={{ height: `${Math.max(item.incompleteCount ? 5 : 0, (item.incompleteCount / maxDaily) * 100)}%` }} />
                    <i className="early" style={{ height: `${Math.max(item.earlyLeaveCount ? 5 : 0, (item.earlyLeaveCount / maxDaily) * 100)}%` }} />
                  </div>
                  <span>{item.workDate.slice(5).replace('-', '/')}</span>
                </div>
              ))}
            </div>
          ) : <div className="chart-empty">Chưa có dữ liệu trong khoảng thời gian này</div>}
          <div className="chart-legend"><span className="late">Đi trễ</span><span className="incomplete">Thiếu lượt ra</span><span className="early">Về sớm</span></div>
        </div>
      </div>
    </div>
  );
}

async function downloadAttendanceWorkbook(
  rows: AttendanceRow[],
  analytics: AttendanceAnalytics,
  filters: { from?: string; to?: string; department?: string; status?: string }
) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FaceLog Attendance';
  workbook.created = new Date();
  workbook.modified = new Date();

  const summary = workbook.addWorksheet('Tổng quan', { views: [{ showGridLines: false }] });
  summary.columns = Array.from({ length: 8 }, () => ({ width: 18 }));
  summary.mergeCells('A1:N2');
  const title = summary.getCell('A1');
  title.value = 'BÁO CÁO TỔNG QUAN CHẤM CÔNG';
  title.font = { name: 'Arial', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B67' } };

  summary.mergeCells('A3:N3');
  summary.getCell('A3').value = `Kỳ báo cáo: ${filters.from || 'Tất cả'} → ${filters.to || 'Hiện tại'}  |  Phòng ban: ${filters.department || 'Tất cả'}  |  Trạng thái: ${filters.status || 'Tất cả'}`;
  summary.getCell('A3').alignment = { horizontal: 'center' };
  summary.getCell('A3').font = { italic: true, color: { argb: 'FF64748B' } };

  const kpis = [
    { range: 'A5:B6', label: 'TỔNG CÔNG', value: formatWorkUnits(analytics.totalWorkUnits), color: 'FF2563EB' },
    { range: 'C5:D6', label: 'ĐI TRỄ', value: analytics.lateCount, color: 'FFF59E0B' },
    { range: 'E5:F6', label: 'QUÊN CHẤM RA', value: analytics.incompleteCount, color: 'FFDC2626' },
    { range: 'G5:H6', label: 'VỀ SỚM', value: analytics.earlyLeaveCount, color: 'FF7C3AED' }
  ];
  for (const kpi of kpis) {
    summary.mergeCells(kpi.range);
    const cell = summary.getCell(kpi.range.split(':')[0]);
    cell.value = `${kpi.label}\n${kpi.value}`;
    cell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } };
    cell.border = { top: { style: 'thin', color: { argb: 'FFFFFFFF' } }, left: { style: 'thin', color: { argb: 'FFFFFFFF' } }, bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } }, right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
  }

  summary.addTable({
    name: 'ViolationSummary', ref: 'A9', headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: [{ name: 'Phân loại' }, { name: 'Số ca' }, { name: 'Tỷ lệ' }],
    rows: [
      ['Đi trễ', analytics.lateCount, analytics.totalRecords ? analytics.lateCount / analytics.totalRecords : 0],
      ['Quên chấm ra', analytics.incompleteCount, analytics.totalRecords ? analytics.incompleteCount / analytics.totalRecords : 0],
      ['Về sớm', analytics.earlyLeaveCount, analytics.totalRecords ? analytics.earlyLeaveCount / analytics.totalRecords : 0],
      ['Tăng ca', analytics.overtimeCount, analytics.totalRecords ? analytics.overtimeCount / analytics.totalRecords : 0]
    ]
  });
  for (let row = 10; row <= 13; row += 1) summary.getCell(`C${row}`).numFmt = '0.0%';
  summary.getCell('A15').value = `Tổng phút đi trễ: ${analytics.totalLateMinutes}`;
  summary.getCell('A16').value = `Tổng công: ${formatWorkUnits(analytics.totalWorkUnits)} công`;
  summary.getCell('A17').value = `Phút làm việc trung bình (chi tiết): ${analytics.averageWorkedMinutes} phút/ca`;
  summary.getCell('A19').value = `Xuất lúc: ${formatDateTime(new Date().toISOString())}`;
  summary.getCell('A19').font = { italic: true, color: { argb: 'FF64748B' } };

  const details = workbook.addWorksheet('Chi tiết chấm công', {
    views: [{ state: 'frozen', ySplit: 8, showGridLines: false }]
  });
  details.mergeCells('A1:N2');
  const detailTitle = details.getCell('A1');
  detailTitle.value = 'CHI TIẾT CHẤM CÔNG NHÂN SỰ';
  detailTitle.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  detailTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  detailTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B67' } };
  details.mergeCells('A3:N3');
  details.getCell('A3').value = `${rows.length} ca · ${filters.from || 'Tất cả'} → ${filters.to || 'Hiện tại'}`;
  details.getCell('A3').alignment = { horizontal: 'center' };
  details.getCell('A3').font = { color: { argb: 'FF64748B' }, italic: true };

  details.addTable({
    name: 'AttendanceDetails', ref: 'A8', headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: [
      'STT', 'Ngày', 'Mã NV', 'Họ tên', 'Phòng ban', 'Ca làm', 'Giờ vào', 'Giờ ra',
      'Công', 'Phút làm việc', 'Đi trễ', 'Về sớm', 'Tăng ca', 'Trạng thái'
    ].map((name) => ({ name })),
    rows: rows.map((row, index) => [
      index + 1, row.workDate, row.employeeCode, row.fullName, row.departmentName ?? '-', row.shiftName ?? '-',
      formatDateTime(row.firstCheckIn), formatDateTime(row.lastCheckOut), Number(row.workUnits) || 0,
      row.workedMinutes, row.lateMinutes, row.earlyLeaveMinutes, row.overtimeMinutes, statusLabel(row.status)
    ])
  });
  const widths = [7, 13, 13, 26, 22, 18, 20, 20, 10, 14, 11, 11, 11, 18];
  widths.forEach((width, index) => { details.getColumn(index + 1).width = width; });
  details.getRow(8).height = 28;
  for (let index = 0; index < rows.length; index += 1) {
    const sheetRow = details.getRow(index + 9);
    sheetRow.alignment = { vertical: 'middle' };
    const source = rows[index];
    const statusCell = sheetRow.getCell(14);
    if (source.status === 'INCOMPLETE' || !source.lastCheckOut) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
      statusCell.font = { bold: true, color: { argb: 'FF991B1B' } };
    } else if (source.status === 'LATE' || source.lateMinutes > 0) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      statusCell.font = { bold: true, color: { argb: 'FF92400E' } };
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      statusCell.font = { bold: true, color: { argb: 'FF166534' } };
    }
    if (source.earlyLeaveMinutes > 0) sheetRow.getCell(12).font = { bold: true, color: { argb: 'FF7C3AED' } };
    if (source.overtimeMinutes > 0) sheetRow.getCell(13).font = { bold: true, color: { argb: 'FF1D4ED8' } };
  }
  details.autoFilter = { from: 'A8', to: 'N8' };

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `bao-cao-cham-cong-${localDate()}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function EmployeeTable({ employees, onSort, onEdit, onDelete }: { employees: EmployeeRow[]; onSort: (field: string) => void; onEdit: (employee: EmployeeRow) => void; onDelete: (employee: EmployeeRow) => void }) {
  return <div className="table-wrap"><table><thead><tr><SortHead label="Mã NV" field="employeeCode" onSort={onSort} /><SortHead label="Họ tên" field="fullName" onSort={onSort} /><SortHead label="Phòng ban" field="departmentName" onSort={onSort} /><SortHead label="Chức vụ" field="positionName" onSort={onSort} /><th>FaceID</th><SortHead label="Trạng thái" field="employmentStatus" onSort={onSort} /><th>Thao tác</th></tr></thead><tbody>
    {employees.map((employee) => <tr key={employee.employeeId}><td className="mono">{employee.employeeCode}</td><td><div className="person-cell"><div className="avatar">{employee.fullName.slice(0, 1)}</div><div><strong>{employee.fullName}</strong><span>{employee.email ?? employee.phone ?? '-'}</span></div></div></td><td>{employee.departmentName ?? '-'}</td><td>{employee.positionName ?? '-'}</td><td><span className={`pill ${employee.faceStatus === 'ACTIVE' ? 'ok' : employee.faceStatus === 'DISABLED' ? 'danger' : 'warn'}`}>{faceStatusLabel(employee.faceStatus)}</span></td><td>{statusLabel(employee.employmentStatus)}</td><td><div className="row-actions"><button title="Sửa" type="button" onClick={() => onEdit(employee)}><Edit2 size={16} /></button><button title="Nghỉ việc" className="danger-action" type="button" disabled={employee.employmentStatus === 'RESIGNED'} onClick={() => onDelete(employee)}><Trash2 size={16} /></button></div></td></tr>)}
    {!employees.length && <tr><td className="empty-cell" colSpan={7}>Không có nhân viên phù hợp</td></tr>}
  </tbody></table></div>;
}

function AttendanceTable({ rows, onSort, onDelete, onView, deletingSession, detailLoading }: { rows: AttendanceRow[]; onSort: (field: string) => void; onDelete?: (row: AttendanceRow) => void; onView?: (row: AttendanceRow) => void; deletingSession?: string | null; detailLoading?: boolean }) {
  const hasActions = Boolean(onDelete || onView);
  return <div className="table-wrap"><table><thead><tr><SortHead label="Ngày" field="workDate" onSort={onSort} /><SortHead label="Nhân viên" field="fullName" onSort={onSort} /><SortHead label="Phòng ban" field="departmentName" onSort={onSort} /><SortHead label="Vào" field="firstCheckIn" onSort={onSort} /><SortHead label="Ra" field="lastCheckOut" onSort={onSort} /><th>Công</th><th>Phút làm việc</th><SortHead label="Trễ" field="lateMinutes" onSort={onSort} /><SortHead label="Trạng thái" field="status" onSort={onSort} />{hasActions && <th>Thao tác</th>}</tr></thead><tbody>
    {rows.map((row) => { const sessionKey = `${row.employeeId}:${row.workDate}`; return <tr key={row.summaryId}><td>{new Intl.DateTimeFormat('vi-VN').format(new Date(`${row.workDate}T00:00:00`))}</td><td><strong>{row.fullName}</strong><span className="subtext">{row.employeeCode}</span></td><td>{row.departmentName ?? '-'}</td><td>{formatDateTime(row.firstCheckIn)}</td><td>{formatDateTime(row.lastCheckOut)}</td><td><strong>{formatWorkUnits(row.workUnits)}</strong></td><td>{row.workedMinutes}</td><td>{row.lateMinutes}</td><td><span className={`pill ${row.status === 'PRESENT' ? 'ok' : row.status === 'LATE' ? 'warn' : 'danger'}`}>{statusLabel(row.status)}</span></td>{hasActions && <td><div className="row-actions">{onView && <button title="Xem đầy đủ chi tiết sự kiện" type="button" disabled={detailLoading} onClick={() => onView(row)}><Eye size={16} /></button>}{onDelete && <button title="Xóa phiên để chấm công lại" className="danger-action" type="button" disabled={deletingSession === sessionKey} onClick={() => onDelete(row)}>{deletingSession === sessionKey ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}</button>}</div></td>}</tr>; })}
    {!rows.length && <tr><td className="empty-cell" colSpan={hasActions ? 10 : 9}>Không có dữ liệu chấm công phù hợp</td></tr>}
  </tbody></table></div>;
}

function AuditTable({ rows, onView }: { rows: AuditRow[]; onView: (row: AuditRow) => void }) {
  const labels: Record<string, string> = { EMPLOYEE_CREATED: 'Thêm nhân viên', EMPLOYEE_UPDATED: 'Sửa nhân viên', EMPLOYEE_DEACTIVATED: 'Nhân viên nghỉ việc', EMPLOYEE_AUTO_RESIGNED: 'Tự động hết hạn làm việc', EMPLOYEE_SHIFT_ASSIGNED: 'Gán ca làm mặc định', FACE_ID_ENROLLED: 'Đăng ký FaceID', ATTENDANCE_RECORDED: 'Ghi nhận chấm công', ATTENDANCE_SESSION_DELETED: 'Xóa phiên chấm công', ACCOUNT_REGISTERED: 'Đăng ký tài khoản', ACCOUNT_CREATED: 'Tạo tài khoản', ACCOUNT_UPDATED: 'Cập nhật tài khoản', ACCOUNT_PASSWORD_RESET: 'Đổi mật khẩu tài khoản', ACCOUNT_DISABLED: 'Vô hiệu hóa tài khoản', SHIFT_CREATED: 'Tạo ca làm', SHIFT_UPDATED: 'Cập nhật ca làm', ATTENDANCE_DATA_REPAIRED: 'Sửa loại lượt chấm công', ATTENDANCE_SUMMARY_REPAIRED: 'Tính lại tổng hợp chấm công', SEED_DATABASE: 'Khởi tạo dữ liệu' };
  return <div className="table-wrap"><table><thead><tr><th>Thời gian</th><th>Phân loại</th><th>Hành động</th><th>Đối tượng</th><th>Tài khoản</th><th>IP</th><th>Chi tiết</th></tr></thead><tbody>{rows.map((row) => <tr key={row.auditLogId}><td>{formatDateTime(row.createdAt)}</td><td><span className="audit-code">{auditActionCode(row.action)}</span></td><td><strong>{labels[row.action] ?? row.action}</strong><span className="subtext mono">{row.action}</span></td><td>{row.entityType}<span className="subtext">#{row.entityId ?? '-'}</span></td><td>{row.actorUsername ?? 'Hệ thống'}</td><td>{row.ipAddress ?? '-'}</td><td><div className="row-actions"><button title="Xem chi tiết nhật ký" type="button" onClick={() => onView(row)}><Eye size={16} /></button></div></td></tr>)}{!rows.length && <tr><td className="empty-cell" colSpan={7}>Chưa có nhật ký phù hợp</td></tr>}</tbody></table></div>;
}

function auditActionCode(action: string) {
  if (/_DELETED$|_DISABLED$|_DEACTIVATED$/.test(action)) return 'DEL';
  if (/_UPDATED$|_RESET$|_REPAIRED$/.test(action)) return 'UD';
  if (action.startsWith('ATTENDANCE_')) return 'ATT';
  if (action.startsWith('AUTH_')) return 'AUTH';
  if (/_CREATED$|_REGISTERED$|_ENROLLED$/.test(action)) return 'ADD';
  return 'SYS';
}

function parseAuditJson(value: AuditRow['beforeJson']) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return { raw: value }; }
}

function DetailModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation"><section className="modal detail-modal" role="dialog" aria-modal="true"><div className="modal-header"><div><h2>{title}</h2><p>Dữ liệu đầy đủ từ máy chủ</p></div><button className="icon-button" type="button" onClick={onClose}>×</button></div><div className="detail-content">{children}</div><div className="modal-actions"><button className="button primary" type="button" onClick={onClose}>Đóng</button></div></section></div>;
}

function DetailObject({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  return <section className="detail-section"><h3>{title}</h3>{value ? <div className="detail-grid">{Object.entries(value).map(([key, item]) => <div key={key}><span>{detailLabel(key)}</span><strong>{detailValue(item)}</strong></div>)}</div> : <p>Không có dữ liệu</p>}</section>;
}

function DetailList({ title, values }: { title: string; values: Array<Record<string, unknown>> }) {
  return <section className="detail-section"><h3>{title}</h3>{values.length ? values.map((value, index) => <div className="detail-list-item" key={String(value.attendanceLogId ?? value.attemptId ?? index)}><strong>#{index + 1}</strong><div className="detail-grid">{Object.entries(value).map(([key, item]) => <div key={key}><span>{detailLabel(key)}</span><strong className={key === 'errorMessage' && item ? 'detail-error' : ''}>{detailValue(item)}</strong></div>)}</div></div>) : <p>Không có dữ liệu hoặc lỗi được ghi nhận.</p>}</section>;
}

function detailValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  return String(value);
}

function detailLabel(key: string) {
  const labels: Record<string, string> = { employeeId: 'ID nhân viên', employeeCode: 'Mã nhân viên', fullName: 'Họ tên', departmentName: 'Phòng ban', positionName: 'Chức vụ', eventType: 'Loại sự kiện', eventTime: 'Thời gian', method: 'Phương thức', deviceName: 'Tên máy', deviceCode: 'Mã máy', deviceType: 'Loại máy', locationName: 'Vị trí máy', deviceIp: 'IP máy', deviceStatus: 'Trạng thái máy', recognitionConfidence: 'Độ tin cậy', livenessScore: 'Người thật', faceQualityScore: 'Chất lượng mặt', reviewStatus: 'Kiểm duyệt', result: 'Kết quả', errorMessage: 'Lỗi', attemptedAt: 'Thời gian nhận diện', processingMs: 'Thời gian xử lý (ms)', shiftName: 'Ca làm', shiftStartTime: 'Giờ bắt đầu', shiftEndTime: 'Giờ kết thúc', earlyLeaveGraceMinutes: 'Cho phép ra sớm (phút)', first_check_in: 'Giờ vào', last_check_out: 'Giờ ra', worked_minutes: 'Phút công', late_minutes: 'Phút trễ', early_leave_minutes: 'Phút về sớm', status: 'Trạng thái', actorUsername: 'Tài khoản thực hiện', actorRole: 'Vai trò', beforeJson: 'Dữ liệu trước', afterJson: 'Dữ liệu sau', userAgent: 'Trình duyệt/thiết bị' };
  return labels[key] ?? key.replace(/([A-Z_])/g, ' $1').trim();
}

function Pager({ pagination, onPage }: { pagination: Pagination; onPage: (page: number) => void }) {
  if (pagination.totalPages <= 1) return null;
  return <div className="pagination"><span>Trang {pagination.page}/{pagination.totalPages} · {pagination.total} dòng</span><div><button type="button" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}><ChevronLeft size={17} />Trước</button><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>Sau<ChevronRight size={17} /></button></div></div>;
}

function EmployeeModal({ employee, meta, saving, onClose, onSubmit }: { employee: EmployeeRow | null; meta: EmployeeMeta; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [fullName, setFullName] = useState(employee?.fullName ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(employee?.dateOfBirth ?? '');
  const generatedEmployeeCode = previewEmployeeCode(fullName, dateOfBirth);
  return <div className="modal-backdrop" role="presentation"><form className="modal employee-modal" onSubmit={onSubmit}><div className="modal-header"><div><h2>{employee ? 'Cập nhật nhân viên' : 'Thêm nhân viên'}</h2><p>Thông tin hồ sơ nhân sự</p></div><button className="icon-button" type="button" onClick={onClose}>×</button></div><div className="form-grid">
    <label>Mã nhân viên tự động<input value={generatedEmployeeCode} placeholder="Nhập họ tên và ngày sinh" readOnly /></label><label>Họ tên<input name="fullName" required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
    <label>Giới tính<select name="gender" defaultValue={employee?.gender ?? ''}><option value="">Chưa chọn</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></label><label>Ngày sinh<input name="dateOfBirth" type="date" required value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /></label>
    <label>Email<input name="email" type="email" defaultValue={employee?.email ?? ''} /></label><label>Điện thoại<input name="phone" defaultValue={employee?.phone ?? ''} /></label>
    <label>Phòng ban<select name="departmentId" defaultValue={employee?.departmentId ?? ''}><option value="">Chưa chọn</option>{meta.departments.map((item) => <option key={item.departmentId} value={item.departmentId}>{item.departmentName}</option>)}</select></label><label>Chức vụ<select name="positionId" defaultValue={employee?.positionId ?? ''}><option value="">Chưa chọn</option>{meta.positions.map((item) => <option key={item.positionId} value={item.positionId}>{item.positionName}</option>)}</select></label>
    <label>Loại hợp đồng<select name="employmentType" defaultValue={employee?.employmentType ?? 'FULL_TIME'}><option value="FULL_TIME">Toàn thời gian</option><option value="PART_TIME">Bán thời gian</option><option value="INTERN">Thực tập</option><option value="CONTRACTOR">Cộng tác viên</option></select></label><label>Trạng thái<select name="employmentStatus" defaultValue={employee?.employmentStatus ?? 'ACTIVE'}><option value="ACTIVE">Đang làm</option><option value="ON_LEAVE">Tạm nghỉ</option><option value="SUSPENDED">Tạm khóa</option><option value="RESIGNED">Đã nghỉ</option></select></label>
    <label>Ngày vào làm<input name="hireDate" type="date" required defaultValue={employee?.hireDate ?? localDate()} /></label><label>Ngày nghỉ việc<input name="terminationDate" type="date" defaultValue={employee?.terminationDate ?? ''} /></label>
    <label className="form-span">Địa chỉ<input name="address" defaultValue={employee?.address ?? ''} /></label><label className="form-span">Ghi chú<textarea name="note" defaultValue={employee?.note ?? ''} /></label>
  </div><div className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>Hủy</button><button className="button primary" type="submit" disabled={saving}>{saving && <Loader2 size={17} className="spin" />}{employee ? 'Lưu thay đổi' : 'Thêm nhân viên'}</button></div></form></div>;
}

function previewEmployeeCode(fullName: string, dateOfBirth: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return '';
  const initial = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/[^a-z]/gi, '').charAt(0).toUpperCase();
  const initials = [parts.at(-1)!, parts[0], ...parts.slice(1, -1)].map(initial).join('');
  const [year, month, day] = dateOfBirth.split('-');
  return `${initials}0${day}${month}${year.slice(-2)}`;
}
