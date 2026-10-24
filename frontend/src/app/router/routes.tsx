import { createBrowserRouter } from 'react-router-dom';
import { TaskSubmissionsPage } from '../../features/task-submissions/pages';
import { lazy, Suspense } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import { DossierListPage, DossierDetailPage } from '../../features/proposal-dossiers/pages';
import { GuidancePlanListPage, GuidancePlanDetailPage, GuidanceTaskListPage, GuidanceTaskCreatePage, GuidanceTaskDetailPage } from '../../features/guidance-tasks/pages';
import { ProposalReviewQueuePage, ProposalReviewDetailPage, ProposalReviewAssignmentPage } from '../../features/proposal-reviews/pages';
import { ProposalEditorListPage, ProposalEditorPage } from '../../features/proposal-versions/pages';
import { ReviewGroupLayout, ReviewGroupListPage, ReviewGroupEditorPage, ReviewGroupDetailPage } from '../../features/review-groups/pages';

const LoginPage = lazy(() => import('../../features/auth/pages/LoginPage'));
const ProgressReviewInboxPage=lazy(()=>import('../../features/guidance-reviews/pages').then(m=>({default:m.ProgressReviewInboxPage})));
const ProgressReviewDetailPage=lazy(()=>import('../../features/guidance-reviews/pages').then(m=>({default:m.ProgressReviewDetailPage})));
const GuidanceProgressDashboardPage=lazy(()=>import('../../features/guidance-reviews/pages').then(m=>({default:m.GuidanceProgressDashboardPage})));
const GuidanceMeetingsPage=lazy(()=>import('../../features/guidance-reviews/pages').then(m=>({default:m.GuidanceMeetingsPage})));
const GuidanceNotificationsPage=lazy(()=>import('../../features/guidance-reviews/pages').then(m=>({default:m.GuidanceNotificationsPage})));
const DashboardPage = lazy(() => import('../../features/report/pages/DashboardPage'));
const AccountsPage = lazy(() => import('../../features/auth/pages/AccountsPage'));
const RolesPermissionsPage = lazy(() => import('../../features/auth/pages/RolesPermissionsPage'));
const AuditLogPage = lazy(() => import('../../features/auth/pages/AuditLogPage'));

const StudentListPage = lazy(() => import('../../features/catalog/pages/StudentListPage'));
const LecturerListPage = lazy(() => import('../../features/catalog/pages/LecturerListPage'));
const ImportPage = lazy(() => import('../../features/catalog/pages/ImportPage'));

const TermListPage = lazy(() => import('../../features/term/pages/TermListPage'));
const TermDetailPage = lazy(() => import('../../features/term/pages/TermDetailPage'));
const PhasePlanPage = lazy(() => import('../../features/term/pages/PhasePlanPage'));
const TermParameterPage = lazy(() => import('../../features/term/pages/TermParameterPage'));
const TermRosterPage = lazy(() => import('../../features/term/pages/TermRosterPage'));

const StudentRegistrationPage = lazy(() => import('../../features/registration/pages/StudentRegistrationPage'));
const AssignmentPlanPage = lazy(() => import('../../features/registration/pages/AssignmentPlanPage'));
const AssignmentResultPage = lazy(() => import('../../features/registration/pages/AssignmentResultPage'));
const ManualAdjustPage = lazy(() => import('../../features/registration/pages/ManualAdjustPage'));

const MyTopicPage = lazy(() => import('../../features/topic/pages/MyTopicPage'));

const DefenseConfirmPage = lazy(() => import('../../features/guidance/pages/DefenseConfirmPage'));
const FinalReportUploadPage = lazy(() => import('../../features/guidance/pages/FinalReportUploadPage'));

const EligibilityPage = lazy(() => import('../../features/defense/pages/EligibilityPage'));
const DefermentPage = lazy(() => import('../../features/defense/pages/DefermentPage'));
const ReviewerAssignPage = lazy(() => import('../../features/defense/pages/ReviewerAssignPage'));
const CommitteePage = lazy(() => import('../../features/defense/pages/CommitteePage'));
const SchedulePage = lazy(() => import('../../features/defense/pages/SchedulePage'));
const MinutesPage = lazy(() => import('../../features/defense/pages/MinutesPage'));

const RubricPage = lazy(() => import('../../features/grading/pages/RubricPage'));
const ScoreEntryPage = lazy(() => import('../../features/grading/pages/ScoreEntryPage'));
const ResultPage = lazy(() => import('../../features/grading/pages/ResultPage'));
const ExportCenterPage = lazy(() => import('../../features/report/pages/ExportCenterPage'));

const Loader = () => <div className="flex items-center justify-center h-screen text-gray-500 font-medium">Đang tải...</div>;
const wrap = (el: React.ReactNode) => <Suspense fallback={<Loader />}>{el}</Suspense>;

export const router = createBrowserRouter([
  {path:'/guidance/review',element:<ReviewGroupLayout guidanceMode/>,children:[{index:true,element:wrap(<ProgressReviewInboxPage/>)},{path:':submissionId',element:wrap(<ProgressReviewDetailPage/>)}]},
  {path:'/guidance/progress',element:<ReviewGroupLayout guidanceMode/>,children:[{index:true,element:wrap(<GuidanceProgressDashboardPage/>)}]},
  {path:'/guidance/meetings',element:<ReviewGroupLayout guidanceMode/>,children:[{index:true,element:wrap(<GuidanceMeetingsPage/>)}]},
  {path:'/guidance/notifications',element:<ReviewGroupLayout guidanceMode/>,children:[{index:true,element:wrap(<GuidanceNotificationsPage/>)}]},
  {path:'/guidance/plan',element:<ReviewGroupLayout guidanceMode/>,children:[
    {index:true,element:<GuidancePlanListPage/>},
    {path:':proposalId',element:<GuidancePlanDetailPage/>},
    {path:':proposalId/tasks/new',element:<GuidanceTaskCreatePage/>},
  ]},
  {path:'/guidance/tasks',element:<ReviewGroupLayout guidanceMode/>,children:[
    {index:true,element:<GuidanceTaskListPage/>},
    {path:':id',element:<GuidanceTaskDetailPage/>},
    {path:':id/submissions',element:<TaskSubmissionsPage/>},
  ]},
  { path: '/topic/dossier', element: <ReviewGroupLayout dossierMode />, children: [
    { index: true, element: <DossierListPage /> },
    { path: ':proposalId', element: <DossierDetailPage /> },
  ] },
  { path: '/topic/proposal', element: <ReviewGroupLayout versionMode />, children: [
    { index: true, element: <ProposalEditorListPage /> },
    { path: ':proposalId', element: <ProposalEditorPage /> },
    { path: ':proposalId/versions/:versionId', element: <ProposalEditorPage /> },
  ] },
  { path: '/topic/reviews', element: <ReviewGroupLayout reviewMode />, children: [
    { index: true, element: <ProposalReviewQueuePage /> },
    { path: ':id', element: <ProposalReviewDetailPage /> },
  ] },
  { path: '/topic/review-assignments/:proposalId', element: <ReviewGroupLayout reviewMode />, children: [{ index: true, element: <ProposalReviewAssignmentPage /> }] },
  { path: '/login', element: wrap(<LoginPage />) },
  { path: '/topic/review-groups', element: <ReviewGroupLayout />, children: [
    { index: true, element: <ReviewGroupListPage /> },
    { path: 'new', element: <ReviewGroupEditorPage /> },
    { path: ':id/edit', element: <ReviewGroupEditorPage /> },
    { path: ':id', element: <ReviewGroupDetailPage /> },
  ] },
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: wrap(<DashboardPage />) },
      { path: 'admin/accounts', element: wrap(<AccountsPage />) },
      { path: 'admin/roles', element: wrap(<RolesPermissionsPage />) },
      { path: 'admin/audit-logs', element: wrap(<AuditLogPage />) },
      
      { path: 'catalog/students', element: wrap(<StudentListPage />) },
      { path: 'catalog/lecturers', element: wrap(<LecturerListPage />) },
      { path: 'catalog/import', element: wrap(<ImportPage />) },

      { path: 'terms', element: wrap(<TermListPage />) },
      { path: 'terms/:id', element: wrap(<TermDetailPage />) },
      { path: 'terms/:id/phases', element: wrap(<PhasePlanPage />) },
      { path: 'terms/:id/parameters', element: wrap(<TermParameterPage />) },
      { path: 'terms/:id/roster', element: wrap(<TermRosterPage />) },

      { path: 'registration', element: wrap(<StudentRegistrationPage />) },
      { path: 'registration/assignment', element: wrap(<AssignmentPlanPage />) },
      { path: 'registration/result', element: wrap(<AssignmentResultPage />) },
      { path: 'registration/manual', element: wrap(<ManualAdjustPage />) },

      { path: 'topic/my', element: wrap(<MyTopicPage />) },

      { path: 'guidance/defense-confirm', element: wrap(<DefenseConfirmPage />) },
      { path: 'guidance/final-report', element: wrap(<FinalReportUploadPage />) },

      { path: 'defense/eligibility', element: wrap(<EligibilityPage />) },
      { path: 'defense/deferment', element: wrap(<DefermentPage />) },
      { path: 'defense/reviewers', element: wrap(<ReviewerAssignPage />) },
      { path: 'defense/committee', element: wrap(<CommitteePage />) },
      { path: 'defense/schedule', element: wrap(<SchedulePage />) },
      { path: 'defense/minutes', element: wrap(<MinutesPage />) },

      { path: 'grading/rubric', element: wrap(<RubricPage />) },
      { path: 'grading/scores', element: wrap(<ScoreEntryPage />) },
      { path: 'grading/results', element: wrap(<ResultPage />) },

      { path: 'report/export', element: wrap(<ExportCenterPage />) },
    ],
  },
]);
