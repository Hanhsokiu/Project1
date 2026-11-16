# Đặc tả thiết kế — Premium Academic SaaS

Ngày: 15/11/2026. Nguồn: [audit](01-ui-audit.md), [inventory](02-route-inventory.md), [kế hoạch](03-redesign-plan.md), [tiêu chí nghiệm thu](04-acceptance-criteria.md). Đặc tả này là hướng thiết kế toàn hệ thống; **chỉ R39 — Đăng ký nguyện vọng được triển khai mẫu trong nhiệm vụ hiện tại**. Các màn/component còn lại là đặc tả, chưa được redesign.

## 1. Tính cách và nguyên tắc

Modern, minimal, trustworthy, professional. Bản sắc đại học đến từ tên khoa/trường, kỳ học, mã học vụ, đề tài và tài liệu có thứ bậc rõ. Dùng Be Vietnam Pro, navy cho cấu trúc, xanh trầm cho hành động, neutral cho nền. Không thêm logo, huy hiệu hay dấu xác thực giả.

Một màn trả lời được: tôi đang ở đợt nào; hồ sơ ở trạng thái nào; việc tiếp theo là gì; kết quả đã lưu hay mới đang nhập. Nội dung có giá trị hơn các thẻ thống kê trang trí. Không hero gradient, glass, biểu đồ không có nguồn, “AI insight”, icon màu rải rác, shadow nâng mọi card hoặc animation lặp.

- **F01:** trạng thái hoàn thành phải nói rõ phạm vi; không biến tiến độ hồ sơ thành tiến độ toàn đồ án.
- **F02/F09:** loading, không có dữ liệu và lỗi là ba trạng thái riêng; không thay API bằng mock để tạo giao diện đẹp.
- **F03/F05:** không sửa ý nghĩa nghiệp vụ để khớp màu badge; đối soát dữ liệu mâu thuẫn trước.
- **F08/F10/F11:** ưu tiên chữ đọc được, form có nhãn và đợt làm việc nhất quán; dùng kit hiện có.
- Nội dung kỹ thuật chỉ hiện khi giúp tra cứu: ID/hash/version nằm trong phần chi tiết; không xóa lịch sử. Hướng dẫn người dùng dùng ngôn ngữ học vụ thay mã use case.

## 2. Design tokens

Tên `--pa-*` là namespace thiết kế. Giai đoạn mẫu khai báo tại `.registration-pilot`, ánh xạ các biến kit có sẵn **trong cây màn này**. Chưa thay `:root`, Tailwind palette, Sidebar/Topbar hoặc stylesheet dùng chung. Khi mẫu được nghiệm thu mới chuẩn hóa alias vào design-system.css trong task riêng.

### 2.1 Màu

| Token | Giá trị | Vai trò |
|---|---|---|
| --pa-navy | #18344B | Heading, thông tin quan trọng, bản sắc học vụ |
| --pa-primary | #265D78 | CTA chính, link và trạng thái lựa chọn |
| --pa-primary-hover | #1D4960 | Hover CTA chính |
| --pa-primary-active | #173B4E | Pressed CTA chính |
| --pa-primary-soft | #EDF3F7 | Selected/hover nhẹ, không dùng làm nền mọi card |
| --pa-accent | #23675C | Điểm nhấn xanh trầm phụ; không thay màu success tùy tiện |
| --pa-canvas | #F5F7F8 | Nền workspace |
| --pa-surface | #FFFFFF | Form/card/table |
| --pa-subtle | #F0F3F5 | Metadata, control disabled, vùng bổ trợ |
| --pa-ink | #1D2C3B | Nội dung chính |
| --pa-muted | #526373 | Mô tả, nhãn phụ; vẫn phải đọc được |
| --pa-border | #D8E0E6 | Divider và biên card trang trí |
| --pa-control-border | #7B8D9B | Biên control cần nhận biết trên nền trắng |
| --pa-focus | #316D91 | Outline focus 2px, offset 3px |
| --pa-disabled-ink | #687683 | Chữ control disabled; không dùng opacity toàn vùng |
| --pa-success / --pa-success-bg | #206347 / #EEF6F1 | Thành công/đã duyệt, luôn kèm nhãn |
| --pa-warning / --pa-warning-bg | #805611 / #FFF7E8 | Cần chú ý, giới hạn thời gian |
| --pa-danger / --pa-danger-bg | #A2343B / #FBEFF0 | Lỗi hoặc thao tác nguy hiểm |
| --pa-info / --pa-info-bg | #25566F / #EDF3F7 | Thông tin trung tính, trạng thái đang xử lý |

Không dùng border trang trí làm biên nhận diện duy nhất của input. Text trên primary là trắng. Text trên status background dùng màu status tương ứng, không dùng màu sáng cho chữ nhỏ. Mục tiêu đo: text thường ≥4.5:1, text lớn ≥3:1, control/focus ≥3:1; kiểm trên nền thực tế, không chỉ từ token. Disabled vẫn có nhãn/lý do dù được miễn yêu cầu tương phản ở một số chuẩn.

### 2.2 Typography

Font stack: `"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", sans-serif`. Tái sử dụng bốn font local 400/500/600/700 trong index.css; không thêm CDN hoặc tải font mới.

| Vai trò / token | Cỡ / line-height | Weight | Quy tắc |
|---|---|---|---|
| Page title / --pa-text-title | 28px / 1.35; mobile 24px | 600 | Một H1, tối đa khoảng 2 dòng; không viết HOA |
| Section / --pa-text-section | 17px / 1.5 | 600 | H2/H3 đúng thứ bậc |
| Body / --pa-text-body | 14px / 1.65 | 400 | Nội dung, form, bảng |
| Input / --pa-text-input | 16px / 1.5 | 400 | Nhập liệu dễ đọc, tránh zoom tự động trên mobile |
| Label / --pa-text-label | 13px / 1.5 | 500 | Không thay label bằng placeholder |
| Metadata / --pa-text-meta | 12px / 1.6 | 400–500 | Ngày, mã; không nhỏ hơn 12px trong direction mới |
| Button / --pa-text-button | 14px / 1.45 | 500–600 | Nhãn động từ rõ, không toàn chữ HOA |

Đơn vị trên là kích thước tham chiếu tại zoom 100%; phải kiểm zoom 200%. Dùng tabular-nums cho ngày, số lượng và điểm; không áp dụng letter-spacing rộng cho văn bản tiếng Việt. Eyebrow 12px/600, tracking ≤.06em, chỉ dùng một lần ở đầu màn. Prose tối đa khoảng 70–75 ký tự/dòng, dữ liệu dài wrap thay vì cắt thông tin bắt buộc.

### 2.3 Spacing, radius và shadow

| Nhóm | Tokens / giá trị | Áp dụng |
|---|---|---|
| Spacing | --pa-space-1:4px; -2:8px; -3:12px; -4:16px; -5:20px; -6:24px; -8:32px; -10:40px; -12:48px | Không dùng gap tùy ý giữa các màn |
| Mật độ | Control 44px; table compact control 36–40px; target mobile 44×44px | Icon nhỏ nằm trong target đủ lớn |
| Trang | Padding desktop 24–32px, mobile 16px; content max 1280px | Form chính + rail 280–304px, gap24px |
| Radius | --pa-radius-control:8px; --pa-radius-card:12px; --pa-radius-dialog:16px; --pa-radius-badge:6px | Pill chỉ dùng avatar/count ngắn, không biến mọi button thành pill |
| Shadow | --pa-shadow-none:none; --pa-shadow-sm:0 1px 2px rgba(24,52,75,.04) | Card mặc định border; không nâng card không clickable khi hover |
| Overlay | --pa-shadow-overlay:0 16px 48px rgba(24,52,75,.16) | Chỉ menu/modal nổi; backdrop navy 32%, không blur |
| Focus | Outline2px solid --pa-focus, offset3px | Không dùng shadow mờ làm focus duy nhất |

### 2.4 Motion

| Token | Giá trị | Dùng cho |
|---|---|---|
| --pa-motion-fast | 120ms | Màu/biên hover, pressed |
| --pa-motion-base | 180ms | Feedback/fade nội dung cục bộ |
| --pa-motion-overlay | 220ms | Menu/modal khi thực sự cần định hướng |
| --pa-ease | cubic-bezier(.2,.8,.2,1) | Easing chung |

Không `transition: all`, parallax, card nhảy, shimmer dài hoặc pulse trang trí. Chỉ chuyển color/background/border/opacity ở control. Reorder nguyện vọng giữ vị trí focus và nhãn; không bắt buộc animate để thể hiện thứ tự. Loading có text và aria-busy, spinner chỉ là bổ trợ. Với prefers-reduced-motion: reduce, bỏ transform/animation không thiết yếu, transition gần 0, scroll-behavior:auto; không bỏ feedback bằng chữ.

## 3. Đặc tả component

Tái sử dụng WorkspaceLayout, PageHeader, Card, Button, Field, DataTable, Badge, Modal/Confirm, Notice và Sonner. Không dựng một bộ kit song song.

| Component | Bố cục / style | Hành vi và accessibility |
|---|---|---|
| Sidebar | Rộng248–260px, collapsed72px; nền trắng/neutral, logo trường hiện có, nhãn nhóm12px, item40–44px, icon18px; active nền xanh nhạt + vạch/weight | Nhãn route đúng vai trò, aria-current; không thay permission/menuRoles. Mobile drawer giữ focus, Escape đóng, trả focus trigger; không tab vào drawer đóng |
| Topbar | Cao64px, nền đặc trắng, border dưới; breadcrumb trái; selector đợt và profile phải; selector rộng200–320px ở desktop | Tên đợt đầy đủ trong option; không thêm selector giả. Mobile giữ chọn đợt và menu, breadcrumb rút gọn; label vẫn có tên màn. Không di chuyển focus khi refetch |
| Card | Nền trắng, border1px, radius12px; padding24px/mobile16px; heading17px; không hover lift mặc định | H2 mô tả nội dung; không bọc card bằng button nếu bên trong có nhiều control; vùng đọc khác vùng tương tác |
| Button | Primary xanh trầm/trắng; secondary trắng/biên control; ghost chữ xanh/navy; danger chỉ dùng khi cần. Cao44px, icon16–18px, gap8px | Một primary cho một nhóm việc. Loading giữ kích thước/nhãn, aria-busy và chống gửi lặp theo logic hiện có. Link điều hướng dùng Link; action dùng button |
| Form | Label trên control, gap8px; field gap16–24px; input/select cao44px; textarea min112px. Đoạn form đánh số là section, không giả wizard | Giữ schema và callback. Required có dấu và giải thích; helper/error có id/aria-describedby, aria-invalid khi lỗi. Không thay validation bằng disabled tùy tiện. Native select cho danh sách hiện có |
| Data Table | Header40–44px/body tối thiểu48–52px; 14px text, metadata12px; divider nhẹ; số căn phải, tên/trạng thái căn trái. Toolbar search/filter và count ngoài bảng | Semantic th/aria-sort; actions có tên theo hàng, pagination tách rõ. Selected nền nhạt + checkbox; filter đang dùng và clear rõ. Không đổi scope/query/page-size nghiệp vụ chỉ để vừa layout |
| Badge | Chữ12px/500, radius6px, padding4×8px; neutral/info/success/warning/danger | Mapping từ enum chuẩn; text không chỉ màu. Đã nộp khác đã duyệt; quá hạn nhiệm vụ khác nộp muộn. Loading/error của request không dùng thay status hồ sơ |
| Modal / Confirm | Max560px (form rộng720–800px khi cần), margin16px mobile, max-height calc(100dvh - 32px); heading/body/footer rõ, radius16px | role dialog, aria-modal/name; trap focus, Escape/Cancel, restore focus. Action pending theo logic hiện tại. Không bấm xác nhận tự động; giữ toàn bộ điều kiện ghi |
| Toast | Sonner hiện có; text14px, tối đa khoảng360px; icon + thông điệp ngắn; không phủ nút chính trên mobile | Success chỉ sau API thành công. Lỗi quan trọng ở lại inline; toast không là nơi duy nhất chứa lỗi. Không thêm toast lặp cho mỗi render/refetch |

### Ma trận trạng thái

| Trạng thái | Quy tắc dùng chung | Chi tiết |
|---|---|---|
| Rest | Nền/biên/text theo token | Phân biệt control tương tác với thông tin tĩnh |
| Hover | Đổi nền/biên trong120ms | Không đổi kích thước, không dịch thẻ/nút, không là cách duy nhất lộ action |
| Focus-visible | Outline2px + offset3px | Hiện trên link, button, input, select, textarea; không bị clipping/overlay che |
| Active/pressed | Primary-active hoặc nền selected | Không dùng pressed style thay trạng thái đã lưu |
| Disabled | Nền subtle, chữ disabled, cursor not-allowed; opacity1 | Lý do đọc được cạnh nhóm; không disable toàn văn bản chứa hướng dẫn |
| Loading | Giữ label/chiều cao, aria-busy; status vùng tải | Không hiển thị empty khi chưa có response; retry chỉ gọi hành động đã định nghĩa |
| Success | Nhãn/icon success và nội dung cụ thể | Giữ snapshot đã lưu tách khỏi lựa chọn chưa lưu; không tự xoá dữ liệu nhập |
| Error | Border danger cho trường lỗi, inline alert khi cần | Lỗi schema/form giữ nguyên; error summary/focus phù hợp; không chỉ tô đỏ |
| Empty | Nêu không có dữ liệu hay filter không khớp | CTA chỉ khi người dùng có quyền; không dùng empty che lỗi hoặc403 |

## 4. Responsive và accessibility

- Desktop ≥1200px: nội dung form + rail; tablet768–1199px: một cột nếu shell khiến form hẹp, rail xuống dưới; mobile <768px: một cột, control44px, input16px, padding16px.
- Kiểm tại1440×900,768×1024,390×844 và320px, sau font/data ổn định. Root không cuộn ngang; wrap term/title/email/filename. Bảng so sánh rộng cuộn trong region có nhãn; card mobile phải giữ dữ liệu/hành động.
- Tránh sticky action bar ở mẫu đầu: không che field/focus/keyboard ảo. Action nằm ở cuối section; ở320px wrap/stack có chủ đích, giữ thứ tự Tab khớp vị trí.
- Tab/Shift+Tab/Enter/Space/Escape; skip link, heading một H1, visible focus, names cho icon. Không thêm role lên section khi semantic HTML đã đủ.
- Đọc label/hint/lỗi bằng screen reader; status polite, error alert, không phát live announcement mỗi giây cho timer server.
- Tương phản và focus theo token mục2; axe không thay kiểm thủ công. Kiểm zoom200%, text dài, forced-colors và reduced-motion. Không tuyên bố đạt mọi tiêu chí nếu chưa chạy.
- Đợt, quyền truy cập, capability, deadline, revision và trạng thái khóa là dữ liệu nghiệp vụ, không thay bằng quy tắc viewport.

## 5. Bốn màn đại diện

Theo yêu cầu bao phủ Login, Dashboard, Form và Data Table/Workflow, chọn:

| Màn | Vì sao phù hợp | Hướng mẫu / giới hạn |
|---|---|---|
| R25 /login | Bản sắc trường và trải nghiệm vào hệ thống; audit F14 | Layout học thuật gọn, nhận diện trường hiện có, form rõ và hỗ trợ đúng môi trường. Bổ sung vào nhóm đại diện ở mức đặc tả; **chưa sửa** |
| R26 / | Ba vai trò, hierarchy và hành động tiếp theo; F01/F10 | Tác vụ ưu tiên và mốc thật; cần đối soát dữ liệu trước thay CTA. **Chưa sửa** |
| **R39 /registration** | Form có hạn, trạng thái đã nộp, NV có thứ tự; audit đã có API baseline | **Triển khai duy nhất lần này.** Kế hoạch03 mục2a đã xác định màn; giữ save/submit/validation, danh sách thật |
| R34 /terms | Data Table, filter, modal và lifecycle Khoa | Bảng gọn + trạng thái + dialog; audit mobile bị chặn nên cần bổ sung baseline trước task riêng. **Chưa sửa** |

R03 chi tiết nhận xét vẫn là ứng viên workflow của kế hoạch03, phù hợp đợt tiếp theo sau đánh giá mẫu. Không mở rộng sang R03 trong nhiệm vụ này.

## 6. Mẫu R39 — phạm vi triển khai và bố cục

```text
Tiêu đề + mô tả ngắn                         Trạng thái đã lưu
Đợt đăng ký / hệ đào tạo                      Thời gian đăng ký
Thông tin mở cổng hoặc lý do không thể ghi

01. Thông tin liên hệ                        Đăng ký đã lưu
    Sinh viên; Email; SĐT                       Hướng / ngày / thứ tự
02. Hướng đồ án                              Nguyên tắc đăng ký
    Chọn hướng + lưu ý khi đổi hướng
03. Thứ tự nguyện vọng
    NV1 / NV2 / ... + Nâng / Hạ / Xóa
    Thêm GV phù hợp + ghi chú
    Giải thích lưu/nộp          Lưu nháp | Nộp đăng ký
```

- Dùng Card/Person/Field/Button/Badge/Notice/Confirm hiện có; thay bố cục và style trong root `.registration-pilot`, đặt tên class theo feature.
- Snapshot “Đăng ký đã lưu” đưa trước nguyên tắc trong rail, ghi rõ dữ liệu đã lưu khác input đang sửa. Không suy “đã lưu” từ giá trị local.
- Date vẫn dùng formatter và trường thời gian hiện tại; lý do khóa/pending/error vẫn từ context/server. Không thay server timer, polling, payload hoặc danh sách eligible.
- Giữ contact, direction reset prefs, lọc GV theo đợt/hướng/active, không trùng, giới hạn Math.min(3,max_preferences), thứ tự NV, ghi chú, save(false), Confirm→save(true), retry và legacy warning.
- Thêm tên nhóm/hint/fieldset cần thiết ở JSX; không sửa Field/Modal dùng chung để tránh lan phạm vi.
- Style modal nằm dưới root màn hiện tại (Modal kit hiện không portal); Sonner và shell giữ nguyên. Không dùng body/:root override, CSS route khác hoặc cài dependency.
- Không khẳng định đã giải quyết F02 (global snapshot), toàn bộ F08 (kit lỗi), hay lỗi nghiệp vụ khác ngoài phạm vi trình bày.

## 7. Cách đánh giá mẫu trước khi nhân rộng

1. Chụp **before** mới từ màn đang chạy, cùng tài khoản/đợt thật,1440×900 và390×844; lưu thời điểm/route/state. Giữ audit baseline cũ nguyên vẹn.
2. Hoàn tất đặc tả này rồi sửa riêng StudentRegistrationPage.tsx và stylesheet scoped của nó. Mọi thay đổi khác chỉ ở docs/evidence của mẫu.
3. Chụp **after** cùng viewport/dữ liệu; kiểm320/768, dialog Confirm, readonly ở đợt đã đóng, keyboard, font local, reduced-motion, axe và console/HTTP.
4. Kiểm thao tác cục bộ thêm/bỏ/đổi thứ tự NV, đổi hướng reset NV; Cancel không ghi. Không nộp/lưu mẫu thật để tạo screenshot. API error chỉ báo theo thực tế, không fake response.
5. Chạy type-check, lint, tests và build theo package/AGENTS; so diff và các phần tính nghiệp vụ trước/sau. Ghi thất bại môi trường và ca chưa kiểm chứng, không dùng fixture để tuyên bố API đạt.
6. Bàn giao ảnh cùng báo cáo trong [evidence/pilot-registration](evidence/pilot-registration/README.md). Đánh giá hierarchy, màu, độ đọc, tương phản, responsive và hành vi trước khi cho phép áp dụng sang màn khác.

**Cổng nghiệm thu mẫu:** style đạt hướng navy/xanh trầm/neutral; không mất control/thông tin; logic/contract/quyền giữ nguyên; có before/after thật; kiểm tra kỹ thuật ghi rõ kết quả; mọi điểm chặn được nêu. Đặc tả toàn hệ thống không đồng nghĩa các màn đã triển khai hoặc đạt accessibility toàn diện.
