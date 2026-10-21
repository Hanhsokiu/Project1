## Thay đổi

Mô tả use case/bước phụ trách và hành vi trước/sau.

## Tích hợp

Producer/consumer bị ảnh hưởng; contract/API/schema hoặc file chung cần phối hợp. Nêu rõ nếu không đổi.

## Kiểm thử

Ghi lệnh thực sự đã chạy và kết quả; phân biệt local/CI/chưa chạy. Thay schema cần test migration mới trên DB riêng, bảo toàn legacy và recovery.

## Rollout

Nêu migration/backfill/feature gate nếu có. Không chạy DDL lên Supabase chung hoặc sửa migration đã áp dụng khi chưa có phê duyệt riêng.
