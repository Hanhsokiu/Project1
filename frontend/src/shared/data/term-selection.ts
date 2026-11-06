export type TermIdentity = {
  id: string;
  name: string;
  code?: string;
  program?: string;
  trainingSystem?: { name: string } | null;
};

export function termLabel(term: TermIdentity) {
  return [
    ...new Set(
      [term.code, term.name, term.program || term.trainingSystem?.name].filter(
        Boolean,
      ),
    ),
  ].join(" · ");
}

export function selectedTerm<T extends { id: string }>(
  terms: T[],
  requested: string | null | undefined,
  saved?: string,
) {
  // An explicit unavailable term must stay unavailable; never show another term's data.
  return requested
    ? terms.find((t) => t.id === requested)
    : (terms.find((t) => t.id === saved) ?? terms[0]);
}

export function termDestination(
  pathname: string,
  search: string,
  termId: string,
) {
  const detail =
    /^(\/topic\/(?:review-groups|reviews|review-assignments|proposal|dossier)|\/guidance\/(?:plan|tasks|review))\/[^/]+/.exec(
      pathname,
    );
  const termDetail = /^\/terms\/[^/]+(\/.*)?$/.exec(pathname);
  if (termDetail)
    return {
      pathname: `/terms/${encodeURIComponent(termId)}${termDetail[1] ?? ""}`,
      search: "",
    };
  const params = new URLSearchParams(search);
  params.set("termId", termId);
  for (const key of ["planId", "periodId", "taskId", "page"])
    params.delete(key);
  const destination =
    detail?.[1] === "/topic/review-assignments"
      ? "/topic/reviews"
      : (detail?.[1] ?? pathname);
  return { pathname: destination, search: params.toString() };
}
