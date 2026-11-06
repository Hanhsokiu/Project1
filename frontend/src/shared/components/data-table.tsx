import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileSearch, Search, SlidersHorizontal, X } from "lucide-react";

export interface TableColumn<T> {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
}
export function DataTable<T>({ rows, columns, searchText, filters, emptyTitle, pageSize = 8,
  rowKey, selectionActions, filterCount = 0, label = "Danh sách dữ liệu",
}: {
  rows: T[]; columns: TableColumn<T>[]; searchText?: (row: T) => string;
  filters?: ReactNode; emptyTitle?: string; pageSize?: number;
  rowKey?: (row: T) => string; selectionActions?: (selected: T[]) => ReactNode;
  filterCount?: number; label?: string;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtersRef = useRef<HTMLDetailsElement>(null);
  const selectAll = useRef<HTMLInputElement>(null);
  const id = useId();
  const key = (row: T) => rowKey?.(row) ?? String((row as { id?: string }).id ?? rows.indexOf(row));
  const selectable = !!selectionActions;
  const filtered = useMemo(() => {
    let result = searchText ? rows.filter(row => searchText(row).toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"))) : [...rows];
    const column = columns.find(column => column.key === sort?.key);
    if (column?.sortValue && sort) {
      const value = column.sortValue;
      result = [...result].sort((a, b) => {
        const x = value(a) ?? "", y = value(b) ?? "";
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "vi", { numeric: true })) * (sort.desc ? -1 : 1);
      });
    }
    return result;
  }, [rows, search, searchText, columns, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const actual = Math.min(page, pages);
  const visible = filtered.slice((actual - 1) * pageSize, actual * pageSize);
  const chosen = rows.filter(row => selected.has(key(row)));
  const allPage = visible.length > 0 && visible.every(row => selected.has(key(row)));
  const togglePage = () => setSelected(previous => {
    const next = new Set(previous);
    visible.forEach(row => { if (allPage) next.delete(key(row)); else next.add(key(row)); });
    return next;
  });
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = !allPage && visible.some(row => selected.has(key(row))); });
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) filtersRef.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const toggle = (row: T) => setSelected(previous => {
    const next = new Set(previous); const rowId = key(row);
    if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
    return next;
  });
  return <div className="data-table">
    {(searchText || filters || columns.some(column => column.sortValue)) && <div className="table-toolbar">
      {searchText && <div className="search-input">
        <Search size={17} aria-hidden="true" />
        <input aria-label="Tìm kiếm" placeholder="Tìm theo mã, tên hoặc nội dung…" value={search}
          onChange={event => { setSearch(event.target.value); setPage(1); }} />
        {search && <button type="button" className="search-clear" aria-label="Xóa tìm kiếm" title="Xóa tìm kiếm" onClick={() => { setSearch(""); setPage(1); }}><X size={14} /></button>}
      </div>}
      {filters && <details ref={filtersRef} className="table-filter-popover" onKeyDown={event => {
        if (event.key === "Escape" && filtersRef.current) { filtersRef.current.open = false; filtersRef.current.querySelector("summary")?.focus(); }
      }}>
        <summary className={`btn btn-secondary ${filterCount ? "has-filters" : ""}`} aria-label="Mở bộ lọc">
          <SlidersHorizontal size={16} aria-hidden="true" /> Bộ lọc {filterCount > 0 && <span className="filter-count">{filterCount}</span>}
        </summary>
        <div className="table-filter-panel"><div className="filter-panel-heading"><strong>Lọc danh sách</strong><button type="button" className="icon-btn" aria-label="Đóng bộ lọc" title="Đóng bộ lọc" onClick={() => { if (filtersRef.current) { filtersRef.current.open = false; filtersRef.current.querySelector("summary")?.focus(); } }}><X size={16} /></button></div>{filters}</div>
      </details>}
      {columns.some(column => column.sortValue) && <select className="table-sort" aria-label="Sắp xếp danh sách" value={sort ? `${sort.key}:${sort.desc ? "desc" : "asc"}` : ""}
        onChange={event => { const [key, direction] = event.target.value.split(":"); setSort(key ? { key, desc: direction === "desc" } : null); setPage(1); }}>
        <option value="">Thứ tự mặc định</option>
        {columns.filter(column => column.sortValue).flatMap(column => [<option key={`${column.key}:asc`} value={`${column.key}:asc`}>{column.title}: tăng dần</option>, <option key={`${column.key}:desc`} value={`${column.key}:desc`}>{column.title}: giảm dần</option>])}
      </select>}
      <span className="table-count" aria-live="polite">{filtered.length} bản ghi</span>
      {selectable && <label className="mobile-select-page"><input type="checkbox" aria-label="Chọn tất cả dòng trong trang" checked={allPage} onChange={togglePage} />Chọn trang</label>}
    </div>}
    {selectable && chosen.length > 0 && <div className="table-selection-bar" role="region" aria-label="Thao tác với dòng đã chọn">
      <strong>Đã chọn {chosen.length}</strong><div className="actions">{selectionActions(chosen)}</div>
      <button type="button" className="text-link" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
    </div>}
    {!filtered.length ? <div className="empty" role="status"><FileSearch size={32} aria-hidden="true" /><h3>{emptyTitle || (search || filterCount ? "Không tìm thấy kết quả" : "Chưa có dữ liệu")}</h3><p>{search || filterCount ? "Thử từ khóa khác hoặc điều chỉnh bộ lọc để mở rộng kết quả." : "Dữ liệu sẽ xuất hiện khi có hồ sơ phù hợp."}</p>{search && <button type="button" className="btn btn-secondary" onClick={() => setSearch("")}>Xóa tìm kiếm</button>}</div> : <>
      <div className="table-scroll"><table aria-label={label}>
        <thead><tr>
          {selectable && <th className="selection-cell"><input ref={selectAll} type="checkbox" aria-label="Chọn tất cả dòng trong trang" checked={allPage} onChange={togglePage} /></th>}
          {columns.map(column => <th key={column.key} scope="col" className={/^(actions?|edit|tools)$/.test(column.key) ? "table-actions-cell" : undefined} aria-sort={sort?.key === column.key ? sort.desc ? "descending" : "ascending" : undefined}>
            {column.sortValue ? <button type="button" className="column-sort" onClick={() => { setSort(previous => ({ key: column.key, desc: previous?.key === column.key ? !previous.desc : false })); setPage(1); }}>{column.title}{sort?.key === column.key ? sort.desc ? <ArrowDown size={13} /> : <ArrowUp size={13} /> : <ArrowUpDown size={13} />}</button> : column.title}
          </th>)}
        </tr></thead>
        <tbody>{visible.map(row => <tr key={key(row)} className={selected.has(key(row)) ? "is-selected" : undefined}>
          {selectable && <td className="selection-cell" data-label="Chọn dòng"><input type="checkbox" aria-label={`Chọn dòng ${searchText ? searchText(row).slice(0, 90) : key(row)}`} checked={selected.has(key(row))} onChange={() => toggle(row)} /></td>}
          {columns.map(column => <td key={column.key} data-label={column.title} className={/^(actions?|edit|tools)$/.test(column.key) ? "table-actions-cell" : undefined}>{column.render(row)}</td>)}
        </tr>)}</tbody>
      </table></div>
      <div className="pagination"><span id={`${id}-page`} aria-live="polite">Hiển thị {(actual - 1) * pageSize + 1}–{Math.min(actual * pageSize, filtered.length)} / {filtered.length}</span><div className="pagination-controls">
        <button type="button" className="icon-btn" aria-label="Trang trước" title="Trang trước" disabled={actual === 1} onClick={() => setPage(actual - 1)}><ChevronLeft size={17} /></button><span>Trang {actual} / {pages}</span>
        <button type="button" className="icon-btn" aria-label="Trang sau" title="Trang sau" disabled={actual === pages} onClick={() => setPage(actual + 1)}><ChevronRight size={17} /></button>
      </div></div>
    </>}
  </div>;
}
