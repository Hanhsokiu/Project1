import type {
  RegistrationResponse,
  RegistrationWrite,
} from "@doan/shared/step2";
import { RegistrationWriteSchema } from "@doan/shared/step2";
import { apiData } from "../../../shared/api/api-data";
import type { Registration } from "../../../shared/data/types";

export const REGISTRATION_API =
  import.meta.env.VITE_REGISTRATION_API === "true";
export interface RegistrationContext {
  registration: RegistrationResponse | null;
  window: {
    canWrite: boolean;
    reason: string | null;
    serverNow: string;
    endAt: string | null;
  };
  directions: { id: string; name: string }[];
  lecturerIds: string[];
}
export const registrationFromApi = (
  row: RegistrationResponse,
): Registration => ({
  ...row,
  directionId: row.directionId || "",
  preferences: row.preferences.map((p) => p.lecturerId),
});
export const registrationApi = {
  current(termId: string) {
    return apiData<RegistrationContext>(
      "GET",
      `/registrations/term/${termId}/me`,
    );
  },
  list(termId?: string) {
    return apiData<{
      items: RegistrationResponse[];
      stats: { total: number; draft: number; submitted: number };
    }>("GET", termId ? `/registrations/term/${termId}` : "/registrations");
  },
  save(termId: string, input: RegistrationWrite, submit: boolean) {
    const parsed = RegistrationWriteSchema.safeParse(input);
    if (!parsed.success)
      throw new Error(
        "Vui lòng kiểm tra Email, số điện thoại, hướng và thứ tự nguyện vọng.",
      );
    return apiData<RegistrationResponse>(
      submit ? "POST" : "PUT",
      `/registrations/term/${termId}/me/${submit ? "submit" : "draft"}`,
      parsed.data,
    );
  },
};
