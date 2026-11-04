import { Children, Fragment, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

function containsSearch(node: ReactNode): boolean {
  if (!isValidElement(node)) return false;
  const props = node.props as { children?: ReactNode; "aria-label"?: string };
  return (node.type === "input" && !!props["aria-label"]?.startsWith("Tìm")) || Children.toArray(props.children).some(containsSearch);
}
function flatten(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap(child => isValidElement(child) && child.type === Fragment
    ? flatten((child.props as { children?: ReactNode }).children) : [child]);
}
/** Reuses the page's controlled inputs, preserving filters and request parameters. */
export function FilterBar({ children, searchControl }: { children: ReactNode; searchControl?: { value: string; onSearch: (value: string) => void; label: string } }) {
  const nodes = flatten(children);
  const searches = nodes.filter(containsSearch);
  const advanced = nodes.filter(node => !containsSearch(node));
  const [draft, setDraft] = useState(searchControl?.value || "");
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => setDraft(searchControl?.value || ""), [searchControl?.value]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (details.current && !details.current.contains(event.target as Node)) details.current.open = false; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return <div className="workflow-filterbar">
    {searchControl ? <form className="search-input" role="search" onSubmit={event => { event.preventDefault(); searchControl.onSearch(draft.trim()); }}>
      <Search size={17} aria-hidden="true" /><input aria-label={searchControl.label} placeholder={searchControl.label + "…"} value={draft} onChange={event => setDraft(event.target.value)} />
      <button type="submit" className="search-clear" aria-label="Tìm kiếm" title="Tìm kiếm"><Search size={15} /></button>
    </form> : searches.map((node, index) => <div className="workflow-filter-search search-input" key={index}><Search size={17} aria-hidden="true" />{node}</div>)}
    {advanced.length > 0 && <details ref={details} className="table-filter-popover" onKeyDown={event => { if (event.key === "Escape" && details.current) { details.current.open = false; details.current.querySelector("summary")?.focus(); } }}>
      <summary className="btn btn-secondary"><SlidersHorizontal size={16} />Bộ lọc</summary>
      <div className="table-filter-panel"><div className="filter-panel-heading"><strong>Lọc danh sách</strong><button type="button" className="icon-btn" aria-label="Đóng bộ lọc" title="Đóng bộ lọc" onClick={() => { if (details.current) { details.current.open = false; details.current.querySelector("summary")?.focus(); } }}><X size={16} /></button></div>{advanced}</div>
    </details>}
  </div>;
}
