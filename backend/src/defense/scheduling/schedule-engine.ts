import type {
  SchedulePolicy,
  ScheduleRoom,
  ScheduleSlot,
  ScheduleSource,
} from "@doan/shared";
const zone = "Asia/Ho_Chi_Minh";
const localFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: zone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
export function localParts(instant: string | number | Date) {
  const parts = Object.fromEntries(
    localFormatter
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    seconds: parts.second,
  };
}
export function localInstant(date: string, time: string) {
  const desired = Date.parse(`${date}T${time}:00Z`);
  let instant = desired;
  for (let i = 0; i < 3; i++) {
    const p = localParts(instant);
    instant += desired - Date.parse(`${p.date}T${p.time}:${p.seconds}Z`);
  }
  const p = localParts(instant);
  if (p.date !== date || p.time !== time) throw Error("INVALID_LOCAL_TIME");
  return instant;
}
const collator = new Intl.Collator("vi", {
  usage: "sort",
  sensitivity: "accent",
  numeric: true,
});
export const normalizeName = (s: string) =>
  s.normalize("NFC").trim().replace(/\s+/gu, " ");
export function splitVietnameseName(
  raw: string,
  compoundFamilies: string[] = [],
) {
  const full = normalizeName(raw),
    tokens = full.split(" ").filter(Boolean);
  if (tokens.length <= 1)
    return { given: tokens[0] ?? "", middle: "", family: "" };
  const prefix = compoundFamilies
    .map(normalizeName)
    .filter(
      (p) =>
        tokens.length > p.split(" ").length &&
        full
          .toLocaleLowerCase("vi")
          .startsWith(p.toLocaleLowerCase("vi") + " "),
    )
    .sort(
      (a, b) =>
        b.split(" ").length - a.split(" ").length || collator.compare(a, b),
    )[0];
  const familyLength = prefix ? prefix.split(" ").length : 1;
  return {
    given: tokens[tokens.length - 1],
    middle: tokens.slice(familyLength, -1).join(" "),
    family: tokens.slice(0, familyLength).join(" "),
  };
}
export function sortDefenseStudents<
  T extends { studentName: string; studentCode: string; termStudentId: string },
>(students: T[], p: Pick<SchedulePolicy, "compoundFamilyNames">) {
  return [...students].sort((a, b) => {
    const x = splitVietnameseName(a.studentName, p.compoundFamilyNames),
      y = splitVietnameseName(b.studentName, p.compoundFamilyNames);
    return (
      collator.compare(x.given, y.given) ||
      collator.compare(x.middle, y.middle) ||
      collator.compare(x.family, y.family) ||
      collator.compare(
        normalizeName(a.studentCode),
        normalizeName(b.studentCode),
      ) ||
      a.termStudentId.localeCompare(b.termStudentId, "en")
    );
  });
}
export const overlaps = (a: number, b: number, c: number, d: number) =>
  a < d && c < b;
export type ResourceInterval = {
  lecturerId: string;
  start: number;
  end: number;
};
export type Booking = {
  id: string;
  committeeId: string;
  roomId: string;
  start: number;
  end: number;
  lecturers: ResourceInterval[];
  students: {
    proposalId: string;
    studentId: string;
    start: number;
    end: number;
  }[];
};
export function bookingConflicts(a: Booking, all: Booking[]) {
  const reasons: string[] = [];
  for (const b of all) {
    if (a.id === b.id) continue;
    if (overlaps(a.start, a.end, b.start, b.end)) {
      if (a.roomId === b.roomId) reasons.push("ROOM_CONFLICT");
      if (a.committeeId === b.committeeId) reasons.push("COMMITTEE_CONFLICT");
    }
    if (
      a.lecturers.some((l) =>
        b.lecturers.some(
          (m) =>
            l.lecturerId === m.lecturerId &&
            overlaps(l.start, l.end, m.start, m.end),
        ),
      )
    )
      reasons.push("LECTURER_CONFLICT");
    if (
      a.students.some((s) =>
        b.students.some((t) => s.proposalId === t.proposalId),
      )
    )
      reasons.push("PROPOSAL_ALREADY_SCHEDULED");
    if (
      a.students.some((s) =>
        b.students.some(
          (t) =>
            s.studentId &&
            s.studentId === t.studentId &&
            overlaps(s.start, s.end, t.start, t.end),
        ),
      )
    )
      reasons.push("STUDENT_CONFLICT");
  }
  return [...new Set(reasons)];
}
export function buildSession(input: {
  source: ScheduleSource;
  room: ScheduleRoom;
  date: string;
  period: "MORNING" | "AFTERNOON";
  startTime: string;
  studentIds: string[];
  manualOrder?: string[];
  policy: SchedulePolicy;
  bounds: { start: number; end: number };
}) {
  const { source, room, date, period, policy: p } = input,
    w = p.periods[period];
  if (!p.allowedDates.includes(date)) throw Error("DATE_NOT_APPROVED");
  if (
    !room.departmentIds.includes(source.departmentId) ||
    room.capacity < p.minRoomCapacity
  )
    throw Error("ROOM_NOT_ALLOWED");
  if (
    !input.studentIds.length ||
    input.studentIds.length > p.maxStudentsPerSession
  )
    throw Error("SESSION_CAPACITY_EXCEEDED");
  const students = input.studentIds.map((id) =>
    source.students.find((s) => s.termStudentId === id),
  );
  if (students.some((s) => !s)) throw Error("STUDENT_COMMITTEE_MISMATCH");
  if (
    p.reviewerAttendance === "REQUIRED" &&
    input.studentIds.some(
      (id) => !source.reviewers.some((r) => r.termStudentId === id),
    )
  )
    throw Error("UC20_CURRENT_REVIEWERS_REQUIRED");
  const automatic = sortDefenseStudents(
    students as ScheduleSource["students"],
    p,
  );
  let ordered = automatic;
  if (input.manualOrder) {
    if (!p.manualOrderAllowed) throw Error("MANUAL_ORDER_NOT_APPROVED");
    if (
      new Set(input.manualOrder).size !== automatic.length ||
      input.manualOrder.some((id) => !input.studentIds.includes(id))
    )
      throw Error("INVALID_MANUAL_ORDER");
    ordered = input.manualOrder.map((id) =>
      automatic.find((s) => s.termStudentId === id)!,
    );
  }
  let cursor = localInstant(date, input.startTime);
  const start = cursor,
    windowStart = localInstant(date, w.start),
    windowEnd = localInstant(date, w.end);
  if (cursor < windowStart || cursor >= windowEnd)
    throw Error("OUTSIDE_SESSION_WINDOW");
  const breaks = w.breaks
    .map((b) => ({
      start: localInstant(date, b.start),
      end: localInstant(date, b.end),
    }))
    .sort((a, b) => a.start - b.start);
  const slots: ScheduleSlot[] = [];
  for (const [i, s] of ordered.entries()) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const b of breaks)
        if (
          overlaps(
            cursor,
            cursor + (p.durationMin + p.bufferMin) * 60000,
            b.start,
            b.end,
          )
        ) {
          cursor = b.end;
          moved = true;
        }
    }
    const end = cursor + p.durationMin * 60000;
    if (end + p.bufferMin * 60000 > windowEnd) throw Error("SESSION_OVERFLOW");
    slots.push({
      termStudentId: s.termStudentId,
      proposalId: s.proposalId,
      studentId: s.studentId,
      studentCode: s.studentCode,
      studentName: s.studentName,
      advisorId: s.advisorId,
      order: i + 1,
      startAt: new Date(cursor).toISOString(),
      endAt: new Date(end).toISOString(),
      reviewerIds:
        p.reviewerAttendance === "REQUIRED"
          ? source.reviewers
              .filter((r) => r.termStudentId === s.termStudentId)
              .map((r) => r.lecturerId)
              .sort()
          : [],
    });
    cursor = end + p.bufferMin * 60000;
  }
  if (start < input.bounds.start || cursor > input.bounds.end)
    throw Error("OUTSIDE_DEFENSE_PHASE");
  const end = cursor,
    occupiedEnd = end + p.sessionBufferMin * 60000;
  if (occupiedEnd > windowEnd) throw Error("SESSION_OVERFLOW");
  if (occupiedEnd > input.bounds.end) throw Error("OUTSIDE_DEFENSE_PHASE");
  const booking: Booking = {
    id: "new",
    committeeId: source.committeeId,
    roomId: room.id,
    start,
    end: occupiedEnd,
    lecturers: [
      ...source.members.map((lecturerId) => ({
        lecturerId,
        start,
        end: occupiedEnd,
      })),
      ...slots.flatMap((s) =>
        s.reviewerIds.map((lecturerId) => ({
          lecturerId,
          start: Date.parse(s.startAt),
          end: Date.parse(s.endAt) + (p.bufferMin + p.sessionBufferMin) * 60000,
        })),
      ),
    ],
    students: slots.map((s) => ({
      proposalId: s.proposalId,
      studentId: s.studentId,
      start: Date.parse(s.startAt),
      end: Date.parse(s.endAt) + p.bufferMin * 60000,
    })),
  };
  return {
    slots,
    automaticOrder: automatic.map((s) => s.termStudentId),
    start,
    end,
    booking,
  };
}
export function proposeSchedule(input: {
  sources: ScheduleSource[];
  rooms: ScheduleRoom[];
  existing: Booking[];
  policy: SchedulePolicy;
  bounds: { start: number; end: number };
  nodeLimit?: number;
}) {
  const { policy: p } = input,
    existing = [...input.existing],
    plans: {
      source: ScheduleSource;
      room: ScheduleRoom;
      date: string;
      period: "MORNING" | "AFTERNOON";
      startTime: string;
      students: string[];
      result: ReturnType<typeof buildSession>;
    }[] = [];
  let exploredNodes = 0,
    limited = false;
  const groups = [...input.sources]
    .map((s) => ({
      ...s,
      students: sortDefenseStudents(s.students, p),
      members: [...s.members].sort(),
      reviewers: [...s.reviewers].sort(
        (a, b) =>
          a.termStudentId.localeCompare(b.termStudentId) ||
          a.lecturerId.localeCompare(b.lecturerId),
      ),
    }))
    .sort((a, b) => a.committeeId.localeCompare(b.committeeId))
    .map((source) => ({
      source,
      students: source.students.filter(
        (s) =>
          !existing.some((b) =>
            b.students.some((t) => t.proposalId === s.proposalId),
          ),
      ),
    }));
  function search(groupIndex: number, offset: number): boolean {
    if (groupIndex === groups.length) return true;
    const { source, students } = groups[groupIndex];
    if (offset >= students.length) return search(groupIndex + 1, 0);
    if (plans.length >= 100) {
      limited = true;
      return false;
    }
    const rooms = input.rooms
      .filter(
        (r) =>
          r.departmentIds.includes(source.departmentId) &&
          r.capacity >= p.minRoomCapacity,
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const windows = p.allowedDates
      .flatMap((date) =>
        (["MORNING", "AFTERNOON"] as const).map((period) => ({ date, period })),
      )
      .sort((a, b) => {
        const count = (x: typeof a) =>
          plans.filter((s) => s.date === x.date && s.period === x.period)
            .length;
        return (
          count(a) - count(b) ||
          a.date.localeCompare(b.date) ||
          ["MORNING", "AFTERNOON"].indexOf(a.period) -
            ["MORNING", "AFTERNOON"].indexOf(b.period)
        );
      });
    for (const { date, period } of windows)
      for (const room of rooms)
        for (
          let start = localInstant(date, p.periods[period].start);
          start < localInstant(date, p.periods[period].end);
          start += p.startStepMin * 60000
        ) {
          for (
            let count = Math.min(
              p.maxStudentsPerSession,
              students.length - offset,
            );
            count >= 1;
            count--
          ) {
            if (exploredNodes >= (input.nodeLimit ?? 10000)) {
              limited = true;
              return false;
            }
            exploredNodes++;
            const ids = students
                .slice(offset, offset + count)
                .map((s) => s.termStudentId),
              startTime = localParts(start).time;
            let result: ReturnType<typeof buildSession>;
            try {
              result = buildSession({
                source,
                room,
                date,
                period,
                startTime,
                studentIds: ids,
                policy: p,
                bounds: input.bounds,
              });
            } catch {
              continue;
            }
            result.booking.id = `proposal-${plans.length}`;
            while (existing.some((b) => b.id === result.booking.id))
              result.booking.id += "x";
            if (bookingConflicts(result.booking, existing).length) continue;
            plans.push({
              source,
              room,
              date,
              period,
              startTime,
              students: ids,
              result,
            });
            existing.push(result.booking);
            if (search(groupIndex, offset + count)) return true;
            existing.pop();
            plans.pop();
            if (limited) return false;
          }
        }
    return false;
  }
  const feasible = search(0, 0);
  return {
    status: feasible
      ? ("FEASIBLE" as const)
      : limited
        ? ("SEARCH_LIMIT" as const)
        : ("UNSAT" as const),
    exploredNodes,
    plans: feasible ? plans : [],
  };
}
