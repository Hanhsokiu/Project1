# Gói G — Hoàn thiện kỹ thuật UC22–UC25 và tháo chặn UC24

Ngày 28/10/2026. Dự án `C:\DATN\Project1`.

**Không kết nối bất kỳ PostgreSQL instance nào. SQL NOT EXECUTED.** Không chạy migration, seed, reset, db push, Docker, script phá hủy, tạo tài khoản hoặc dữ liệu thật. Gói này không sửa schema, migration, seed, permission hoặc ba endpoint C01. Không sửa workflow UC17–21; chỉ siết consumer grading của các nguồn đó.

## 1. Kết luận và căn cứ

Đã triển khai code, adapter validation, frontend và kiểm thử các phần độc lập; chưa thể mở công bố production bằng một policy mặc định. `UnknownAdvisorGradeReader` và `UnknownCouncilResultConfirmationReader` tiếp tục được wiring trong module production. Không có API tự duyệt calculation policy. Các fixture mang nhãn TEST ONLY không phải phê duyệt nghiệp vụ.

Đối chiếu working tree với báo cáo Gói F; đọc trực tiếp XML của `docs/spec/Project_1_06.docx`, UC22–25 (các đoạn 1652–1738), `docs/spec/dac-ta-use-case.md` mục 3, `docs/spec/diem-can-xac-nhan.md`, ADR-0003 và schema/migration/code hiện hành.

Những quy tắc có căn cứ:

- Rubric GVPB: bố cục 2, nội dung 3, thực tiễn 1, hoàn thiện 2, làm chủ 2; tổng 10 và ít nhất hai câu hỏi.
- QT = 0,5 GVHD + 0,5 GVPB; KTHP = trung bình điểm thành viên tham gia chấm; HP = 0,4 QT + 0,6 KTHP. Ví dụ tài liệu cho QT=8, KTHP=8,25, HP=8,15.
- Tài liệu nêu QT, KTHP và HP cùng >=5; ADR cho phép cấu hình trọng số/ngưỡng theo `TermParameter`. Không đủ căn cứ chọn độ chính xác/lúc làm tròn hoặc xét đạt bằng giá trị thô hay đã làm tròn.
- UC22 cần đúng phân công và mốc phản biện. UC23 cần Hội đồng/lịch chính thức, trạng thái Đang bảo vệ và ngày/buổi bảo vệ. Không suy ra cửa sổ sửa muộn từ đó.
- Chốt phiếu cá nhân khác chốt kết quả, và chốt kết quả khác công bố. UC24 cần nguồn GVHD, phản biện, thành viên, xác nhận tập thể và Khoa; SV chỉ xem sau công bố.
- Chủ tịch/Thư ký chỉ xác nhận khi được phân quyền. Vai trò trong Hội đồng tự nó chưa chứng minh quyền hoặc quy tắc quorum.
- Sửa sau gửi/chốt cần quyền, lịch sử; sau chốt cần người, thời điểm, trước/sau và lý do. Đặc tả chưa định nghĩa đầy đủ authority/state machine của amendment.
- UC25 cần permission/scope, dữ liệu tồn tại, audit khi xuất và thông báo nếu mẫu chưa cấu hình. Hoàn tất sửa luận văn trước lưu chiểu không được tự biến thành trạng thái điểm mới.

## 2. Tối đa 5 nhóm quyết định cần duyệt

Tất cả phương án MVP dưới đây là **NEEDS_APPROVAL**, chưa được áp dụng thành chính sách production.

| Nhóm                          | Có căn cứ / còn thiếu                                                                                                                                                                                                                         | MVP khuyến nghị để nhóm duyệt                                                                                                                                                                                                               | Ảnh hưởng khi duyệt / chọn khác                                                                                                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Quorum, làm tròn và scheme | Đã rõ công thức/ngưỡng mẫu và nguồn cấu hình TermParameter. Chưa rõ số thành viên tối thiểu thực chấm, vắng/phiếu trắng, làm tròn trung gian, số chữ số và xét đạt RAW/ROUNDED. Bảng mẫu bốn người không chứng minh quorum cố định bốn người. | Mọi thành viên chính thức có phiếu SEALED; HALF_UP với QT 2/KTHP 3/HP 2, HP dùng QT/KTHP đã làm tròn, xét đạt ROUNDED; cấu hình đợt khớp profile UTC. Đây chính là profile ứng viên có test, không phải quy chế đã duyệt.                   | Cần command phê duyệt có authority/audit và policy revision bất biến. Nếu cho chấm thiếu/vắng, phải version quy tắc attendance/quorum và mẫu số; nếu khác cách làm tròn/tham số, thêm scheme mới, không đổi nghĩa V1. Không cần sửa legacy aggregator. |
| 2. Nguồn điểm GVHD cuối cùng  | UC16/biểu mẫu nêu điểm GVHD; chưa xác định bản ghi nào là điểm cuối có hiệu lực. `EvaluationWorkflow`/điểm phase không gắn PDF cuối; `ScoreEntry` role ADVISOR thiếu provenance mới.                                                          | Ledger điểm GVHD cuối riêng, GVHD chính thức chốt theo phân công và PDF hiện hành, revision/hash/actor/time/history; adapter chỉ trả VERIFIED từ nguồn này.                                                                                 | Có thể cần model/migration mới sau thiết kế được duyệt. Nếu tái sử dụng UC16, phải chỉ rõ loại bản đánh giá, quy tắc quy đổi, chốt và ràng buộc PDF/assignment. Không copy số legacy thành điểm chính thức.                                            |
| 3. Xác nhận Hội đồng          | Đặc tả cần xác nhận tập thể và phân quyền Chủ tịch/Thư ký; chưa rõ một hay hai người ký, delegation, deadline và cách xử lý người vắng.                                                                                                       | Một Chủ tịch hiện hành có permission xác nhận riêng; xác nhận đúng schedule artifact và toàn bộ id/revision/hash phiếu đã chốt; Khoa vẫn chốt/công bố riêng.                                                                                | Cần nguồn xác nhận bất biến và permission được duyệt; nếu hai chữ ký phải lưu cả hai cùng một tập bằng chứng. Contract kỹ thuật đã có; hiện không có producer hoặc quyền mặc định.                                                                     |
| 4. Amendment và sửa muộn      | Đã rõ bắt buộc quyền đặc biệt, reason và lịch sử; thiếu người phê duyệt, hạn, thông báo và tác động đến kết quả đã công bố.                                                                                                                   | Endpoint amendment riêng, giữ phiếu SEALED; expectedRevision/context, reason, bản trước/sau, nguồn mới, actor/time/audit trong transaction. Xác nhận tập thể phải được làm lại cho bộ phiếu mới; công bố sửa phải là revision mới có duyệt. | Không mở SEALED→DRAFT qua API lưu nháp. Chưa tự thu hồi/xóa bản công bố cũ. Có thể mở rộng JSON hoặc thêm ledger yêu cầu sửa sau khi chốt thiết kế; không sửa workflow cũ ngầm.                                                                        |
| 5. Mẫu ký, phạm vi đọc/export | Có tên/cột biểu mẫu nhưng thiếu mẫu hành chính chuẩn, nội dung ký/đóng dấu, sửa sau bảo vệ và quyền xem phiếu của người khác trước công bố.                                                                                                   | Giữ Excel/PDF tra cứu đã công bố và Excel phân công/lịch theo grant; mẫu ký BLOCKED đến khi Khoa cung cấp mẫu. Người chấm đọc phiếu của chính mình; không tự mở đọc chéo hoặc export điểm chưa công bố.                                     | Mở thêm cần permission/scope, template/version/font/layout và test PII. Ngày sinh, nhận xét cá nhân và chữ ký không được thêm chỉ vì mẫu liệt kê chúng. Có thể cần nguồn biên bản/yêu cầu sửa riêng.                                                   |

## 3. Code đã bổ sung

### Provenance của phiếu và nguồn UC18–21

- Tách validator một revision phiếu để dùng chung cho bản hiện hành và history. Kiểm tra envelope term/proposal/kind/scorer/actor/time/state/revision, source stage/id/revision/hash, điểm tính lại và câu hỏi GVPB.
- Rubric snapshot phải có mã duy nhất và tổng tối đa 10; đối chiếu đúng policy revision lịch sử, không lấy policy hiện hành để hợp thức hóa phiếu cũ.
- Đọc artifact bất biến thực sự, tính lại hash, kiểm metadata, liên kết upstream, phân công GVPB/thành viên, sinh viên và nguồn UC18 V2. PDF/assignment của phiếu phải khớp bằng chứng UC18 lịch sử. Không cần giữ PDF cũ để đọc provenance.
- Consumer grading kiểm policy cấu trúc của UC20/21 khớp UC18; kiểm quyết định UC17 bằng validator hiện hành, applicability với PDF/assignment/actor, ngoài id/revision/status. Không sửa producer UC17–21.
- History không đủ xác minh trả integrity UNKNOWN và draft/total=null. Không sửa/xóa/backfill history.

### Contract điểm GVHD và xác nhận tập thể

- Thêm evidence schemaVersion=1, đúng term/proposal, actor/time và authorityReference; ràng buộc assignment/PDF cho GVHD, schedule id/revision/hash và tất cả phiếu id/revision/hash cho Hội đồng.
- Tính lại canonical SHA-256 toàn bộ payload; chặn hash chỉ đúng hình dạng, sai scope, metadata tương lai, thiếu/trùng phiếu hoặc nguồn thay revision/hash.
- Hash chứng minh toàn vẹn và liên kết, không chứng minh người ký có thẩm quyền. Producer tương lai phải kiểm permission/phân công/phê duyệt và nguồn bất biến. Contract không nhận dữ liệu có thẩm quyền từ HTTP client.
- Adapter production UNKNOWN được giữ nguyên; không coi role CHAIR/SECRETARY hoặc đủ phiếu SEALED là xác nhận tập thể.

### TermParameter và kết quả

- Bộ đọc dùng transaction caller, chỉ SELECT năm khóa grading trong TermParameter; không fallback giá trị mặc định. Kiểm đủ/duy nhất, số hữu hạn, khoảng hợp lệ, tổng trọng số bằng 1, term và timestamp.
- Scheme `UTC_40_60_V1` chỉ hỗ trợ profile 0,5/0,5 và 0,4/0,6 theo tài liệu; minimum của policy phải khớp min_pass_score. Profile cấu hình khác bị `CALCULATION_PARAMETER_PROFILE_UNSUPPORTED`; cần scheme được duyệt riêng thay vì bỏ qua cấu hình đợt.
- Snapshot tham số (id/key/value/updatedAt, version và hash) tham gia expectedContext và được lưu trong snapshot kết quả; kiểm lại trước commit. Tham số thiếu/hỏng trả `GRADING_PARAMETERS_UNVERIFIED`, tổng điểm null và chặn ghi.
- Engine từ chối policy thiếu/không hỗ trợ scheme/quorum/làm tròn/approvalReference trước khi tính; không sử dụng mặc định Decimal hoặc aggregator legacy.
- Reader công bố đọc chính xác các GradingSheetRevision được tham chiếu, kiểm policy/source/actor/envelope và tổng điểm từng phiếu. Không chỉ tin các con số gradeValues bên trong một result JSON đã được băm lại. Kiểm đủ thành viên của artifact lịch sử theo contract quorum ứng viên, không lấy roster hiện tại làm quorum lịch sử.
- Snapshot kết quả chứa evidence đầy đủ của GVHD/Hội đồng và tham số. Root snapshotSchemaVersion vẫn 1 theo CHECK migration F; evidence con có version riêng. Bản thiếu evidence không được coi là công bố đã xác minh, không backfill tự động hoặc promote legacy.
- Kết quả lịch sử hợp lệ vẫn đọc được khi PDF/phân công/tham số hiện hành đổi. Lệnh chốt/công bố mới vẫn phải kiểm nguồn hiện hành và context. Không tự viết lại kết quả cũ.
- Công thức chỉ chạy khi không còn blocker nguồn/policy; không hiển thị số tổng hợp như hợp lệ khi còn thiếu chứng cứ. Không cập nhật DefenseEligibility hoặc UC17.

### HTTP, frontend và export

- Giữ nguyên route/permission/feature flag Gói F. Thêm private/no-store cho GET policy/history và summary; CSP sandbox cho binary export. JWT/permission/grant không có bypass ADMIN/FACULTY.
- Context giữ mã lỗi cụ thể từ HttpException (window/term/session/source), không biến mọi lỗi thành GRADING_NOT_OPEN; lỗi nội bộ bất ngờ không bị nuốt thành blocker thông thường.
- Frontend giải thích thiếu policy/điểm GVHD/xác nhận/quorum/tham số/mốc/mẫu. Lỗi conflict thật vẫn yêu cầu tải và xem lại; không tự coi reload là phê duyệt policy.
- Binary adapter giải mã JSON lỗi 403/409/422/503 thay vì tải JSON như PDF/XLSX; 401 tiếp tục dùng interceptor refresh JWT hiện hành. Không fallback mock, không thay shared HTTP client hay lưu JWT/PDF mới.
- Export kết quả chỉ lấy PUBLISHED qua verifier mới. Thêm GVHD/GVPB, Hội đồng lịch sử, policy revision và hash bản công bố. Lọc Hội đồng theo artifact đã tham chiếu lúc công bố, không lấy chain hiện hành để gán nhãn lại.
- Mã SV/lớp và routing grant vẫn từ catalog hiện hành; tên SV/đề tài/Hội đồng từ snapshot lịch sử. Đây là bảng tra cứu, chưa phải bảng hành chính đóng dấu. Không xuất ngày sinh, private key/path, nhận xét/câu hỏi cá nhân hoặc authorityReference.
- XLSX giữ số ở dạng số, neutralize chuỗi có thể thành công thức. PDF tra cứu có font Việt; mẫu PDF lịch/phản biện/biên bản ký chưa cấu hình tiếp tục 409. Kiểm quyền/scope trước thông báo mẫu ở service.
- Chưa có endpoint xuất PDF phiếu chấm cá nhân hoặc đọc phiếu người khác. Endpoint `grading/.../:kind/report` là tải **luận văn**, có identity PDF và phân công; không phải phiếu chấm. Không mở đường đọc mới khi quyền/mẫu chưa được duyệt.

## 4. File của Gói G

Các file Gói F đã tồn tại trong working tree chưa commit; bảng này chỉ liệt kê những file Gói G thực sự tạo/chạm thêm, không nhận các thay đổi cũ là của Gói G.

| File                                                      | Thay đổi                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| backend/src/grading/workflow/grading-evidence.ts          | Mới: contract/validator/hash evidence GVHD/Hội đồng                           |
| backend/src/grading/workflow/grading-parameters.ts        | Mới: đọc/xác minh snapshot TermParameter, khớp scheme                         |
| backend/src/grading/workflow/grading.completion.spec.ts   | Mới: 40 test evidence/formula/history/publication                             |
| backend/src/grading/workflow/grading-parameters.spec.ts   | Mới: 18 test tham số/context/historical publication                           |
| backend/src/grading/workflow/advisor-grade.port.ts        | Dùng kiểu evidence có version; giữ UNKNOWN production                         |
| backend/src/grading/workflow/grading.policy.ts            | Rubric toàn vẹn, result evidence, policy runtime/error code                   |
| backend/src/grading/workflow/grading.repository.ts        | SELECT policy/phiếu lịch sử/TermParameter đúng caller, include policy history |
| backend/src/grading/workflow/grading.service.ts           | Verifier chung, reader công bố/history, gating/context/parameter evidence     |
| backend/src/grading/workflow/grading-source.reader.ts     | Kiểm UC17 applicability và policy cấu trúc artifact                           |
| backend/src/grading/workflow/grading-source.spec.ts       | Thêm 4 ca UC17 giả giữ nguyên revision                                        |
| backend/src/grading/workflow/grading.test-fixtures.ts     | Nguồn test có evidence/hash thật, mock SELECT mới; không seed                 |
| backend/src/grading/workflow/grading.http.spec.ts         | Thêm 5 test HTTP JWT/export/không công bố từ seal                             |
| backend/src/grading/workflow/grading.controller.ts        | Cache-Control policy/history                                                  |
| backend/src/report/official/official-report.service.ts    | Verifier PUBLISHED, scope/filter lịch sử và cột evidence                      |
| backend/src/report/official/official-report.controller.ts | Cache-Control summary và CSP binary                                           |
| backend/src/report/official/official-report.spec.ts       | Thêm 4 test nội dung/scope/provenance/auth export                             |
| frontend/src/features/grading/workflow/api.ts             | Thông báo blocker, giải mã lỗi binary và giữ JWT refresh                      |
| frontend/src/features/grading/workflow/api.test.ts        | Thêm 10 test policy blocker/binary error/no fallback                          |
| frontend/src/features/grading/workflow/pages.tsx          | Render giải thích blocker của backend                                         |
| docs/audits/step10-uc24-unblock-and-completion.md         | Báo cáo này                                                                   |

Không thêm API hoặc preview. Giữ nguyên các route của Gói F: grading inbox/context/draft/seal/history/report, grading policy/history, results preview/seal/publish/history/reader SV, official-reports export/summary. Frontend vẫn dùng `VITE_GRADING_API=true` cùng `VITE_AUTH_API=true` trên `/grading/reviewer`, `/grading/committee`, `/grading/policy`, `/grading/results`, `/report/official`; demo độc lập khi tắt flag.

## 5. Trạng thái UC22–25

| UC   | Trạng thái                          | Đã chạy ở mức code/mock                                                                                                                                | Chưa hoàn thành                                                                                                                    |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| UC22 | PARTIAL                             | Phân công chính thức, PDF riêng tư, draft/seal, rubric mẫu, provenance/history/audit, frontend                                                         | Amendment sau gửi/chốt và kiểm chứng dữ liệu thật                                                                                  |
| UC23 | PARTIAL                             | Hội đồng/lịch chính thức, rubric cấu hình, draft/seal và quyền riêng từng người, session/source checks                                                 | Xác nhận tập thể/quorum/biên bản và sửa muộn chưa được duyệt                                                                       |
| UC24 | PARTIAL; công bố production BLOCKED | Verifier đầy đủ, engine/version/TermParameter bridge, transaction/CAS/context/history/audit, reader PUBLISHED; nhánh thành công bằng fixture TEST ONLY | Chưa có source GVHD cuối và xác nhận Hội đồng, chưa duyệt quorum/làm tròn/authority; không thể publish production an toàn          |
| UC25 | PARTIAL                             | Excel phân công/lịch/kết quả, PDF tra cứu kết quả, scope/PII/audit/hash/font/content tests và UI download                                              | Biên bản ký/phiếu chấm PDF/mẫu hành chính chuẩn, quyền đọc chéo trước công bố và thống kê toàn học vụ; kết quả thật phụ thuộc UC24 |

## 6. Kiểm tra thực tế

| Kiểm tra                                          | Kết quả                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Full backend unit + HTTP mock, GPMS_INTEGRATION=0 | PASS 1.308/1.308, 82 file; gồm thêm 71 test Gói G                                   |
| Full frontend unit/SSR/adapter                    | PASS 383/383, 36 file; thêm 10 test Gói G                                           |
| TypeScript backend/frontend/shared                | PASS cả ba, --noEmit --incremental false                                            |
| Backend lint toàn bộ                              | PASS lần cuối, sau sửa 3 biến không dùng trong helper mới; không tắt rule           |
| Frontend lint toàn bộ                             | PASS                                                                                |
| Prisma validate offline                           | PASS; dùng URL schema-only 127.0.0.1:1, không dùng URL ứng dụng và không mở kết nối |
| Prettier các file Gói G và git diff --check       | PASS cả hai; diff có warning LF/CRLF từ working tree có sẵn, exit code 0            |
| PostgreSQL / migration / trigger / FK / khóa thực | NOT RUN theo giới hạn; không có bằng chứng SQL PASS                                 |
| Browser E2E với backend/database thật             | NOT RUN; unit/SSR không thay thế E2E                                                |

Các lệnh: `pnpm.cmd exec vitest run --exclude '**/*.integration.spec.ts' --no-cache` ở backend, `pnpm.cmd exec vitest run --no-cache` ở frontend; `pnpm.cmd exec tsc --noEmit --incremental false` từng package; `pnpm.cmd exec eslint src --ext .ts` hoặc `.ts,.tsx`; Prisma validate với biến process riêng. Không chạy test harness có PostgreSQL. PowerShell chặn shim pnpm.ps1 nên dùng pnpm.cmd, không thay execution policy.

Warnings có sẵn: Vite CJS deprecation và useLayoutEffect trong test SSR; warning cleanup PDF được test chủ động. Không có bằng chứng gửi mail/SMTP thực.

Một phép chẩn đoán phụ dùng `-c core.autocrlf=false` báo CR cuối dòng là whitespace trên nhiều file working tree có sẵn; không sửa hàng loạt hoặc đổi cấu hình Git. Đã chạy lại đúng lệnh `git diff --check` theo cấu hình repository: exit code 0. Các file Gói G được kiểm tra trực tiếp bằng Prettier, kể cả file chưa tracked.

## 7. Điều kiện nghiệm thu và việc cần duyệt

Trước mở công bố: duyệt cùng lúc 5 nhóm ở mục 2, ưu tiên nhóm 1–3. Sau đó triển khai producer điểm GVHD/xác nhận tập thể và command phê duyệt policy, với source-of-truth/revision/authority thực; không thay UNKNOWN bằng OPEN/VERIFIED cố định. Nếu cần schema, lập migration bổ sung được review, không sửa migration F/E.

PostgreSQL cô lập cần một lượt riêng có xác minh target/owner; không dùng shared URL:

1. Replay migration trên DB test rỗng; kiểm FK ghép term/proposal/policy/source/revision, CHECK JSON và pointer, precision/timezone.
2. Kiểm INSERT version được; UPDATE/DELETE/TRUNCATE history grading/policy/result bị chặn. Không backfill history giả cho legacy.
3. Hai connection độc lập, đồng bộ chủ động cho cùng expectedRevision/context; chỉ một commit; rollback khi history/audit/notification/idempotency lỗi.
4. Race với TermParameter/policy, amendment UC19–21, UC17/PDF reupload cùng checksum nhưng revision mới, deadline sau chờ khóa; lock_timeout/transaction timeout/deadlock.
5. Evidence JSONB round-trip/canonical hash, missing/wrong-policy/wrong-source rows, hồ sơ khác đợt và grant thay đổi trước commit. Lịch sử công bố vẫn đúng dù current pointers đổi.
6. Quorum/grade provenance đầy đủ trên dữ liệu DB thật; nguồn GVHD/xác nhận tập thể phải là producer đã duyệt, không dùng fixture thành dữ liệu official.
7. Đo transaction time/N+1 khi verifier đọc policy, artifact, root và phiếu lịch sử; profile tập lớn, thêm batch/cache nội bộ transaction nếu cần. Chưa có số liệu hiệu năng/khóa thực.

Browser E2E cần backend + DB cá nhân được xác minh, migration/permission/grant/data qua quy trình riêng đã duyệt; bật hai flag/auth thật. Kiểm inbox→đúng PDF→draft→seal; reviewer/thành viên khác không xem được; SV không thấy trước công bố; Khoa đúng scope; 401/403/409/422/503 và binary JSON lỗi; amendment vẫn khóa; sau phê duyệt đủ nguồn mới kiểm seal-result→publish→SV đọc→Excel/PDF nội dung/font/lọc/PII. C01 vẫn 401 trước JWT/403 sau JWT.

**Chưa đủ điều kiện tuyên bố hoàn thiện Bước 10 hoặc công bố production.** Những phần kỹ thuật có căn cứ đã được triển khai; phần còn lại cần quyết định/producer chính thức và kiểm chứng PostgreSQL cô lập/browser E2E, không thể tháo chặn bằng suy đoán.
