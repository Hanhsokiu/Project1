import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTable } from "./data-table";
const rows = [{ id: "one", name: "Sinh viên đầu tiên" }];
const columns = [{ key: "name", title: "Sinh viên", render: (row: typeof rows[number]) => row.name }];
describe("table collection completeness", () => {
  it("shows server total for a visible first page instead of counting the loaded batch as the whole directory", () => {
    const html = renderToStaticMarkup(<DataTable rows={rows} columns={columns} searchText={(row) => row.name} pageSize={1}
      collection={{ total: 150, complete: false, loading: true }} />);
    expect(html).toContain("Sinh viên đầu tiên");
    expect(html).toContain("150 bản ghi");
    expect(html).toContain("Hiển thị 1–1 / 150");
  });
  it("does not show a partial filtered collection as a final result or false empty state", () => {
    const html = renderToStaticMarkup(<DataTable rows={[]} columns={columns} searchText={(row) => row.name} filterCount={1}
      collection={{ total: 150, complete: false, loading: true }} />);
    expect(html).toContain("Đang tải đầy đủ kết quả");
    expect(html).not.toContain("Không tìm thấy kết quả");
    expect(html).not.toContain("0 bản ghi");
  });
  it("keeps ordinary local tables unchanged", () => {
    const html = renderToStaticMarkup(<DataTable rows={rows} columns={columns} searchText={(row) => row.name} />);
    expect(html).toContain("1 bản ghi");
    expect(html).toContain("Sinh viên đầu tiên");
  });
});
