# Triển khai dự án lên Vercel, Render và Supabase

Hướng dẫn dành cho repository hiện tại, nhánh `fix/integration-ui`. Các tên `gpms-api` và `gpms-web` bên dưới chỉ là ví dụ; luôn thay bằng địa chỉ thực tế do nền tảng cấp. Tài liệu không chứa mật khẩu hoặc chuỗi kết nối thật. Chưa có dịch vụ nào được tạo hoặc triển khai bởi việc viết tài liệu này.

1. **Hiểu cách ba phần kết nối với nhau**

   | Thành phần | Nơi triển khai | Nhiệm vụ |
   | --- | --- | --- |
   | `frontend` | Vercel | Giao diện React/Vite |
   | `backend` và `shared` | Render | API NestJS, xác thực, phân quyền, xử lý PDF và thông báo |
   | PostgreSQL | Supabase | Một database chung cho các phân hệ và tài khoản |
   | Tệp tải lên | Persistent Disk của Render | PDF, ZIP và tệp đính kèm mà backend đang lưu trên filesystem |

   Luồng truy cập: trình duyệt → Vercel → API Render → database Supabase. Tệp đính kèm được lấy qua API có phân quyền. Frontend không kết nối trực tiếp PostgreSQL; ứng dụng hiện dùng xác thực JWT của backend, không dùng Supabase Auth.

   Có thể triển khai khi dự án còn phát triển để làm môi trường kiểm thử trực tuyến. Nếu dùng lại database đang cấu hình trong `backend/.env`, các thao tác ghi từ máy cá nhân và bản host đều tác động tới cùng dữ liệu. Khi vận hành thật, nên tách database phát triển và database vận hành; các phân hệ trong từng môi trường vẫn dùng chung một database.

   Với code hiện tại, phương án giữ đầy đủ chức năng là Render trả phí có Persistent Disk. Render Free ngủ sau 15 phút không có lưu lượng vào, không hỗ trợ Persistent Disk; filesystem thông thường mất thay đổi khi restart/redeploy. Chỉ tạo bucket Supabase Storage chưa đủ: ứng dụng chưa có adapter lưu tệp vào bucket đó. Xem [Render Free](https://render.com/docs/free) và [Persistent Disks](https://render.com/docs/disks).

2. **Chuẩn bị code ở máy cá nhân**

   Mở Terminal PowerShell trong VS Code:

   ```powershell
   Set-Location D:\Project1\BTL
   git branch --show-current
   git status --short
   ```

   Nhánh cần triển khai là `fix/integration-ui`. Không checkout hoặc pull đè khi còn thay đổi chưa lưu. Host chỉ lấy commit trên GitHub; code chưa commit trên máy sẽ không xuất hiện trên host.

   Tạo file `frontend/vercel.json`, nội dung:

   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

   File này giúp refresh hoặc mở trực tiếp một đường dẫn của React Router không bị 404. Đây là cấu hình SPA trong [tài liệu Vite trên Vercel](https://vercel.com/docs/frameworks/frontend/vite).

   Thêm các dòng sau vào `.dockerignore` ở gốc repository:

   ```gitignore
   **/.cache
   **/.tmp
   **/playwright-report
   **/test-results*
   **/.agents
   **/.codex
   **/.aws
   **/.ssh
   ```

   Giữ các dòng loại trừ `.env`, `node_modules`, `dist` và `uploads` sẵn có. `.cache` chứa thông tin truy cập bộ dữ liệu mẫu, không được đưa vào Docker image. Không bỏ loại trừ `uploads` để chuyển tài liệu; việc chuyển tệp thực hiện riêng ở bước 7.

   Backend có sẵn `backend/Dockerfile`, dùng `node:22-bookworm-slim` và cài OpenSSL/Chromium cho Prisma và chức năng xuất PDF. Giữ image Debian Bookworm này: Prisma 5.22 có lỗi nhận diện OpenSSL trên Alpine mới, có thể chọn nhầm engine yêu cầu `libssl.so.1.1`. Các dòng đầu Dockerfile là:

   ```dockerfile
   FROM node:22-bookworm-slim
   RUN apt-get update \
       && apt-get install -y --no-install-recommends ca-certificates openssl chromium fonts-noto \
       && rm -rf /var/lib/apt/lists/*
   ```

   Giữ nguyên các dòng còn lại, bao gồm `WORKDIR /workspace/backend`, bước `prisma generate`, kiểm tra `check-prisma-engine.cjs` và `CMD`. Đường dẫn Chromium của image này là `/usr/bin/chromium`, đã đặt trong `PDF_CHROME_PATH`. Render sẽ build Docker image; không cần Docker trên máy cá nhân để triển khai từ GitHub. Cấu hình Docker này vẫn cần được xác nhận bằng build log và kiểm tra PDF sau lần triển khai đầu.

   Chạy kiểm tra build, từng lệnh một; chỉ chuyển tiếp khi lệnh trước thành công:

   ```powershell
   pnpm --filter @doan/backend build
   pnpm --filter @doan/frontend build
   ```

   Mở Source Control trong VS Code, xem từng thay đổi rồi stage các file code/cấu hình/tài liệu muốn đưa lên. Không stage `.env`, `.cache`, mật khẩu hoặc tệp nộp của người dùng. Kiểm tra các file sắp commit:

   ```powershell
   git diff --cached --name-only
   ```

   Sau khi xem xong, tự thực hiện:

   ```powershell
   git commit -m "Prepare application for hosted testing"
   git push origin fix/integration-ui
   ```

   Nếu Git báo nhánh remote đã có commit mới, dừng và xử lý đồng bộ/conflict; không dùng force push để bỏ qua. Mở GitHub và chọn nhánh `fix/integration-ui`, kiểm tra commit và các file vừa chuẩn bị đã xuất hiện.

3. **Chuẩn bị Supabase đang chứa dữ liệu**

   Đăng nhập Supabase Dashboard, mở đúng project đang dùng trong `backend/.env`. Với database hiện tại đã chứa dữ liệu mẫu, không cần tạo project mới, import lại dữ liệu hoặc chạy seed để deploy.

   Mở Table Editor, kiểm tra có các bảng nghiệp vụ và dữ liệu. Bấm Connect → lấy URI PostgreSQL ở chế độ Session pooler, cổng `5432`. Sao chép đúng host, username và project ref từ Dashboard; không tự đoán từ ví dụ. Session pooler phù hợp backend chạy liên tục và dùng được với IPv4; direct connection có thể cần IPv6. Xem [Supabase với Prisma](https://supabase.com/docs/guides/database/prisma).

   Chuỗi có dạng minh họa:

   ```text
   postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require&connection_limit=3
   ```

   Thay password của database, không phải mật khẩu tài khoản đăng nhập ứng dụng hoặc mật khẩu Supabase Dashboard. Nếu password có ký tự đặc biệt, phần password trong URI phải được URL encode. Giữ chuỗi đang hoạt động trong `backend/.env` là cách ít nhầm nhất. Nếu URL đã có dấu `?`, các tham số tiếp theo nối bằng `&`.

   Chuẩn bị giá trị `DATABASE_URL` và `DIRECT_URL` cho Render. Với phương án Session pooler này, có thể dùng cùng URI cổng 5432 cho cả hai; tên `DIRECT_URL` trong code không bắt buộc phải dùng hostname direct IPv6. Không dùng Transaction pooler cổng 6543 cho hướng dẫn này.

   Có thể kiểm tra lịch sử migration hiện tại ở máy cá nhân, với `backend/.env` đúng project:

   ```powershell
   pnpm --filter @doan/backend db:status
   ```

   Nếu báo có migration chưa áp dụng, migration lỗi hoặc lịch sử lệch, cần xử lý trước khi dùng bản host. Không chạy `prisma migrate reset`, `prisma db push` hoặc seed tùy tiện trên database đang có dữ liệu. Repository có công cụ bảo vệ `db:inspect`/`db:deploy`; việc thay đổi schema cần kiểm tra đích, backup và nội dung migration riêng. Không đặt lệnh seed hoặc tạo dữ liệu mẫu trong Build/Start Command.

   Nếu muốn tạo Supabase project hoàn toàn mới, cần kế hoạch riêng để chuyển schema, dữ liệu tài khoản/quyền và tệp đính kèm. Chỉ đổi connection string sang database trống sẽ không giữ được dữ liệu hiện tại.

4. **Tạo backend trên Render**

   Đăng nhập Render bằng GitHub. Chọn New → Web Service → kết nối repository. Nếu repository riêng tư không hiện ra, cấp quyền GitHub cho đúng repository trong phần cài đặt kết nối. Chọn các giá trị:

   | Trường | Giá trị |
   | --- | --- |
   | Name | Tên duy nhất, ví dụ `gpms-api` |
   | Branch | `fix/integration-ui` |
   | Region | Ưu tiên gần vùng Supabase |
   | Language/Runtime | Docker |
   | Root Directory | Để trống, dùng gốc repository |
   | Dockerfile Path | `backend/Dockerfile` |
   | Docker Build Context Directory | `.` nếu có trường này |
   | Docker Command | Để trống, dùng CMD của Dockerfile |
   | Health Check Path | `/api/health` |
   | Instance | Gói trả phí hỗ trợ Persistent Disk cho phương án đầy đủ |

   Không đặt Root Directory thành `backend`, vì Docker cần cả workspace và thư mục `shared`. Khi chọn Docker sẽ không nhập Build/Start Command kiểu Node; Render sử dụng Dockerfile. Xem [Docker trên Render](https://render.com/docs/docker).

   Mở Advanced/Disks khi tạo service, hoặc trang Disks sau khi tạo. Thêm disk với Mount Path `/var/data`; chọn dung lượng phù hợp, chẳng hạn 1 GB cho bộ mẫu nhỏ. Dung lượng có tính phí; kiểm tra dự toán trên Dashboard trước khi tạo. Backend sẽ ghi tệp vào `/var/data/uploads`.

   Trong Environment, nhập các biến dưới đây. Khi nhập từng ô Key/Value không thêm dấu ngoặc kép bao quanh giá trị:

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | URI Supabase thực tế từ bước 3 |
   | `DIRECT_URL` | URI cổng 5432 từ bước 3 |
   | `DB_INSPECT_HOST` | Chỉ hostname trong `DIRECT_URL`, không có giao thức/cổng |
   | `JWT_SECRET` | Một chuỗi ngẫu nhiên riêng |
   | `JWT_REFRESH_SECRET` | Một chuỗi ngẫu nhiên khác |
   | `JWT_EXPIRES_IN` | `8h` |
   | `JWT_REFRESH_EXPIRES_IN` | `7d` |
   | `NODE_ENV` | `production` |
   | `API_PREFIX` | `api` |
   | `FRONTEND_URL` | Tạm thời `http://localhost:5173`; sửa ở bước 6 |
   | `STORAGE_LOCAL_PATH` | `/var/data/uploads` |
   | `STORAGE_MAX_SIZE_MB` | `50` |
   | `GUIDANCE_UPLOAD_ENABLED` | `true` |
   | `GUIDANCE_REMINDERS_ENABLED` | `true` |
   | `EMAIL_WORKER_ENABLED` | `false` |

   Render cấp `PORT`; giữ giá trị do Render cấp, backend đã đọc biến này. `PDF_CHROME_PATH` đã nằm trong Dockerfile, không đặt đường dẫn Chrome của Windows lên Render. Chưa có SMTP thật thì giữ email worker tắt; thông báo trong ứng dụng vẫn là chức năng riêng. Khi cần email thật mới cấu hình `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` theo nhà cung cấp và bật lại worker.

   Tạo mỗi JWT secret bằng một lần chạy lệnh này ở máy cá nhân, rồi lưu riêng tư:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Không dùng lại ví dụ `REPLACE_...`. Không đặt connection string, JWT secret hay Supabase service role key trên frontend.

   Bấm Create/Deploy Web Service. Theo dõi Logs/Events tới khi Live. Sao chép URL thực tế Render cấp, ví dụ `https://gpms-api.onrender.com`. Mở `https://gpms-api.onrender.com/api/health`; kết quả cần có trạng thái `ok`. Health chỉ kiểm tra ứng dụng trả lời, chưa thay thế kiểm tra đăng nhập/database. `/api/docs` không được mở trong production theo code hiện tại.

5. **Tạo frontend trên Vercel**

   Đăng nhập Vercel bằng GitHub. Chọn Add New → Project → Import repository hiện tại. Có thể import URL nhánh GitHub dạng `https://github.com/OWNER/REPO/tree/fix/integration-ui`. Chọn:

   | Trường | Giá trị |
   | --- | --- |
   | Project Name | Tên duy nhất, ví dụ `gpms-web` |
   | Framework Preset | Vite |
   | Root Directory | `frontend` |
   | Node.js Version | `22.x` |
   | Install Command | `corepack pnpm install --frozen-lockfile` |
   | Build Command | `corepack pnpm --filter @doan/shared build && corepack pnpm --filter @doan/frontend build` |
   | Output Directory | `dist` |

   Bật Include source files outside of the Root Directory in the Build Step trong cấu hình Root Directory để build đọc được `shared` và workspace gốc. Xem [Vercel monorepo](https://vercel.com/docs/monorepos/monorepo-faq). Output Directory là `dist` vì Root Directory đã là `frontend`.

   `package.json` ở gốc ghim `packageManager` thành `pnpm@9.15.9`. `frontend/vercel.json` đã chứa các lệnh install/build và thư mục output tương ứng; cần commit và push cả hai file. Nếu Dashboard có Install Command cũ, đổi sang lệnh Corepack trong bảng. Không dùng Override chỉ ghi `pnpm install --frozen-lockfile`: Vercel có thể chọn pnpm 6 và báo `ERR_PNPM_UNSUPPORTED_ENGINE`. Xem [Vercel Package Managers](https://vercel.com/docs/package-managers).

   Thêm Environment Variables cho Production, với giá trị Render thật:

   ```dotenv
   ENABLE_EXPERIMENTAL_COREPACK=1
   VITE_API_URL=https://gpms-api.onrender.com/api
   VITE_AUTH_API=true
   VITE_TERM_API=true
   VITE_CATALOG_API=true
   VITE_IMPORT_API=true
   VITE_REGISTRATION_API=true
   VITE_DEMO_MODE=false
   ```

   `VITE_API_URL` phải có `/api`, dùng HTTPS và không trỏ localhost. Dùng kết nối trực tiếp tới API Render; không cần rewrite API qua Vercel trong phương án này. Không thêm `DATABASE_URL`, JWT secret hoặc mật khẩu vào bất kỳ biến `VITE_*` nào. Không cần thêm biến Supabase Auth cho kiến trúc hiện tại.

   Trong Settings → Environments → Production → Branch Tracking, đặt `fix/integration-ui` và Save. Chỉ dùng bản Production từ đúng nhánh này để kiểm tra theo hướng dẫn. Xem [cấu hình nhánh Production](https://vercel.com/docs/git). Nếu lần import đầu đã build nhánh khác, cấu hình lại trước rồi tạo deployment từ nhánh đúng; kiểm tra tên nhánh và commit trong Deployment Details.

   Deploy và chờ Ready. Sao chép domain chính của project, ví dụ `https://gpms-web.vercel.app`, từ Settings → Domains. Domain chính ổn định thuận tiện hơn URL riêng của mỗi lần deploy.

6. **Cho phép giao diện gọi backend**

   Quay lại Render → service backend → Environment. Sửa:

   ```dotenv
   FRONTEND_URL=https://gpms-web.vercel.app
   ```

   Thay đúng domain chính Vercel của bạn. Không thêm `/api`, đường dẫn trang hay dấu `/` cuối. Nếu vẫn muốn frontend local gọi backend host, dùng danh sách ngăn bởi dấu phẩy:

   ```dotenv
   FRONTEND_URL=https://gpms-web.vercel.app,http://localhost:5173,http://127.0.0.1:5173
   ```

   Save và triển khai lại Render. Mỗi domain Preview hoặc domain riêng khác cần được cho phép cụ thể nếu dùng nó; cấu hình hiện tại không tự hiểu wildcard `*.vercel.app`.

   Nếu sửa `VITE_API_URL` hoặc biến frontend khác trên Vercel, phải Redeploy frontend để build sử dụng giá trị mới. Chỉ lưu biến không cập nhật bản đã build. Xem [biến môi trường Vercel](https://vercel.com/docs/environment-variables).

7. **Chuyển tệp PDF/ZIP hiện có lên Render**

   Bước này khác với chuyển database. Database đã ở Supabase nhưng thư mục `backend/uploads` còn ở máy cá nhân. GitHub và Render không tự lấy các file bị gitignore; nếu chưa chuyển, có thể thấy dòng dữ liệu nhưng tải tệp báo không tồn tại.

   Thực hiện trong lúc chưa có người dùng sửa/nộp tệp trên host. Sao lưu thư mục uploads trước. Với service trả phí có disk, vào Render → Account Settings → SSH Public Keys. Nếu chưa có key riêng cho Render, tạo một key ở máy cá nhân; không ghi đè key có sẵn:

   ```powershell
   ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\id_ed25519_render" -C "render-gpms"
   Get-Content "$env:USERPROFILE\.ssh\id_ed25519_render.pub"
   ```

   Copy toàn bộ public key `.pub` vào Add SSH Public Key. Private key không có đuôi `.pub` phải giữ trên máy. Sau đó mở service → Connect → SSH, lấy thông tin `YOUR_SERVICE@ssh.YOUR_REGION.render.com` thực tế. Xem [SSH trên Render](https://render.com/docs/ssh).

   Đóng gói toàn bộ thư mục uploads ở máy cá nhân; archive nằm trong `.cache` đang được gitignore:

   ```powershell
   Set-Location D:\Project1\BTL
   New-Item -ItemType Directory -Force .cache | Out-Null
   tar -czf .cache/uploads-host-transfer.tar.gz -C backend uploads
   ```

   Upload, thay địa chỉ SSH bằng giá trị lấy từ Connect:

   ```powershell
   scp -i "$env:USERPROFILE\.ssh\id_ed25519_render" .cache/uploads-host-transfer.tar.gz YOUR_SERVICE@ssh.YOUR_REGION.render.com:/var/data/uploads-host-transfer.tar.gz
   ```

   Dùng OpenSSH hỗ trợ SFTP; Render có [hướng dẫn chuyển file](https://render.com/docs/disks#transferring-files). Nếu công cụ cũ yêu cầu bật SFTP, tham khảo cờ `-s` trong hướng dẫn Render hoặc cập nhật OpenSSH. Không chuyển sang legacy SCP chỉ để bỏ qua lỗi.

   Mở Render → Shell của service đang chạy, thực hiện:

   ```sh
   tar -xzf /var/data/uploads-host-transfer.tar.gz -C /var/data
   ls -la /var/data/uploads/.private-guidance
   ```

   Các file cần giữ đúng tên, kể cả thư mục ẩn `.private-guidance`, vì database tham chiếu storage key hiện có. Chỉ giải nén vào disk mới/chưa có tệp trùng tên; nếu host đã có file hoặc người dùng đã thao tác, so sánh và lập kế hoạch hợp nhất trước, không ghi đè hàng loạt. Không đưa các PDF/ZIP riêng tư vào `frontend/public` hoặc bật public bucket để xử lý lỗi tải.

8. **Kiểm tra chức năng sau khi lên host**

   Mở domain Production của Vercel bằng cửa sổ ẩn danh. Đăng nhập bằng tài khoản ứng dụng đã có. Bộ mẫu sử dụng `mau18_giaovu`, `mau18_gv01`…`mau18_gv04` và `mau18_sv01`…`mau18_sv12`; mật khẩu xem trong file riêng tư `.cache/sample-data-steps1-8/4a1dea0416847d00/HUONG-DAN.md`, không đưa file này lên GitHub hoặc chia sẻ công khai.

   Kiểm tra lần lượt `MAU18-01-DANGKY`, `MAU18-02-DECUONG`, `MAU18-03-BAOCAO`. Đăng nhập tài khoản giáo vụ, giảng viên và sinh viên trên các phiên riêng. Chọn đúng đợt ở mỗi tài khoản, đối chiếu tên/mã đợt và dữ liệu có quyền xem. Vào Kế hoạch và báo cáo tuần, kiểm tra tuần 2 của đợt báo cáo.

   Kiểm tra đăng nhập/đăng xuất, dữ liệu danh mục, đăng ký/phân công, đề cương/xét duyệt, hồ sơ, giao nhiệm vụ, báo cáo tuần, đánh giá, thông báo trong ứng dụng và xuất PDF. Tải thử file PDF/ZIP cũ, sau đó nộp một file thử bằng tài khoản mẫu phù hợp.

   Refresh một đường dẫn con để kiểm tra SPA rewrite. Redeploy backend một lần rồi tải lại file vừa nộp để xác nhận Persistent Disk hoạt động. Mở DevTools → Network: request API phải đi tới Render, không có request nghiệp vụ tới localhost hoặc lỗi CORS. Health xanh mà login lỗi vẫn phải kiểm tra Logs và connection string.

   Bộ mẫu có các trạng thái khác nhau theo từng đợt; việc chưa được phép thao tác ở một trạng thái không có nghĩa là dữ liệu không đồng bộ. Chọn đúng đợt, vai trò và tài khoản đã ghi trong hướng dẫn dữ liệu mẫu.

9. **Cập nhật code sau này**

   Với thay đổi code không đổi schema: sửa ở máy → build/kiểm tra → review và commit → push `fix/integration-ui`. Bật Auto Deploy cho đúng nhánh trên Render; Vercel tự tạo Production deployment từ nhánh đã chọn. Kiểm tra cả hai nền tảng đã chạy cùng commit trước khi thử luồng có thay đổi API.

   Không cần tạo lại ba project hay nạp lại dữ liệu mỗi lần sửa giao diện/API. Database Supabase vẫn ở nguyên và tệp trong Persistent Disk được giữ. Service có disk có thể gián đoạn ngắn khi redeploy; disk chỉ gắn được cho một instance, nên phương án này phù hợp triển khai ban đầu. Nếu cần nhiều instance, cân nhắc bổ sung lưu trữ object storage riêng.

   Khi sửa `schema.prisma`, cần migration đã được kiểm tra với dữ liệu thật tương đương, backup và thứ tự triển khai tương thích giữa schema/API/frontend. Chỉ thêm field vào code mà chưa cập nhật database sẽ gây lỗi; rollback code không tự rollback migration. Không dùng seed/reset trong quy trình auto deploy.

   Giữ JWT secret ổn định giữa các lần deploy thông thường. Đổi secret khi có chủ đích sẽ làm các phiên đăng nhập hiện tại cần đăng nhập lại. Khi bật email thật, dùng SMTP thật và kiểm tra email outbox mẫu trước để không gửi nhầm email kiểm thử.

10. **Tra lỗi thường gặp**

    | Hiện tượng | Cần kiểm tra |
    | --- | --- |
    | Vercel báo không tìm thấy `@doan/shared` | Root `frontend`, tùy chọn đọc source ngoài root, workspace và Build Command |
    | Vercel báo pnpm expected >=9, got 6.35.1 | Push `package.json` và `frontend/vercel.json` mới; bật `ENABLE_EXPERIMENTAL_COREPACK=1` cho Production, dùng Install Command Corepack, rồi deploy từ commit mới |
    | Refresh trang con bị 404 | `frontend/vercel.json` có ở commit và deployment hiện tại không |
    | Request gọi localhost | `VITE_API_URL` ở đúng môi trường Production và đã redeploy chưa |
    | CORS | `FRONTEND_URL` có đúng origin của tab đang mở, không có dấu `/` cuối; Render đã redeploy chưa |
    | API 404 | URL frontend có `/api`; backend dùng `API_PREFIX=api` |
    | Prisma P1001/không kết nối DB | Project đang chạy, đúng URI/password, Session pooler 5432, SSL và ký tự password được encode |
    | Prisma báo thiếu bảng/cột | Đang dùng đúng project; lịch sử và trạng thái migration; không reset để chữa |
    | Có dữ liệu nhưng không tải được tệp cũ | Bước chuyển uploads, đúng storage key và đường dẫn `/var/data/uploads` |
    | Upload xong mất sau redeploy | Có disk thật sự gắn tại `/var/data`, storage path nằm trong disk |
    | PDF lỗi thiếu trình duyệt | Runtime Docker, đúng Dockerfile và `PDF_CHROME_PATH` trong Linux |
    | Prisma thiếu `libssl.so.1.1` hoặc engine `linux-musl` | Push Dockerfile Debian Bookworm và script kiểm tra engine; Render → Manual Deploy → Clear build cache & deploy; kiểm tra commit đã cập nhật và không còn biến ép đường dẫn engine Alpine |
    | Không nhận email | Email worker đang chủ động tắt; cần SMTP thật trước khi bật |
    | Render Free phản hồi chậm lần đầu | Service có thể đang khởi động lại sau khi ngủ; frontend có timeout 20 giây |

    Khi cần hỗ trợ, cung cấp tên bước, thông báo lỗi và log đã che thông tin nhạy cảm. Không gửi nguyên `.env`, password, JWT secret hoặc connection string có mật khẩu.
