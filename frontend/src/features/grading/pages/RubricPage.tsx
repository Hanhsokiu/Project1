import { useState } from "react";
import {
  Button,
  Card,
  DataBoundary,
  Field,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import type { Criterion, DemoDb } from "../../../shared/data/types";
import { useDefenseScope } from "../../defense/components/DefenseScope";
import {
  rubricKey,
  saveRubric,
  type ScoreKind,
} from "../services/grading-service";
const kinds: { id: ScoreKind; name: string }[] = [
  { id: "ADVISOR", name: "Giảng viên hướng dẫn" },
  { id: "REVIEWER", name: "Giảng viên phản biện" },
  { id: "COMMITTEE", name: "Hội đồng bảo vệ" },
];
function Editor({ db, kind }: { db: DemoDb; kind: ScoreKind }) {
  const s = useDefenseScope(db);
  const [criteria, setCriteria] = useState<Criterion[]>(
    structuredClone(db.rubrics[rubricKey(kind)]),
  );
  const total = criteria.reduce((sum, c) => sum + c.max, 0);
  const locked = db.scores.some((x) => x.kind === kind);
  return (
    <Card
      title="Tiêu chí đánh giá"
      description="Thang điểm 10. Rubric đang được dùng cho mọi đợt trong bản demo; backend cần version hóa theo đợt."
    >
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tiêu chí</th>
              <th>Điểm tối đa</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {criteria.map((c, i) => (
              <tr key={c.id}>
                <td>
                  <input
                    aria-label={`Tên tiêu chí ${i + 1}`}
                    disabled={!s.faculty || locked}
                    value={c.name}
                    onChange={(e) =>
                      setCriteria(
                        criteria.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    className="max-w-28"
                    aria-label={`Điểm tối đa ${i + 1}`}
                    disabled={!s.faculty || locked}
                    type="number"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={c.max}
                    onChange={(e) =>
                      setCriteria(
                        criteria.map((x, j) =>
                          j === i ? { ...x, max: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  {s.faculty && !locked && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setCriteria(criteria.filter((_, j) => j !== i))
                      }
                    >
                      Xóa
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Tổng điểm</th>
              <th>{total.toFixed(1)} / 10</th>
              <th />
            </tr>
          </tfoot>
        </table>
      </div>
      {locked && (
        <Notice>
          Đã có phiếu điểm theo Rubric này. Tiêu chí được khóa để bảo toàn điểm
          đã nhập.
        </Notice>
      )}
      {s.faculty && !locked && (
        <div className="dialog-actions">
          <Button
            variant="secondary"
            onClick={() =>
              setCriteria([
                ...criteria,
                { id: `criterion-${Date.now()}`, name: "", max: 1 },
              ])
            }
          >
            Thêm tiêu chí
          </Button>
          <Button
            disabled={s.pending || Math.abs(total - 10) > 0.0001}
            onClick={() => s.exec(() => saveRubric(kind, criteria))}
          >
            Lưu Rubric
          </Button>
        </div>
      )}
    </Card>
  );
}
function Content({ db }: { db: DemoDb }) {
  const [kind, setKind] = useState<ScoreKind>("ADVISOR");
  return (
    <>
      <PageHeader
        title="Rubric và tiêu chí chấm điểm"
        description="Mỗi giảng viên chấm theo đúng tiêu chí và mức điểm tối đa của vai trò được phân công."
      />
      <Field label="Bộ tiêu chí">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ScoreKind)}
        >
          {kinds.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </Field>
      <Editor key={kind} db={db} kind={kind} />
    </>
  );
}
export default function RubricPage() {
  return <DataBoundary>{(db) => <Content db={db} />}</DataBoundary>;
}
