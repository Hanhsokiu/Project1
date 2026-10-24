import React, { useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  BarChart3,
  Calendar,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Search,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { reviewGroupApi as api } from './api';
import { proposalReviewApi } from '../proposal-reviews/api';
import { proposalVersionApi } from '../proposal-versions/api';
import './workspace.css';

const navigation = [
  { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/registration', label: 'Đăng ký đề tài & GVHD', icon: ClipboardList },
  { to: '/topic/review-groups', label: 'Nhóm duyệt đề cương', icon: Users },
  { to: '/topic/reviews', label: 'Phân công & xét duyệt', icon: ClipboardList },
  { to: '/topic/proposal', label: 'Đề cương & phiên bản', icon: FileText },
  { to: '/topic/dossier', label: 'Chốt đề cương & bản giấy', icon: FileText },
  { to: '/terms', label: 'Đợt đồ án', icon: Calendar },
  { to: '/guidance/plan', label: 'Kế hoạch hướng dẫn', icon: BookOpen },
  { to: '/guidance/tasks', label: 'Nhiệm vụ & tiến độ', icon: ClipboardList },
  { to: '/guidance/review', label: 'Nhận xét báo cáo', icon: FileText },
  { to: '/guidance/progress', label: 'Theo dõi tiến độ Khoa', icon: BarChart3 },
  { to: '/guidance/meetings', label: 'Nhật ký hướng dẫn', icon: Calendar },
  { to: '/guidance/notifications', label: 'Thông báo của tôi', icon: FileText },
  {
    to: '/defense/committee',
    label: 'Hội đồng & phản biện',
    icon: GraduationCap,
  },
  { to: '/grading/results', label: 'Chấm điểm & kết quả', icon: FileText },
  { to: '/report/export', label: 'Thống kê & báo cáo', icon: BarChart3 },
];

export function ReviewGroupLayout({
  reviewMode = false,
  versionMode = false,
  dossierMode = false,
  guidanceMode = false,
}: {
  reviewMode?: boolean;
  versionMode?: boolean;
  dossierMode?: boolean;
  guidanceMode?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [params] = useSearchParams();
  const { id, proposalId } = useParams();
  const navigate = useNavigate();
  const terms = useQuery({
    queryKey: [
      reviewMode || versionMode || dossierMode || guidanceMode
        ? 'proposal-review-terms'
        : 'review-group-terms',
    ],
    queryFn: reviewMode || versionMode || dossierMode || guidanceMode ? proposalReviewApi.terms : api.terms,
  });
  const group = useQuery({
    queryKey: [reviewMode ? 'proposal-review' : 'review-group', id],
    queryFn: async () =>
      reviewMode ? proposalReviewApi.detail(id!) : api.detail(id!),
    enabled: !!id && !versionMode && !dossierMode && !guidanceMode,
  });
  const proposal = useQuery({
    queryKey: [
      versionMode ? 'proposal-editing-context' : 'review-proposal',
      proposalId,
    ],
    queryFn: async () =>
      versionMode
        ? proposalVersionApi.context(proposalId!)
        : proposalReviewApi.proposal(proposalId!),
    enabled: (reviewMode || versionMode) && !!proposalId,
  });
  const termId =
    group.data?.termId ?? proposal.data?.termId ?? params.get('termId') ?? '';
  const term = terms.data?.find((t) => t.id === termId);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  return (
    <div className="rg-workspace">
      {open && (
        <button
          className="rg-nav-backdrop"
          aria-label="Đóng điều hướng"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="review-workspace-navigation"
        className={`rg-sidebar ${open ? 'rg-sidebar-open' : ''}`}
        aria-label="Điều hướng chính"
      >
        <Link to="/" className="rg-brand">
          <span className="rg-brand-mark">
            <GraduationCap size={24} />
          </span>
          <span>
            <strong>KHOA CNTT · UTC</strong>
            <small>Hệ thống Quản lý Đồ án</small>
          </span>
        </Link>
        <div className="rg-term-card">
          <span className="rg-eyebrow">
            Đợt đồ án đang xem <i />
          </span>
          <strong>{term?.name ?? 'Chưa chọn đợt đồ án'}</strong>
          <small>
            {term
              ? guidanceMode
                ? 'Kế hoạch & nhiệm vụ hướng dẫn'
                : dossierMode
                ? 'Chốt đề cương & bản giấy'
                : versionMode
                ? 'Đề cương & phiên bản'
                : reviewMode
                  ? 'Phân công & xét duyệt'
                  : 'Nhóm duyệt đề cương'
              : 'Chọn đợt trong không gian làm việc'}
          </small>
        </div>
        <p className="rg-nav-section">QUẢN LÝ ĐÀO TẠO</p>
        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rg-nav-item ${isActive || (reviewMode && to === '/topic/reviews') || (versionMode && to === '/topic/proposal') || (dossierMode && to === '/topic/dossier') ? 'rg-nav-active' : ''}`
              }
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{label}</span>
              {to === '/topic/review-groups' && <ChevronRight size={15} />}
            </NavLink>
          ))}
        </nav>
        <div className="rg-sidebar-footer">
          <span className="rg-footer-icon">
            <ShieldCheck size={18} />
          </span>
          <div>
            <strong>Không gian học thuật</strong>
            <small>Đồng hành cùng đồ án tốt nghiệp</small>
          </div>
        </div>
      </aside>
      <div className="rg-main">
        <header className="rg-topbar">
          <button
            className="rg-mobile-menu"
            aria-label={open ? 'Đóng menu' : 'Mở điều hướng'}
            aria-expanded={open}
            aria-controls="review-workspace-navigation"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
          <form
            className="rg-header-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const query =
                new FormData(event.currentTarget)
                  .get('query')
                  ?.toString()
                  .trim() ?? '';
              const next = new URLSearchParams({ search: query });
              if (termId) next.set('termId', termId);
              navigate(
                `${guidanceMode ? '/guidance/tasks' : dossierMode ? '/topic/dossier' : versionMode ? '/topic/proposal' : reviewMode ? '/topic/reviews' : '/topic/review-groups'}?${next}`,
              );
            }}
          >
            <Search size={17} />
            <input
              name="query"
              aria-label={
                guidanceMode ? 'Tìm kiếm nhiệm vụ' : reviewMode || versionMode || dossierMode
                  ? 'Tìm kiếm đề cương'
                  : 'Tìm kiếm nhóm duyệt'
              }
              placeholder={
                guidanceMode ? 'Tìm nhiệm vụ…' : reviewMode || versionMode || dossierMode
                  ? 'Tìm đề cương…'
                  : 'Tìm nhóm duyệt đề cương…'
              }
            />
            <button
              type="submit"
              aria-label={
                guidanceMode ? 'Tìm nhiệm vụ' : reviewMode || versionMode || dossierMode ? 'Tìm đề cương' : 'Tìm nhóm'
              }
            >
              <ChevronRight size={17} />
            </button>
          </form>
          <div className="rg-topbar-context">
            <span className="rg-context-label">
              <GraduationCap size={16} /> Quản lý đồ án tốt nghiệp
            </span>
            {import.meta.env.VITE_REVIEW_GROUP_DEMO === 'true' && (
              <span className="rg-demo-chip">BẢN DEMO</span>
            )}
            <span className="rg-profile-icon" aria-hidden="true">
              <UserCircle size={23} />
            </span>
          </div>
        </header>
        <main className="rg-content">
          <div className="rg-breadcrumb">
            <GraduationCap size={14} />
            <span>Cổng thông tin Khoa CNTT</span>
            <ChevronRight size={12} />
            <span>
              {guidanceMode
                ? 'Kế hoạch & nhiệm vụ hướng dẫn'
                : dossierMode
                ? 'Chốt đề cương & bản giấy'
                : versionMode
                ? 'Đề cương & phiên bản'
                : reviewMode
                  ? 'Phân công & xét duyệt'
                  : 'Nhóm duyệt đề cương'}
            </span>
          </div>
          <Outlet />
        </main>
        <footer className="rg-page-footer">
          <span>Hệ thống Quản lý Hướng dẫn Đồ án Tốt nghiệp</span>
          <span>Không gian học thuật · UTC</span>
        </footer>
      </div>
    </div>
  );
}
