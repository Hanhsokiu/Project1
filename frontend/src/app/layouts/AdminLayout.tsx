import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserCog,
  CalendarDays,
  ClipboardList,
  BarChart3,
  Shield,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/admin/accounts', label: 'Tài khoản & Phân quyền', icon: UserCog },
  { to: '/catalog/students', label: 'Sinh viên', icon: GraduationCap },
  { to: '/catalog/lecturers', label: 'Giảng viên', icon: Users },
  { to: '/terms', label: 'Đợt đồ án', icon: CalendarDays },
  { to: '/topic/review-groups', label: 'Nhóm duyệt đề cương', icon: ClipboardList },
  { to: '/report/export', label: 'Báo cáo & Thống kê', icon: BarChart3 },
];

export default function AdminLayout() {
  const { pathname } = useLocation();

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="admin-sidebar-logo">
            <Shield size={20} />
          </span>
          <h2 className="admin-sidebar-title">QLDATN Admin</h2>
        </div>
        <nav className="admin-sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const isActive = pathname === to || (to !== '/' && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`admin-nav-item${isActive ? ' active' : ''}`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
