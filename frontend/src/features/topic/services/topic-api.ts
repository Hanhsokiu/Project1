import { apiData } from "../../../shared/api/api-data";
import type { Topic } from "../../../shared/data/types";
export const topicApi = {
  prepareWorkflow(id: string) {
    return apiData<{ proposalId: string }>("POST", `/topics/${id}/prepare-workflow`);
  },
  list(termId: string) {
    return apiData<Topic[]>("GET", `/topics/term/${termId}`);
  },
  save(
    termId: string,
    studentId: string,
    content: Pick<
      Topic,
      "title" | "objectives" | "scope" | "technology" | "expected" | "plan"
    >,
    expectedVersion: number,
    submit: boolean,
  ) {
    return apiData<Topic>(
      submit ? "POST" : "PUT",
      `/topics/term/${termId}/student/${studentId}/${submit ? "submit" : "draft"}`,
      { content, expectedVersion },
    );
  },
  agree(id: string, agreed: boolean, expectedVersion: number) {
    return apiData<Topic>("POST", `/topics/${id}/agree`, {
      agreed,
      expectedVersion,
    });
  },
};
