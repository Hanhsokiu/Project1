import { Field } from "../../../shared/components/kit";
import type { DemoDb } from "../../../shared/data/types";
import type { SaveAccountInput } from "../services/auth-service";

export function AccountAcademicFields({
  form,
  db,
  onChange,
}: {
  form: SaveAccountInput;
  db: Pick<DemoDb, "catalogs" | "students">;
  onChange: (value: SaveAccountInput) => void;
}) {
  const programs = db.catalogs.filter((c) => c.kind === "program" && c.active);
  const program = programs.find((p) => p.id === form.trainingSystemId);
  const classes = [
    ...new Set(
      db.students
        .filter((s) =>
          s.trainingSystemId
            ? s.trainingSystemId === form.trainingSystemId
            : s.program === program?.name,
        )
        .map((s) => s.className.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "vi"));
  const departments = db.catalogs.filter(
    (c) => c.kind === "department" && c.active,
  );
  const directions = db.catalogs.filter(
    (c) => c.kind === "direction" && c.active,
  );
  return (
    <>
      {form.roles.includes("STUDENT") && (
        <fieldset className="mt-5 rounded-xl border border-slate-200 p-4">
          <legend className="px-2 font-semibold">Hồ sơ sinh viên</legend>
          <div className="form-grid">
            <Field label="Hệ đào tạo">
              <select
                required
                aria-label="Hệ đào tạo"
                value={form.trainingSystemId || ""}
                onChange={(e) =>
                  onChange({
                    ...form,
                    trainingSystemId: e.target.value,
                    className: "",
                  })
                }
              >
                <option value="">Chọn hệ đào tạo</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ngành học">
              <input
                required
                aria-label="Ngành học"
                maxLength={200}
                value={form.majorName || ""}
                onChange={(e) =>
                  onChange({ ...form, majorName: e.target.value })
                }
              />
            </Field>
            <Field label="Lớp">
              <input
                required
                aria-label="Lớp"
                list="account-student-classes"
                maxLength={100}
                disabled={!program}
                placeholder="Chọn lớp đã có hoặc nhập lớp mới"
                value={form.className || ""}
                onChange={(e) =>
                  onChange({ ...form, className: e.target.value })
                }
              />
              <datalist id="account-student-classes">
                {classes.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </Field>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Chọn hệ đào tạo trước; danh sách lớp được lấy từ sinh viên cùng hệ.
            Có thể nhập lớp mới khi chưa có trong danh sách.
          </p>
        </fieldset>
      )}
      {form.roles.includes("LECTURER") && (
        <fieldset className="mt-5 rounded-xl border border-slate-200 p-4">
          <legend className="px-2 font-semibold">Hồ sơ giảng viên</legend>
          <div className="form-grid">
            <Field label="Bộ môn">
              <select
                required
                aria-label="Bộ môn"
                value={form.departmentId || ""}
                onChange={(e) =>
                  onChange({ ...form, departmentId: e.target.value })
                }
              >
                <option value="">Chọn bộ môn</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Số sinh viên hướng dẫn tối đa">
              <input
                required
                type="number"
                min={0}
                max={100}
                step={1}
                aria-label="Số sinh viên hướng dẫn tối đa"
                value={form.maxStudents ?? 5}
                onChange={(e) =>
                  onChange({ ...form, maxStudents: Number(e.target.value) })
                }
              />
            </Field>
            <fieldset className="full">
              <legend className="mb-2 text-sm font-medium">
                Hướng chuyên môn có thể hướng dẫn
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {directions.map((d) => (
                  <label className="checkbox-row" key={d.id}>
                    <input
                      type="checkbox"
                      checked={form.researchAreaIds?.includes(d.id) ?? false}
                      onChange={(e) =>
                        onChange({
                          ...form,
                          researchAreaIds: e.target.checked
                            ? [...(form.researchAreaIds ?? []), d.id]
                            : form.researchAreaIds?.filter((id) => id !== d.id),
                        })
                      }
                    />
                    {d.name}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Chọn ít nhất một hướng chuyên môn. Số sinh viên tối đa ở đây là
                mặc định; chỉ tiêu từng đợt được cấu hình riêng.
              </p>
              {!directions.length && (
                <p role="status" className="mt-2 text-sm text-amber-700">
                  Chưa có hướng chuyên môn trong danh mục. Bổ sung danh mục
                  trước khi tạo tài khoản giảng viên.
                </p>
              )}
            </fieldset>
          </div>
        </fieldset>
      )}
    </>
  );
}
