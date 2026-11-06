import type { DemoDb } from "./types";

// API snapshots start empty. Browser demo storage is never a server fallback.
export function emptyDb(): DemoDb {
  return {
    version: 0,
    accounts: [],
    catalogs: [],
    students: [],
    lecturers: [],
    terms: [],
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
    rubrics: { advisor: [], reviewer: [], committee: [] },
    exports: [],
    notifications: [],
    audits: [],
  };
}
