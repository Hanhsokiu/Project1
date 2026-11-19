import type { ReportPolicy, ReportStatistics } from "@doan/shared";
import {
  addScoreFraction as add,
  formatScoreFraction as format,
  scoreFraction as fraction,
} from "@doan/shared";
import type { ReportSnapshot } from "./report.reader";
const compare = (a: string, b: string) => {
  const x = fraction(a),
    y = fraction(b);
  return x.n * y.d - y.n * x.d;
};
export function reportStatistics(
  s: ReportSnapshot,
  gradeRead: boolean,
  scoreRead: boolean,
  policy: ReportPolicy | null,
): ReportStatistics {
  const facts = s.facts,
    valid = facts.filter((f) => f.result),
    scores =
      scoreRead && policy
        ? valid
            .filter(
              (f) =>
                policy.statisticsRelease === "FINALIZED_INTERNAL" ||
                f.result!.publicationStatus === "PUBLISHED",
            )
            .map((f) => f.result!.calculation)
        : [],
    sum = scores.reduce(
      (v, s) => add(v, fraction(s.finalScore)),
      fraction("0"),
    ),
    group = (key: (f: (typeof facts)[number]) => string) =>
      [...new Set(facts.map(key))].sort().map((k) => ({
        key: k || "Chưa xác minh",
        students: facts.filter((f) => key(f) === k).length,
        finalized: gradeRead
          ? facts.filter((f) => key(f) === k && f.result).length
          : null,
      })),
    load = (reviewer: boolean) => {
      const map = new Map<
        string,
        { lecturerId: string; name: string; students: Set<string> }
      >();
      for (const f of facts)
        for (const l of reviewer ? f.reviewers : f.advisor ? [f.advisor] : []) {
          if (!map.has(l.id))
            map.set(l.id, {
              lecturerId: l.id,
              name: l.name,
              students: new Set(),
            });
          map.get(l.id)!.students.add(f.memberId);
        }
      return [...map.values()].map((v) => ({
        lecturerId: v.lecturerId,
        name: v.name,
        students: v.students.size,
      }));
    };
  const lecturerIds = new Set(
    facts.flatMap((f) => [
      ...(f.advisor ? [f.advisor.id] : []),
      ...f.reviewers.map((r) => r.id),
      ...(f.committee?.members.map((m) => m.lecturerId) ?? []),
    ]),
  );
  const completePass =
      scores.length > 0 && scores.every((s) => s.isPassed !== null),
    distribution =
      scoreRead && policy?.distribution.length
        ? policy.distribution.map((b) => ({
            label: b.label,
            count: scores.filter(
              (s) =>
                compare(s.finalScore, b.from) >= 0 &&
                (b.includeUpper
                  ? compare(s.finalScore, b.to) <= 0
                  : compare(s.finalScore, b.to) < 0),
            ).length,
          }))
        : null;
  return {
    termId: s.termId,
    students: facts.length,
    proposals: facts.filter((f) => !!f.row.cells.TITLE).length,
    lecturers: lecturerIds.size,
    committees: s.capabilities.committees ? s.committees.length : null,
    scheduledStudents: s.capabilities.schedules
      ? facts.filter((f) => !!f.sessionId).length
      : null,
    sessions: s.capabilities.schedules
      ? new Set(facts.flatMap((f) => (f.sessionId ? [f.sessionId] : []))).size
      : null,
    eligibleStudents: facts.filter((f) => f.eligible === true).length,
    unknownEligibility: facts.filter((f) => f.eligible === null).length,
    reviewerAssignments: s.capabilities.reviewers
      ? facts.reduce((n, f) => n + f.reviewers.length, 0)
      : null,
    reviewerSheets:
      gradeRead && facts.every((f) => f.reviewerSheets !== null)
        ? facts.reduce((n, f) => n + f.reviewerSheets!, 0)
        : null,
    committeeSheets:
      gradeRead && facts.every((f) => f.committeeSheets !== null)
        ? facts.reduce((n, f) => n + f.committeeSheets!, 0)
        : null,
    finalizedResults: gradeRead && s.capabilities.results ? valid.length : null,
    publishedResults:
      gradeRead && s.capabilities.results
        ? valid.filter((f) => f.result!.publicationStatus === "PUBLISHED")
            .length
        : null,
    average: scores.length
      ? format(
          { n: sum.n, d: sum.d * BigInt(scores.length) },
          { mode: "HALF_UP", decimalPlaces: 2 },
        )
      : null,
    passRate: completePass
      ? format(
          {
            n: BigInt(scores.filter((s) => s.isPassed).length) * 100n,
            d: BigInt(scores.length),
          },
          { mode: "HALF_UP", decimalPlaces: 2 },
        )
      : null,
    distribution,
    byClass: group((f) => f.className),
    byCommittee: group((f) => f.committee?.code ?? ""),
    byDepartment: group((f) => f.department),
    researchAreas: group((f) => f.researchArea).map(({ key, students }) => ({
      key,
      students,
    })),
    advisorLoads: load(false),
    reviewerLoads: load(true),
    progress: {
      activeTasks: facts.reduce((n, f) => n + (f.progress?.active ?? 0), 0),
      completedTasks: facts.reduce(
        (n, f) => n + (f.progress?.completed ?? 0),
        0,
      ),
      unknownStudents: facts.filter((f) => !f.progress).length,
    },
    snapshotHash: s.hash,
    blockers: [
      ...s.blockers,
      ...(!s.capabilities.results ? ["UC24_SCHEMA_REQUIRED"] : []),
      ...(!s.capabilities.committees ? ["UC19_SCHEMA_REQUIRED"] : []),
      ...(!s.capabilities.schedules ? ["UC21_SCHEMA_REQUIRED"] : []),
      ...(!gradeRead ? ["GRADE_STATISTICS_PERMISSION_REQUIRED"] : []),
      ...(!scoreRead ? ["SCORE_STATISTICS_PERMISSION_REQUIRED"] : []),
      ...(!policy ? ["UC25_POLICY_REQUIRED"] : []),
      ...(completePass ? [] : ["PASS_RULE_OR_RELEASE_NOT_VERIFIED"]),
    ],
  };
}
