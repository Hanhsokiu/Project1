# UC21 — xếp lịch bảo vệ đồ án tốt nghiệp

Bàn giao 2026-11-07 tại `E:\Project-Xaydungdoantotnghiep\DATN_Backup\Project1`, nhánh `feature/b9-b10-implementation`, HEAD `0093f81a6017a8e046a03a8ce9786189cd5b37d8`. Code và kiểm thử cô lập UC21 đã có; **PostgreSQL/Supabase/Render/browser end-to-end chưa nghiệm thu**. Không apply migration, bật ghi production, commit/push hoặc triển khai UC22–UC25.

## 1. Chức năng đã code

Khoa chọn đợt, xem nguồn hội đồng đã chốt, sinh viên, phòng thật trong policy/scope; chọn ngày/buổi/giờ; xem preview slot và thứ tự; đề xuất tự động nhiều hội đồng; áp dụng riêng thành draft; sửa ngày/buổi/phòng/sinh viên/thứ tự trước chốt; nhập lý do, xem history và chốt. Công bố là thao tác riêng sau chốt, không tự public. Có hủy draft explicit để giải phóng reservation, không xóa row/history. Search/filter/paging theo ngày/buổi/room/committee/student/state và personal published schedule theo quyền.

Đã đọc trực tiếp XML UC21/FR-35 của `docs/spec/Project_1_06.docx`, đối chiếu handoff/policy/source/schema/DDL các UC trước và baseline defense. Đặc tả có sáng/chiều, ABC Tên + Họ đệm, conflict, điều chỉnh/chốt/công bố; không xác nhận giờ/thời lượng/buffers/GVPB attendance cụ thể. Không đưa giá trị TEST_ONLY thành production defaults.

## 2. Files

| Nhóm | Files UC21 |
| --- | --- |
| Backend mới | `backend/src/defense/scheduling/schedule.controller.ts`, `schedule.service.ts`, `schedule.repository.ts`, `schedule.validator.ts`, `schedule-engine.ts`, `schedule-context.ts`, `schedule.spec.ts`, `schedule.http.spec.ts`, `schedule.repository.spec.ts` |
| Fixtures / compiled DI | `backend/test/schedule.fixture.ts`; `backend/scripts/check-scheduling-build.cjs` |
| Tích hợp backend | `backend/src/defense/defense.module.ts`; `backend/src/config/environment.ts` thêm flag false |
| Dependency UC20 | `backend/src/defense/reviewers/reviewer.service.ts`: chỉ thêm `workspaceInSession`, không đổi commands/assignment state |
| Legacy compatibility | `backend/src/defense/service/committee.service.ts`: baseline select + chỉ legacy sessions; `backend/src/defense/committees/committee.repository.spec.ts` cập nhật mock capability và giữ assertion privacy/scope |
| Prisma | `backend/prisma/schema.prisma`; `backend/prisma/review/defense-scheduling/migration.sql`, `README.md` |
| Shared | `shared/src/contracts/defense-scheduling.ts`, `defense-schedule-preview.ts`; export `shared/src/index.ts` |
| Frontend mới | `frontend/src/features/defense/scheduling/api.ts`, `components.tsx`, `page.tsx`, `api.spec.ts`, `components.spec.tsx`, `page.spec.tsx`, `schedule.fixture.ts` (chỉ tests) |
| Router/menu | `frontend/src/app/router/routes.tsx`, `route-manifest.ts`, `route-manifest.test.ts` |
| Handoff | Báo cáo này và mục UC21 ở `09-10-policy-approval-list.md` |

Không viết lại nghiệp vụ UC17–UC20. Mọi thay đổi chưa commit trước đó được giữ. Không đổi scoring/formula/storage hoặc dùng DemoDb làm source UC21 API.

## 3. Bảng được tái sử dụng và nguồn live chưa xác minh

DEFENSE_SESSION hiện có FK committee/room, scheduled_at UTC, duration_min, created_at; COMMITTEE_STUDENT có PK(session_id,proposal_id), order_index; ROOM có code/name/capacity/location. Tái sử dụng session và phòng. Nguồn khác: DEFENSE_COMMITTEE/COMMITTEE_MEMBER/DEFENSE_COMMITTEE_ASSIGNMENT, DEFENSE_ELIGIBILITY, conditional REVIEWER_ASSIGNMENT, TermStudent/Student/Proposal/TopicWorkflow, officialAssignmentPlanId/FINALIZED plan/current assignment/latest change, ThesisTerm/TermPhase/TermParameter, faculty grants, AuditLog và IdempotencyRecord.

Chưa kết nối Supabase để xác minh lại metadata/rows/constraints live. Source/schema/baseline không chứng minh DDL đã có thật; backend kiểm capability columns/validated CHECK/enabled triggers trước khi đọc trường mới. Thiếu schema trả blocker/legacy projection, không tạo data ngầm. Không đọc `.env` hoặc secrets để lấp khoảng trống live.

## 4. Migration và lý do không dual-write COMMITTEE_STUDENT

[Gói review](../../backend/prisma/review/defense-scheduling/README.md) ngoài active migration chain. SQL SHA-256: `3FB44EF9B3FC0A6B6D7767D34680EE80C10F64680724500F9513CBDCACEEBF78`.

Không thêm bảng; DEFENSE_SESSION thêm **14 cột**: revision default 0, state, local_date, session_type, timezone, ends_at, context, created_by, updated_by, updated_at, finalized_by, finalized_at, published_by, published_at. Legacy giữ 13 cột nullable null và revision 0; không backfill/adopt. Context có slots/order/UTC interval/student identities, automatic order/manual exception, committee/reviewer-derived source hash, approved policy/room facts và booking resource intervals, được audit/CAS bằng parent revision.

COMMITTEE_STUDENT giữ nguyên vì UC19 helpers đang coi các rows đó là legacy session claims cần đối soát. Ghi lịch mới vào đó sẽ làm chính nguồn UC19/UC20 mất hiệu lực sau save. UC21 slots gắn với active assignment UC19 và session context versioned; không tạo source phân sinh viên khác, room/session giả, marker bỏ qua provenance hoặc sửa helper cũ để né conflict. Projection relational vào bảng cũ nếu nhóm cần phải được review đồng bộ sau này.

Release order B1–B8→UC17→UC18→UC19→UC20→UC21; dependency DDL trực tiếp UC19. UC20 chỉ bắt buộc runtime khi policy cần GVPB tham dự, không tạo FK giả. SQL đề xuất CHECK/transitions/deferred conflicts/global mutex/RLS/ACL và permissions; không sửa 17 migrations nền hoặc apply lên Supabase chung.

## 5. API và frontend

Sau global API_PREFIX hiện hữu (thường `/api`):

| Method / route | Nội dung |
| --- | --- |
| GET `/defense-schedules/options` | Kỳ thuộc grant FACULTY hoặc có lịch personal đã công bố còn hiệu lực |
| GET `/defense-schedules/workspace?termId=...` | FACULTY scoped nguồn/phòng/phiên/policy/blockers; personal projection riêng |
| GET `/defense-schedules?termId=...` | date/period/committeeId/roomId/search/state/page/limit; scope trước paging |
| GET `/defense-schedules/:id?termId=...` | Detail trong scope/own relationship |
| GET `/defense-schedules/proposal?termId=...&committeeIds=...` | Đề xuất tự động, không lưu |
| POST `/defense-schedules/preview` | Preview thủ công readonly: sessionId nullable + body ScheduleSave; không audit/idempotency/write |
| POST `/defense-schedules` | Tạo draft |
| POST `/defense-schedules/:id/update` | Sửa draft |
| POST `/defense-schedules/assignments` | Atomic apply batch phiên mới/sửa theo quyền |
| POST `/defense-schedules/finalize` | Chốt nhóm phiên được chọn |
| POST `/defense-schedules/publish` | Công bố nhóm finalized chưa công bố sau mốc policy |
| POST `/defense-schedules/cancel` | Hủy nhóm draft explicit, giữ row/history |

Write commands cần Idempotency-Key/reason/rosterHash, expectedRevision và source/evidence binding. Zod strict không nhận slots/context/participants/actor từ browser. Preview POST là read computation, không phải command ghi nên không có Idempotency-Key. Lệnh update/create và transition có backend role/scope/source/conflict checks độc lập UI.

Frontend duy nhất trong API mode: **`/defense/schedule`**, WorkspaceLayout/sidebar/router permission, authenticated client và actor/term React Query. Trang scheduling demo cũ không được thêm thành route thứ hai hoặc source API. Có manual preview thật từ backend, auto proposal/apply riêng, controls từ approved policy, loading/empty/error/reload/saving/success/disabled reasons và 401/403/404/409. Không báo success trước POST commit; không nhận xét/chấm điểm/xuất biên bản.

Legacy GET `/committees/term/:termId` vẫn scoped theo UC19; query dùng baseline projection, loại session UC21 khi cột revision có sẵn. Nhờ đó tránh Prisma chọn cột chưa migration và không lộ lịch draft qua quyền đọc hội đồng. Consumer lịch mới phải dùng API/contract UC21.

## 6. Permissions và công bố

`defense-schedule:read/create/update/finalize/publish`. FACULTY cần quyền thuộc chính role FACULTY và term/department grants; roomAccess policy phải bao phủ department hội đồng và grant của actor. Không ADMIN academic bypass hoặc STUDENT/LECTURER tự tạo/chốt. Mixed batch cần create cho phiên mới và update cho phiên cũ; route assignments yêu cầu create, cập nhật đơn qua :id/update dùng update.

STUDENT/LECTURER có read của chính role, active profile và policy visibility tương ứng. Student chỉ nhận slot của mình. Lecturer nhận slots thuộc hội đồng mình tham gia hoặc slot mình là GVPB tham dự; advisor được xem các sinh viên mình hướng dẫn khi advisorCanView được duyệt. Các đường quyền/visibility không cộng chéo để lộ dữ liệu ở tài khoản nhiều role. Draft/unpublished/stale/legacy không hiện personal.

FINALIZED không tự công khai; publish permission riêng, sau publishNotBefore, lưu publishedBy/At, revision và audit. History/raw source/candidate lists không trả personal. Personal proof được kiểm lại nội bộ qua actor Khoa đã ghi/công bố, chỉ khi actor đó còn active/read/source permissions/grants; không cấp quyền Khoa cho SV/GV. Thu hồi quyền actor đó hiện fail closed; service-reader identity lâu dài cần duyệt. Công bố là quyền hiển thị, chưa gửi email/notification.

## 7. Nguồn UC18–UC20

Trong transaction UC21, tái sử dụng `CommitteeWorkflowService.workspaceInSession` và **`effectiveInSession`**, không mở nested read hoặc tạo source xác nhận riêng. UC19 reader kiểm UC18 ELIGIBLE/FINALIZED/QUALIFIED/current provenance, official advisor/latest effective handover, ownership/term và tất cả thành viên không là GVHD. Candidate phải có active assignment đúng proposal/student/revision/evidence/advisor hash; không đọc cột state/status riêng lẻ hoặc legacy claims làm bằng chứng.

NOT_REQUIRED không đọc UC20 làm điều kiện. REQUIRED dùng `ReviewerService.workspaceInSession/effectiveInSession`, checks CURRENT cho sinh viên được xếp và reserve đúng reviewer của slot. Thiếu reviewer ở sinh viên chưa chọn không tự chặn manual session của hồ sơ khác; đề xuất toàn bộ nguồn còn thiếu trả BLOCKED. Attendance PENDING_APPROVAL chặn ghi chính thức. Không sửa UC20 hoặc bắt GVPB có mặt vô căn cứ.

SourceHash bind effective committee, identities/names để order, và reviewers khi cần. Policy/room facts có hash riêng. Source/room/policy đổi giữa preview và commit trả 409; đổi sau chốt khiến STALE/downstream null và personal ẩn, giữ rows/history/reservations. Hash nguồn theo hội đồng tương đối rộng; thay đổi hồ sơ khác trong cùng nguồn có thể stale phiên một cách bảo thủ, không tự giữ trạng thái xanh khi chưa kiểm chứng.

## 8. Sắp theo Tên + Họ đệm tiếng Việt

`splitVietnameseName` chuẩn hóa NFC, trim/collapse whitespace, lấy token cuối làm Tên. Họ mặc định token đầu hoặc prefix họ kép dài nhất trong compoundFamilyNames được duyệt; phần giữa là Họ đệm. Một từ không tự tạo Họ/Họ đệm. Thứ tự: Tên → Họ đệm → Họ → mã SV → membership id ổn định.

`Intl.Collator('vi', sensitivity:'accent', numeric:true)` giữ dấu và Đ/đ, không strip accents/ASCII sorting. NFC/NFD tương đương, case không quyết định sắp tên. Không dùng order DB hoặc sắp toàn bộ hội đồng vào một hàng; mỗi phiên có automaticOrder riêng. Ngoại lệ manual phải được policy cho phép, permutation đủ/không trùng và có lý do; context/audit vẫn giữ automaticOrder gốc. Tên kép khác LAST_TOKEN rule cần Khoa xác nhận, không đoán tự động.

## 9. Ngày/buổi/phòng và engine

Local date/time là dữ liệu `Asia/Ho_Chi_Minh`; chuyển qua IANA Intl thành UTC để lưu DB/slots. UI format explicit giờ Việt Nam, không phụ thuộc timezone máy. Approved dates, morning/afternoon windows, duration, per-slot buffer, per-session buffer, breaks, capacity và start step đều explicit trong UC21_POLICY. Không dùng default duration_min 30 legacy để quyết định lịch mới.

Slot builder sắp tên trong subset hội đồng, xếp tuần tự, nhảy qua break, kiểm cả lượt + buffer không tràn buổi/ngày và intersect term/DEFENSE phase. Room.capacity phải đạt minRoomCapacity; số lượt/phiên theo maxStudentsPerSession, không tự suy số khán giả/ghế. Members và room giữ toàn phiên kể cả break; GVPB REQUIRED giữ slot riêng + buffers; student giữ slot + per-slot buffer.

Đề xuất deterministic bounded backtracking: giữ tất cả lịch hiện hữu như fixed, chỉ xếp sinh viên chưa có lịch; duyệt hội đồng ổn định, chia các chunk theo ABC/capacity, ưu tiên cửa sổ ít phiên đề xuất rồi ngày/buổi, room ID và start grid. Có backtracking về chunk/room/time để tìm phương án. FEASIBLE chỉ là một phương án hợp lệ; không claim tối ưu soft objective, di chuyển phòng hoặc cân bằng tải theo trọng số chưa duyệt. UNSAT chỉ khi không gian đã xét hết/bất khả thi; SEARCH_LIMIT khác UNSAT và không trả partial plans.

Giới hạn kỹ thuật: 200 sinh viên/đề xuất, 100 phiên/apply, 10.000 attempts mặc định, 90 approved dates, max 200 SV/phiên theo payload. Những giới hạn đó không là policy học vụ. Solver chạy **sau khi read transaction đã đóng**; DB read transaction không bị giữ chỉ để search. Worst-case search tổ hợp, giới hạn attempts chặn thời gian tính toán; global ledger scan/proof reads vẫn cần benchmark dữ liệu thật.

## 10. Chống xung đột mọi kỳ

Khoảng half-open [start,end), overlap khi startA < endB và startB < endA; chạm biên hợp lệ nếu không buffer. Check room/committee toàn phiên, mọi thành viên và reviewer attendance intervals, student identity xuyên kỳ và proposal unique mọi thời điểm. Không cho cùng hồ sơ có hai lượt ở ngày khác/phòng khác. Check cả batch sau loại các draft đang được thay và tất cả existing sessions mọi kỳ, không chỉ danh sách UI.

Stale/draft vẫn giữ reservations, chỉ cancel draft explicit mới giải phóng. Legacy thiếu end/provenance không tự suy lịch đúng từ duration_min/order; bảo thủ khóa tài nguyên chung room/committee/current members/known student owners cho tới đối soát. Không tiết lộ lịch/PII ngoài scope khi báo conflict; chỉ reason codes và rosterHash opaque. Global managed schedule mất audit/provenance là blocker, không coi khoảng lịch đó trống.

## 11. Revision/audit/idempotency/concurrency

Read dùng RepeatableRead. Write transaction lấy global advisory mutex (2117,21) **trước data reads**, sau đó term/committee/phase/proposal locks, reauthorize, source reload, expectedRevision/evidence/rosterHash và CAS. ReadCommitted dưới global mutex có chủ đích để transaction đã đợi nhìn thấy booking commit của kỳ khác; không giả định một snapshot Serializable/RepeatableRead cũ tự mới sau khi đợi khóa. SQL transition guard lấy cùng mutex cho DEFENSE_SESSION writers, deferred conflict guard kiểm cuối batch.

Save/transition + audit snapshot hash + idempotency atomic; failure rollback mọi phiên. Replay cùng key/body không viết thêm, vẫn kiểm principal/scope và IDs; body khác 409. Revisions tăng khi sửa/chốt/công bố/hủy; create draft revision 1. Finalized geometry/context và metadata chốt bất biến; chỉ explicit one-time publication được phép, không tự reschedule sau chốt. Cancel chỉ draft, giữ row/audit/automatic order.

Prisma P2002/P2034 trả 409; actual trigger exception mapping cần DB rehearsal. Synthetic queue/CAS tests không chứng minh advisory locks, ReadCommitted snapshots, legacy writers hoặc PostgreSQL races đã PASS. Các writer legacy ngoài DEFENSE_SESSION path cần cùng quy trình khóa/đối soát trước release.

## 12. Tests local

| Kiểm tra | Kết quả |
| --- | --- |
| UC21 backend | 46 tests: 35 service/domain/name/time/engine; 4 JWT/RBAC/Zod HTTP; 7 Prisma/legacy boundary |
| Backend full suite mặc định | 54 files / 582 tests PASS |
| UC21 frontend | 29 tests: 12 component, 8 page/cache SSR, 9 API; thêm 1 route/menu permission test |
| Frontend full suite | 47 files / 270 tests PASS |
| Shared build, Prisma validate/generate | PASS local; không migrate hoặc kết nối ghi database |
| Nest build + full TypeScript emit `--incremental false` / typecheck | PASS |
| Backend/frontend lint/typecheck | PASS |
| Vite production build | PASS; còn Vite CJS deprecation / chunk >500 kB |
| Native compiled UC17–UC21 DI/load | PASS với synthetic infrastructure, không AppModule/server/DB |
| git diff --check / whitespace files UC21 mới | PASS; Git có cảnh báo LF/CRLF normalization |

Tests gồm one/multiple students, name/middle/family/code ties, họ kép/whitespace/Đ/diacritics/NFC-NFD, morning/afternoon split, half-open buffers/break/overflow/capacity, current committee/advisor-member conflict/UC18 stale/conditional UC20, rooms/scope/legacy cross-term, deterministic/UNSAT/SEARCH_LIMIT, valid/invalid manual edits, draft cancel, source/room changes after preview, duplicate proposal, idempotency/revision/atomic batch/audit rollback, concurrent synthetic same-room/shared-member bookings, preview GET/POST readonly, publication separation/personal filtering/multi-role visibility and caller-session reuse.

HTTP harness mở loopback ephemeral, real controllers/JWT/RBAC/Zod/service, synthetic persistence/storage; đóng listener sau test. Component/page tests là SSR + React Query cache, không browser click E2E. Có useLayoutEffect SSR warnings khi không silent. Không test ghi lên Supabase chung hoặc import PrismaClient trong fixture.

## 13. Regression B1–B8, UC17–UC20

Full suite bao gồm auth/session/RBAC/audit/import/catalog/term/quota/phases/registration/assignment/handover/topic/reviews/versions/dossier/guidance/tasks/submissions/weekly/progress/final PDF/confirmation/score guard/eligibility/committees/reviewers. Không sửa công thức/rubric hay producer state. Tests so UC19/UC20 rows trước/sau scheduling; không tạo reviewer scores/minutes/results/export. Legacy query mock được bổ sung catalog read và assertion select thay include, giữ nguyên kiểm scope/privacy.

## 14. NOT VERIFIED end-to-end

Chưa kiểm schema/room/session/legacy rows live, thực thi migration/conditional references/deferred triggers/global locks/ReadCommitted wait snapshots/cross-term two SQL transactions/rollback/error mapping, runtime roles/RLS/ACL/grants/backup/restore/history. Không có actual approved production UC21 policy hoặc permission/account provisioning.

Chưa chạy Supabase–Render API/browser E2E hoặc benchmark global scan/mutex contention/upstream proof latency. Storage/PDF persistence/backup qua Render restart/redeploy vẫn kế thừa blocker UC17, không được giả định đã giải quyết. Native DI không start app/DB; mock concurrency không là PostgreSQL test.

## 15. Policy cần nhóm/Khoa duyệt

Xem [approval list UC21](09-10-policy-approval-list.md): dates/windows/durations/buffers/break/capacities/room scope, attendance, name compounds/manual exceptions, rights/separation/publication visibility/time, post-final changes/GV vắng/source stale, algorithm weights/cross-term/external calendars, legacy reconciliation, notification and service-reader identity. Không hỏi từng policy để dừng code; chưa đánh dấu bất kỳ production policy nào APPROVED.

## 16. Contract UC22/UC23/UC25

Shared **EffectiveDefenseSchedule** chứa termId/committeeId/committee revision+evidence, sessionId/roomId/date/MORNING|AFTERNOON/timezone, UTC header start/end, slots với TermStudent/proposal/student identity/order/start/end, revision/finalized actor/time/published actor/time/policy version/hash/evidenceHash và effectiveStatus CURRENT.

Chỉ FINALIZED còn hiệu lực có downstream; publication không phải điều kiện để consumer nghiệp vụ nội bộ đọc nhưng personal phải công bố. `ScheduleService.effectiveInSession` export qua DefenseModule, nhận caller ScheduleSession + expectedRevision/evidenceHash, re-evaluate current nguồn trong transaction, không nested read. Consumer tương lai phải kiểm own permission/role/student/reviewer/committee scope, window/locks và publication requirements của chức năng xuất chính thức; không dùng GET cũ hoặc raw state như chứng cứ vĩnh viễn. UC22 vẫn phải dùng EffectiveReviewerAssignment khi chấm; UC21 không cấp quyền reviewer bằng việc có mặt trong lịch.

## 17. Blockers kỹ thuật và workspace safety

UC21_WRITES_ENABLED false; chính thức còn BLOCKED bởi policy/room scope/permissions/schema phê duyệt, rehearsal database được cấp, source/storage readiness và DB/Render/browser/load verification. Legacy/source stale sau chốt, post-final reschedule/withdrawal, automatic notifications và UC25 export cần workflow được duyệt, không tự giả lập thành công. Giới hạn global mutex/proof scans và personal revalidation actor cần đánh giá trước vận hành lớn.

Giữ nguyên nhánh/HEAD và các thay đổi UC17–UC20; không reset/clean/stash/clone/worktree/project folder mới/commit/push. Không sửa `.env`, uploads, Word/docx/file khóa hoặc dữ liệu local; không prune metadata worktree cũ. Không migrate/db push/seed/reset/create account/test room/shared data, bật flags UC17–UC21 hoặc sửa Render/Supabase production. Kết thúc ở bàn giao UC21, không triển khai UC22–UC25.
