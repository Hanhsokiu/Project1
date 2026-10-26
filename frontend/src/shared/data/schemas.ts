import { z } from "zod";
export const passwordSchema = z
  .string()
  .min(8, "Mật khẩu ít nhất 8 ký tự")
  .regex(/[A-Z]/, "Cần có chữ hoa")
  .regex(/[a-z]/, "Cần có chữ thường")
  .regex(/[0-9]/, "Cần có chữ số")
  .regex(/[^a-zA-Z0-9]/, "Cần có ký tự đặc biệt");
export const contactSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  phone: z
    .string()
    .regex(/^(0|\+84)[0-9]{9,10}$/, "Số điện thoại không hợp lệ"),
});
export const studentSchema = contactSchema.extend({
  code: z.string().min(3),
  name: z.string().trim().min(3, "Họ tên ít nhất 3 ký tự"),
  className: z.string().min(1),
  program: z.string().min(1),
  departmentId: z.string().min(1),
  gpa: z.preprocess(value => value === null || typeof value === 'string' && !value.trim() ? undefined : value, z.coerce.number().min(0).max(4)),
  eligible: z.boolean(),
});
export const lecturerSchema = contactSchema.extend({
  code: z.string().min(2),
  name: z.string().trim().min(3),
  departmentId: z.string().min(1),
  directionIds: z.array(z.string()).min(1, "Chọn ít nhất một hướng chuyên môn"),
  quota: z.coerce.number().int().min(0).max(100),
});
export const proposalSchema = z.object({
  title: z.string().trim().min(10, "Tên đề tài ít nhất 10 ký tự"),
  objectives: z.string().trim().min(15, "Mục tiêu ít nhất 15 ký tự"),
  scope: z.string().trim().min(15, "Phạm vi ít nhất 15 ký tự"),
  technology: z.string().trim().min(3),
  expected: z.string().trim().min(10),
  plan: z
    .array(z.object({ week: z.string().min(1), content: z.string().min(3) }))
    .min(1, "Cần ít nhất một mốc kế hoạch"),
});
