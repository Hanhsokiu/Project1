import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

// Detail URLs may arrive from bookmarks or notifications, without a term filter.
// The authorized record returned by the server supplies its canonical term.
export function useRecordTerm(termId: string | undefined) {
  const [params, setParams] = useSearchParams();
  const current = params.get("termId");
  useEffect(() => {
    if (termId && termId !== current)
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("termId", termId);
          return next;
        },
        { replace: true },
      );
  }, [termId, current, setParams]);
}
