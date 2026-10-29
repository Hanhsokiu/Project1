import { RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Back,
  Button,
  Card,
  Field,
  Notice,
  PageHeader,
} from "../../../shared/components/kit";
import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import { termService } from "../services/term-service";
export default function TermParameterPage() {
  const { id } = useParams();
  const { db } = useWorkspace();
  const t = db.terms.find((t) => t.id === id);
  const action = useAction({ invalidateTerms: true });
  const [values, setValues] = useState<Record<string, number>>(() => ({
    ...t?.parameters,
  }));
  useEffect(() => setValues({ ...t?.parameters }), [t?.id, t?.parameters]);
  if (!t)
    return (
      <Card>
        <Notice tone="danger">Không tìm thấy đợt.</Notice>
        <Back to="/terms" />
      </Card>
    );
  const disabled = t.locked || ["COMPLETED", "CANCELLED"].includes(t.status);
  return (
    <>
      <Back to={`/terms/${t.id}`} />
      <PageHeader
        title="Tham số đăng ký & phân công"
        description={`${t.code} · Cấu hình điều kiện đầu vào của đợt.`}
      />
      {disabled && (
        <div className="mb-5">
          <Notice tone="warning">
            Đợt đã khóa hoặc kết thúc. Tham số chỉ được xem.
          </Notice>
        </div>
      )}
      <div className="section-grid">
        <Card title="Điều kiện đăng ký">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await action.run(() =>
                  termService.saveParameters(t.id, values),
                );
              } catch {
                // useAction displays the failure; keep the current form available for correction.
              }
            }}
          >
            <div className="form-grid">
              <Field
                label="Nguyện vọng tối đa"
                hint="Các GV phải khác nhau, có thứ tự ưu tiên liên tục."
              >
                <input
                  type="number"
                  required
                  disabled={disabled}
                  min={1}
                  max={3}
                  step={1}
                  value={values.max_preferences ?? 3}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      max_preferences: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field
                label="GPA đủ điều kiện"
                hint="Điểm GPA tích lũy theo thang 4."
              >
                <input
                  type="number"
                  required
                  disabled={disabled}
                  min={0}
                  max={4}
                  step={0.01}
                  value={values.passing_gpa_threshold ?? 2}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      passing_gpa_threshold: Number(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <div className="mt-5">
              <Notice>
                SV cần thuộc danh sách tham gia, đúng hệ đào tạo, đủ điều kiện
                học vụ, đổi mật khẩu lần đầu và hoàn tất Email/SĐT trước khi gửi
                đăng ký.
              </Notice>
            </div>
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={disabled}
                onClick={() => setValues({ ...t.parameters })}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Khôi phục
              </Button>
              <Button disabled={disabled || action.pending}>
                <Save size={16} aria-hidden="true" />
                Lưu tham số
              </Button>
            </div>
          </form>
        </Card>
        <div className="stack">
          <Card title="Chính sách phân công demo">
            <ol className="space-y-4 text-sm muted list-decimal pl-5">
              <li>Xét toàn bộ NV1 trước, rồi NV2 và NV3 cho SV còn lại.</li>
              <li>
                Cùng vòng, ưu tiên GPA cao hơn; khi bằng GPA dùng thời điểm đăng
                ký và mã SV để kết quả ổn định.
              </li>
              <li>
                Trượt các NV: chọn GV đúng hướng còn quota, ưu tiên tỷ lệ tải
                thấp hơn.
              </li>
              <li>
                Khoa điều chỉnh thủ công kèm lý do, kiểm tra lại trước chốt/công
                bố.
              </li>
            </ol>
          </Card>
          <Notice>
            Quota được quản lý ở Danh sách tham gia của từng đợt. Đăng ký nguyện
            vọng không giữ trước chỉ tiêu GV.
          </Notice>
        </div>
      </div>
    </>
  );
}
