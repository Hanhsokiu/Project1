import React from 'react';

export default function DashboardPage() {
  const stats = [
    { label: 'Đợt đang hoạt động', value: '1', change: 'Học kỳ 1 (2024-2025)' },
    { label: 'Sinh viên tham gia', value: '128', change: '+12% so với kỳ trước' },
    { label: 'Giảng viên hướng dẫn', value: '34', change: 'Đã nhận đủ chỉ tiêu' },
    { label: 'Đề tài đã duyệt', value: '62', change: '95% đề cương đạt yêu cầu' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tổng quan Hệ Thống Quản Lý Đồ Án</h1>
        <p className="text-sm text-gray-500 mt-1">Khoa Công nghệ Thông tin - Bảng điều khiển tác vụ</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{s.label}</p>
            <p className="text-3xl font-extrabold text-blue-600 mt-2">{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tiến độ đợt hiện tại</h2>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">Đăng ký đề tài & GVHD</span>
              <span className="text-green-600 font-semibold">Đã hoàn thành</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full w-full"></div>
            </div>

            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">Phê duyệt đề cương</span>
              <span className="text-blue-600 font-semibold">Đang diễn ra (80%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full w-4/5"></div>
            </div>

            <div className="flex justify-between text-sm">
              <span className="font-medium text-gray-700">Thực hiện đồ án & Hướng dẫn</span>
              <span className="text-gray-500">Chờ mở</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-gray-300 h-2 rounded-full w-1/4"></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Lối tắt nhanh</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <a href="/catalog/students" className="p-3 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-gray-700 font-medium">
              👨‍🎓 Quản lý sinh viên
            </a>
            <a href="/catalog/lecturers" className="p-3 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-gray-700 font-medium">
              👨‍🏫 Quản lý giảng viên
            </a>
            <a href="/terms" className="p-3 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-gray-700 font-medium">
              📅 Đợt đồ án
            </a>
            <a href="/grading/scores" className="p-3 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-gray-700 font-medium">
              📝 Nhập điểm đánh giá
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
