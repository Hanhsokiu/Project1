import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StudentDirectoryQuery } from "@doan/shared";
import { getAccessToken } from "../../../shared/api/api-session";
import { loadStudentDirectoryOptions, loadStudentDirectoryPage } from "../services/student-directory-api";
import type { TableRemote } from "../../../shared/components/data-table";

type Filters = Pick<StudentDirectoryQuery, "trainingSystemId" | "className" | "academicCondition" | "termId">;
export function useStudentDirectory(filters: Filters, enabled: boolean) {
  const token = getAccessToken();
  const filterKey = JSON.stringify(filters);
  const [view, setView] = useState({ filterKey, page: 1, search: "", sort: null as TableRemote["sort"] });
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(view.search.trim()), 200);
    return () => clearTimeout(timer);
  }, [view.search]);
  const searching = search !== view.search.trim();
  const page = view.filterKey === filterKey ? view.page : 1;
  const sort = view.sort;
  const params: StudentDirectoryQuery = {
    ...filters, search, page, pageSize: 8,
    sortBy: sort?.key === "name" ? "name" : sort?.key === "gpa" ? "gpa" : "code",
    sortDirection: sort?.desc ? "desc" : "asc",
  };
  const list = useQuery({
    queryKey: ["student-directory", token, filterKey, search, sort, page],
    enabled: enabled && !!token && !searching,
    queryFn: ({ signal }) => loadStudentDirectoryPage(params, signal),
    placeholderData: (previous, query) => query?.queryKey[1] === token &&
      query.queryKey[2] === filterKey && query.queryKey[3] === search &&
      JSON.stringify(query.queryKey[4]) === JSON.stringify(sort) ? previous : undefined,
    staleTime: 60000,
    retry: false,
  });
  const options = useQuery({
    queryKey: ["student-directory-options", token],
    enabled: enabled && !!token,
    queryFn: ({ signal }) => loadStudentDirectoryOptions(signal),
    staleTime: 60000,
    retry: false,
  });
  const collectionKey = JSON.stringify([token, filterKey, search, sort]);
  const knownTotal = useRef<{ key: string; total: number }>();
  if (list.data && !list.isPlaceholderData)
    knownTotal.current = { key: collectionKey, total: list.data.total };
  const setPage = (next: number) => setView(previous => ({ ...previous, filterKey, page: next }));
  useEffect(() => {
    if (!list.isPlaceholderData && list.data && page > Math.max(1, list.data.totalPages))
      setView(previous => ({ ...previous, filterKey, page: Math.max(1, list.data!.totalPages) }));
  }, [list.data, list.isPlaceholderData, page, filterKey]);
  const remote: TableRemote = {
    page, total: searching ? null : list.data?.total ?? (knownTotal.current?.key === collectionKey ? knownTotal.current.total : null),
    loading: searching || list.isPending || list.isFetching,
    error: !!list.error,
    search: view.search, sort,
    onPageChange: setPage,
    onSearchChange: value => setView(previous => ({ ...previous, filterKey, page: 1, search: value })),
    onSortChange: value => setView(previous => ({ ...previous, filterKey, page: 1, sort: value })),
  };
  return {
    sessionKey: token,
    students: searching || list.isPlaceholderData ? [] : list.data?.items ?? [],
    summary: options.data,
    optionsLoading: options.isPending || options.isFetching,
    optionsError: options.error,
    error: list.error ?? options.error,
    remote,
    reset: () => setView({ filterKey, page: 1, search: "", sort: null }),
    retry: () => Promise.all([list.refetch(), options.refetch()]),
  };
}
