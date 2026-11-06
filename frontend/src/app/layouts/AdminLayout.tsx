import React from 'react';
import { Outlet, Link } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold">QLDATN - ADMIN</h2>
        </div>
        <nav className="flex-1 p-4 space-y-1 text-sm">
          <Link to="/" className="block px-3 py-2 rounded hover:bg-slate-800">Tổng quan</Link>
          <Link to="/admin/accounts" className="block px-3 py-2 rounded hover:bg-slate-800">Tài khoản & Phân quyền</Link>
          <Link to="/catalog/students" className="block px-3 py-2 rounded hover:bg-slate-800">Sinh viên</Link>
          <Link to="/catalog/lecturers" className="block px-3 py-2 rounded hover:bg-slate-800">Giảng viên</Link>
          <Link to="/terms" className="block px-3 py-2 rounded hover:bg-slate-800">Đợt đồ án</Link>
          <Link to="/topic/review-groups" className="block px-3 py-2 rounded hover:bg-slate-800">Nhóm duyệt đề cương</Link>
          <Link to="/report/export" className="block px-3 py-2 rounded hover:bg-slate-800">Báo cáo & Thống kê</Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
