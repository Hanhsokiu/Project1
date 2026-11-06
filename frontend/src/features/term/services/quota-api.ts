import type {
  QuotaApproveInput,
  QuotaPolicy,
  QuotaPreviewInput,
} from "@doan/shared";
import { apiData } from "../../../shared/api/api-data";
export const quotaApi = {
  preview: (id: string, input: QuotaPreviewInput) =>
    apiData<QuotaPolicy>("POST", `/terms/${id}/quotas/preview`, input),
  approve: (id: string, input: QuotaApproveInput) =>
    apiData<QuotaPolicy>("POST", `/terms/${id}/quotas/approve`, input),
};
