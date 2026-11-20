import { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getAccessToken } from "../../../shared/api/api-session";
import { loadStudentDirectoryPage, studentDirectoryState, STUDENT_BATCH_SIZE } from "../services/student-directory-api";

export function useStudentDirectory(paused: boolean) {
  const token = getAccessToken();
  const query = useInfiniteQuery({
    queryKey: ["student-directory", token],
    enabled: !!token,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => loadStudentDirectoryPage(pageParam, signal),
    getNextPageParam: (last) => last.page * STUDENT_BATCH_SIZE < last.total ? last.page + 1 : undefined,
    staleTime: 60000,
    retry: false,
  });
  const state = useMemo(() => studentDirectoryState(query.data?.pages ?? []), [query.data?.pages]);
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  useEffect(() => {
    // The first batch is already visible. Remaining batches provide complete
    // statistics/class choices without blocking the first table paint.
    if (!paused && hasNextPage && !isFetching && !isError && !state.error)
      void fetchNextPage();
  }, [paused, hasNextPage, isFetching, isError, fetchNextPage, state.error?.message]);
  return {
    ...state,
    loading: query.isPending || query.isFetching || (!paused && !!hasNextPage && !query.isError && !state.error),
    error: query.error ?? state.error,
    retry: () => query.isFetchNextPageError ? query.fetchNextPage() : query.refetch(),
  };
}
