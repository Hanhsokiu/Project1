import { z } from 'zod';
export * from './contracts/review-groups';
export * from './contracts/proposal-reviews';
export * from './contracts/proposal-versions';
export type { Id, Instant, Revision, CurrentUserResponse, OfficialAdvisorContext, TopicAgreement, SubmittedProposalContext, GuidancePeriodContext } from './contracts/academic-context';
export * from "./step1";
export * from "./step2";
export declare const ROLES: {
    readonly ADMIN: "ADMIN";
    readonly FACULTY: "FACULTY";
    readonly LECTURER: "LECTURER";
    readonly STUDENT: "STUDENT";
    readonly COMMITTEE: "COMMITTEE";
};
export type RoleType = (typeof ROLES)[keyof typeof ROLES];
export declare const TERM_STATUS: {
    readonly DRAFT: "DRAFT";
    readonly OPEN_REGISTRATION: "OPEN_REGISTRATION";
    readonly CLOSED_REGISTRATION: "CLOSED_REGISTRATION";
    readonly IN_PROGRESS: "IN_PROGRESS";
    readonly DEFENDING: "DEFENDING";
    readonly COMPLETED: "COMPLETED";
    readonly CANCELLED: "CANCELLED";
};
export type TermStatusType = (typeof TERM_STATUS)[keyof typeof TERM_STATUS];
export declare const LoginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
}, {
    username: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
export declare const RegistrationPrefSchema: z.ZodObject<{
    directionId: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    preferences: z.ZodDefault<z.ZodArray<z.ZodObject<{
        lecturerId: z.ZodString;
        preferenceOrder: z.ZodNumber;
    }, "strict", z.ZodTypeAny, {
        lecturerId: string;
        preferenceOrder: number;
    }, {
        lecturerId: string;
        preferenceOrder: number;
    }>, "many">>;
    note: z.ZodDefault<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    directionId: string | null;
    note: string;
    preferences: {
        lecturerId: string;
        preferenceOrder: number;
    }[];
    email?: string | undefined;
    phone?: string | undefined;
}, {
    email?: string | undefined;
    phone?: string | undefined;
    directionId?: string | null | undefined;
    note?: string | undefined;
    preferences?: {
        lecturerId: string;
        preferenceOrder: number;
    }[] | undefined;
}>;
export type RegistrationPrefInput = z.infer<typeof RegistrationPrefSchema>;
export * from './contracts/proposal-dossiers';
export * from './contracts/guidance-tasks';
export * from './contracts/task-submissions';
export * from './contracts/guidance-reviews';
