import { useQuery, type QueryClient } from "@tanstack/react-query";
import { httpClient } from "../api/http-client";
import { AUTH_API } from "../api/api-session";
import { getWorkspaceSelection } from "../data/store";
import type { TermStatus } from "../data/types";
import { useApiSession } from "./use-api-session";

export type WorkflowTerm = { id: string; name: string; status: TermStatus };

export function useWorkflowTerms(groups = false, enabled = true) {
  const user = useApiSession();
  return useQuery({
    queryKey: [
      groups ? "review-group-terms" : "proposal-review-terms",
      user?.id,
    ],
    enabled: enabled && (!AUTH_API || !!user),
    queryFn: async () =>
      (
        await httpClient.get<{ data: WorkflowTerm[] }>(
          groups
            ? "/review-group-options/terms"
            : "/proposal-review-options/terms",
        )
      ).data.data,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 30000,
  });
}

export function preferredWorkflowTerm(
  terms: WorkflowTerm[] | undefined,
  selectedId = getWorkspaceSelection().termId,
) {
  return terms?.find((term) => term.id === selectedId) ?? terms?.[0];
}

export async function invalidateWorkflowTerms(client: QueryClient) {
  await Promise.all(
    [
      "review-group-terms",
      "proposal-review-terms",
      "review-group-options",
      "proposal-review-options",
      "progress-options",
    ].map((key) => client.invalidateQueries({ queryKey: [key] })),
  );
}
