import { httpClient } from "../../shared/api/http-client";
import type {
  SubmissionFileKind,
  SubmissionUploadView,
  TaskSubmissionContext,
  TaskSubmissionCreate,
  TaskSubmissionPage,
  TaskSubmissionView,
} from "@doan/shared";
type Envelope<T> = { success: true; data: T };
export const submissionApi = {
  context: async (taskId: string) =>
    (
      await httpClient.get<Envelope<TaskSubmissionContext>>(
        `/tasks/${encodeURIComponent(taskId)}/submission-context`,
      )
    ).data.data,
  list: async (taskId: string, page: number) =>
    (
      await httpClient.get<Envelope<TaskSubmissionPage>>(
        `/tasks/${encodeURIComponent(taskId)}/submissions`,
        { params: { page, limit: 10 } },
      )
    ).data.data,
  stage: async (
    taskId: string,
    kind: SubmissionFileKind,
    file: File,
    key: string,
    progress: (percent: number) => void,
  ) => {
    const body = new FormData();
    body.append("kind", kind);
    body.append("file", file);
    return (
      await httpClient.post<Envelope<SubmissionUploadView>>(
        `/tasks/${encodeURIComponent(taskId)}/submission-uploads`,
        body,
        {
          // Axios/browser sets the multipart boundary; override the JSON default.
          headers: { "Content-Type": undefined, "Idempotency-Key": key },
          onUploadProgress: (e) =>
            progress(
              e.total
                ? Math.min(99, Math.round((e.loaded * 100) / e.total))
                : 0,
            ),
        },
      )
    ).data.data;
  },
  submit: async (taskId: string, input: TaskSubmissionCreate, key: string) =>
    (
      await httpClient.post<Envelope<TaskSubmissionView>>(
        `/tasks/${encodeURIComponent(taskId)}/submissions`,
        input,
        { headers: { "Idempotency-Key": key } },
      )
    ).data.data,
  download: async (submissionId: string, fileId: string, name: string) => {
    const response = await httpClient.get(
      `/task-submissions/${encodeURIComponent(submissionId)}/files/${encodeURIComponent(fileId)}/download`,
      { responseType: "blob" },
    );
    const href = URL.createObjectURL(response.data),
      a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  },
};
