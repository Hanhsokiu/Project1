import { z } from "zod";

export class ContactValidator {
  static complete(email: unknown, phone: unknown): boolean {
    return (
      z.string().email().safeParse(email).success &&
      z
        .string()
        .regex(/^(0|\+84)[0-9]{9,10}$/)
        .safeParse(phone).success
    );
  }
}
