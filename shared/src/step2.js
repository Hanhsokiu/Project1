"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrationWriteSchema = exports.RegistrationStatusSchema = void 0;
const zod_1 = require("zod");
exports.RegistrationStatusSchema = zod_1.z.enum(["DRAFT", "SUBMITTED"]);
exports.RegistrationWriteSchema = zod_1.z
    .object({
    directionId: zod_1.z.string().uuid().nullable().optional().default(null),
    preferences: zod_1.z
        .array(zod_1.z
        .object({
        lecturerId: zod_1.z.string().uuid(),
        preferenceOrder: zod_1.z.number().int().min(1).max(3),
    })
        .strict())
        .max(3)
        .default([]),
    note: zod_1.z.string().trim().max(3000).default(""),
    email: zod_1.z.string().trim().email().max(254).optional(),
    phone: zod_1.z
        .string()
        .trim()
        .regex(/^(0|\+84)[0-9]{9,10}$/)
        .optional(),
})
    .strict();
//# sourceMappingURL=step2.js.map