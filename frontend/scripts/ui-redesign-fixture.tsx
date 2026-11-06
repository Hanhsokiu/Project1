// Test-only renderer for existing screens that are not registered in the app router.
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WorkspaceLayout from "../src/app/layouts/WorkspaceLayout";
import Eligibility from "../src/features/defense/pages/EligibilityPage";
import Reviewers from "../src/features/defense/pages/ReviewerAssignPage";
import Committees from "../src/features/defense/pages/CommitteePage";
import Schedule from "../src/features/defense/pages/SchedulePage";
import Minutes from "../src/features/defense/pages/MinutesPage";
import Deferments from "../src/features/defense/pages/DefermentPage";
import Rubric from "../src/features/grading/pages/RubricPage";
import Scores from "../src/features/grading/pages/ScoreEntryPage";
import Results from "../src/features/grading/pages/ResultPage";
import GuidancePlan from "../src/features/guidance/pages/GuidancePlanPage";
import TaskBoard from "../src/features/guidance/pages/TaskBoardPage";
import TaskReview from "../src/features/guidance/pages/TaskReviewPage";
import Meetings from "../src/features/guidance/pages/MeetingLogPage";
import "../src/index.css";
import "../src/design-system.css";

if (import.meta.env.MODE !== "test") throw new Error("UI fixtures are available only in test mode.");
const screens: Record<string, React.ComponentType> = {
  eligibility: Eligibility, reviewers: Reviewers, committees: Committees, schedule: Schedule,
  minutes: Minutes, deferments: Deferments, rubric: Rubric, scores: Scores, results: Results,
  "guidance-plan": GuidancePlan, "task-board": TaskBoard, "task-review": TaskReview, meetings: Meetings,
};
const Screen = screens[new URLSearchParams(location.search).get("screen") || "schedule"];
ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <BrowserRouter><WorkspaceLayout><Screen /></WorkspaceLayout></BrowserRouter>
  </QueryClientProvider>,
);
