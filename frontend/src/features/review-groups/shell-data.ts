import { useQuery } from "@tanstack/react-query";
import { useApiSession } from "../../shared/hooks/use-api-session";
import { httpClient } from "../../shared/api/http-client";
import type { DemoDb } from "../../shared/data/types";
import { useWorkflowTerms } from "../../shared/hooks/use-workflow-terms";

// Shell metadata only. Workflow pages continue using their scoped canonical APIs;
// displaying the shared sidebar must not require catalog/import permissions.
export function useWorkflowShellData(groups: boolean) {
  const user = useApiSession();
  const terms = useWorkflowTerms(groups, !!user);
  const notifications = useQuery({
    queryKey: ["workflow-shell-notifications", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await httpClient.get<{
          data: Array<{
            id: string;
            userId: string;
            termId: string | null;
            title: string;
            body: string;
            status: "READ" | "UNREAD";
            link: string | null;
          }>;
        }>("/notifications/me")
      ).data.data,
    refetchInterval: 30000,
  });
  if (!user) return undefined;
  const data: DemoDb = {
    version: 0,
    accounts: [user],
    catalogs: [],
    students: [],
    lecturers: [],
    registrations: [],
    assignments: [],
    topics: [],
    reviewGroups: [],
    plans: [],
    tasks: [],
    meetings: [],
    finals: [],
    deferments: [],
    committees: [],
    defenses: [],
    scores: [],
    exports: [],
    audits: [],
    rubrics: { advisor: [], reviewer: [], committee: [] },
    terms: (terms.data ?? []).map((term) => ({
      ...term,
      code: "",
      semester: "",
      program: "",
      start: "",
      end: "",
      registrationStart: "",
      registrationEnd: "",
      locked: true,
      studentIds: user.studentId ? [user.studentId] : [],
      lecturers: [],
      phases: [],
      parameters: { passing_gpa_threshold: 2, max_preferences: 3 },
      assignmentPublished: false,
      resultsPublished: false,
    })),
    notifications: (notifications.data ?? []).map((notice) => ({
      ...notice,
      termId: notice.termId ?? "",
      content: notice.body,
      read: notice.status === "READ",
      channel: "IN_APP",
    })),
  };
  return data;
}
