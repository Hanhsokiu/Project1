import type { Account, DemoDb } from "./types";

// Presentation metadata only: never seed or hydrate business data for API pages.
export function sessionWorkspace(user: Account): DemoDb {
  return {
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
    terms: [],
    notifications: [],
  };
}
