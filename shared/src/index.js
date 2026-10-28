"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrationPrefSchema = exports.LoginSchema = exports.TERM_STATUS = exports.ROLES = void 0;
const zod_1 = require("zod");
__exportStar(require("./contracts/review-groups"), exports);
__exportStar(require("./contracts/proposal-reviews"), exports);
__exportStar(require("./contracts/proposal-versions"), exports);
const step2_1 = require("./step2");
__exportStar(require("./step1"), exports);
__exportStar(require("./step2"), exports);
exports.ROLES = {
    ADMIN: "ADMIN",
    FACULTY: "FACULTY",
    LECTURER: "LECTURER",
    STUDENT: "STUDENT",
    COMMITTEE: "COMMITTEE",
};
exports.TERM_STATUS = {
    DRAFT: "DRAFT",
    OPEN_REGISTRATION: "OPEN_REGISTRATION",
    CLOSED_REGISTRATION: "CLOSED_REGISTRATION",
    IN_PROGRESS: "IN_PROGRESS",
    DEFENDING: "DEFENDING",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
};
exports.LoginSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, "Tên đăng nhập tối thiểu 3 ký tự"),
    password: zod_1.z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});
exports.RegistrationPrefSchema = step2_1.RegistrationWriteSchema;
__exportStar(require("./contracts/proposal-dossiers"), exports);
__exportStar(require("./contracts/guidance-tasks"), exports);
__exportStar(require("./contracts/task-submissions"), exports);
__exportStar(require("./contracts/guidance-reviews"), exports);
//# sourceMappingURL=index.js.map