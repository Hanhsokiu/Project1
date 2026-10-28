"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportConfirmSchema = exports.TermRosterInputSchema = exports.TermPhaseInputSchema = exports.TermInputSchema = exports.SemesterInputSchema = exports.PhaseCodeSchema = void 0;
const zod_1 = require("zod");
exports.PhaseCodeSchema = zod_1.z.enum([
    "REGISTRATION",
    "ASSIGNMENT",
    "PROPOSAL",
    "WEEKLY",
    "FINAL",
    "DEFENSE",
]);
exports.SemesterInputSchema = zod_1.z
    .object({
    academicYear: zod_1.z.string().regex(/^\d{4}-\d{4}$/),
    semester: zod_1.z.number().int().min(1).max(3),
    name: zod_1.z.string().min(3).optional(),
    startDate: zod_1.z.string().datetime({ offset: true }),
    endDate: zod_1.z.string().datetime({ offset: true }),
})
    .strict();
exports.TermInputSchema = zod_1.z
    .object({
    code: zod_1.z
        .string()
        .min(3)
        .max(80)
        .regex(/^[A-Za-z0-9._-]+$/),
    name: zod_1.z.string().min(5).max(250),
    semesterId: zod_1.z.string().min(1),
    trainingSystemId: zod_1.z.string().min(1),
    startDate: zod_1.z.string().datetime({ offset: true }),
    endDate: zod_1.z.string().datetime({ offset: true }),
    registrationStart: zod_1.z.string().datetime({ offset: true }).optional(),
    registrationEnd: zod_1.z.string().datetime({ offset: true }).optional(),
})
    .strict();
exports.TermPhaseInputSchema = zod_1.z
    .object({
    id: zod_1.z.string().optional(),
    code: exports.PhaseCodeSchema,
    name: zod_1.z.string().min(3),
    start: zod_1.z.string().datetime({ offset: true }),
    end: zod_1.z.string().datetime({ offset: true }),
    locked: zod_1.z.boolean(),
})
    .strict();
exports.TermRosterInputSchema = zod_1.z
    .object({
    studentIds: zod_1.z.array(zod_1.z.string()),
    lecturers: zod_1.z.array(zod_1.z
        .object({
        lecturerId: zod_1.z.string(),
        quota: zod_1.z.number().int().min(0).max(500),
    })
        .strict()),
})
    .strict();
exports.ImportConfirmSchema = zod_1.z
    .object({ mode: zod_1.z.enum(["STRICT", "VALID_ONLY"]) })
    .strict();
//# sourceMappingURL=step1.js.map