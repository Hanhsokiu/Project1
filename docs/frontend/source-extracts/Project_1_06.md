# Word extract: Project_1_06.docx

P1: PHẦN MỞ ĐẦU
P2: 1. Lý do chọn đề tài
P3: Đồ án tốt nghiệp là một học phần quan trọng, đánh dấu sự kết thúc quá trình học tập của sinh viên tại trường đại học. Tuy nhiên, việc quản lý quá trình này tại nhiều khoa và trường đại học hiện nay vẫn còn mang tính chất thủ công, dựa nhiều vào giấy tờ, bảng tính Excel, hoặc các công cụ giao tiếp rời rạc như Email, Zalo, Facebook. Điều này dẫn đến nhiều khó khăn như: khó khăn trong việc lưu trữ và tra cứu thông tin; tốn nhiều thời gian và công sức trong việc phân công giảng viên hướng dẫn (GVHD), phân công hội đồng bảo vệ; giảng viên khó theo dõi sát sao tiến độ từng tuần của sinh viên; sinh viên gặp khó khăn trong việc nộp báo cáo và nhận phản hồi kịp thời; quá trình tổng hợp điểm số dễ xảy ra sai sót. Do đó, việc xây dựng một "Phần mềm quản lý hướng dẫn đồ án tốt nghiệp trong trường đại học" là vô cùng cấp thiết, giúp số hóa toàn bộ quy trình, nâng cao hiệu quả quản lý, tiết kiệm thời gian và đảm bảo tính minh bạch, chính xác.
P4: 2. Mục tiêu của đề tài
P5: Mục tiêu chính của đề tài là xây dựng một hệ thống phần mềm hoàn chỉnh, hoạt động trên nền tảng Web, phục vụ trực tiếp cho công tác quản lý đồ án tốt nghiệp của một khoa trong trường đại học. Các mục tiêu cụ thể bao gồm:
P6: Số hóa toàn bộ quy trình quản lý từ khâu tạo đợt, đăng ký, phân công, đến khâu nộp báo cáo, chấm điểm và tổng hợp kết quả.
P7: Hỗ trợ người quản lý (Khoa) tối ưu hóa việc phân công GVHD bán tự động dựatrên nguyện vọng và năng lực.
P8: Hỗ trợ tự động hóa việc sắp xếp hội đồng bảo vệ, phân công giảng viên phản biện (GVPB) đảm bảo tính khách quan (GVHD không chấm sinh viên của mình).
P9: Tạo môi trường tương tác liên tục giữa giảng viên và sinh viên thông qua việc nộp báo cáo tiến độ hàng tuần và nhận xét.
P10: Cung cấp hệ thống biểu mẫu, báo cáo, xuất kết quả định dạng PDF chuẩn hóa theo quy định của nhà trường.
P11: 3. Đối tượng và phạm vi nghiên cứu
P12: Đối tượng nghiên cứu: Quy trình quản lý đào tạo, cụ thể là nghiệp vụ tổ chức, hướng dẫn và đánh giá đồ án tốt nghiệp tại các khoa trong trường đại học; các công nghệ phát triển phần mềm ứng dụng web.
P13: Phạm vi nghiên cứu và ứng dụng:
P14: Phạm vi nghiệp vụ: Quản lý các đợt làm đồ án, thông tin sinh viên, thông tin giảng viên, quản lý đề cương, quản lý tiến độ, quản lý hội đồng và điểm số.
P15: Phạm vi đối tượng sử dụng: Admin, Khoa, Giảng viên, Sinh viên, Hội đồng.
P16: 4. Phương pháp thực hiện
P17: Phương pháp khảo sát thực tế: Thu thập các quy định, biểu mẫu, quy trình tổ chức bảo vệ đồ án thực tế tại các khoa để xây dựng mô hình nghiệp vụ.
P18: Phương pháp phân tích và thiết kế hệ thống (OOAD): Sử dụng ngôn ngữ mô hình hóa thống nhất (UML) để phân tích yêu cầu, thiết kế kiến trúc phần mềm, thiết kế cơ sở dữ liệu.
P19: Phương pháp phát triển phần mềm: Áp dụng mô hình phát triển phần mềm linh hoạt (Agile/Scrum), chia nhỏ các chức năng thành các module để phát triển, kiểm thử và tích hợp liên tục.
P20: CHƯƠNG 1. KHẢO SÁT VÀ PHÂN TÍCH YÊU CẦU HỆ THỐNG
P21: 1.1. Khảo sát thực tế bài toán
P22: Phiếu phỏng vấn các bên liên quan (Sinh viên, Giảng viên, Giáo vụ Khoa) 
P23: Đối tượng: Sinh viên

## Table 1
|  | Kế hoạch Phỏng vấn |
| Người phỏng vấn: Phan Danh Vương Quy | Người được hỏi: Sinh viên  |
| Địa điểm: Trường Đại học Giao thông vận tải | Thời gian: 10/09/2026 |
| Dự kiến: / - Giới thiệu mục đích buổi phỏng vấn, xin phép ghi âm, ghi chú. / - Chủ đề 1: Tìm hiểu hiện trạng đăng ký nguyện vọng Giảng viên hướng dẫn (GVHD), cách nộp báo cáo tuần và liên lạc với giảng viên.  / - Chủ đề 2: Thu thập khó khăn khi dùng các công cụ rời rạc (Zalo, Email) và mong muốn về phần mềm quản lý tập trung.  / - Cảm ơn người được hỏi, tóm tắt và kết thúc. | Thời gian dự kiến:  / - 02 phút /  / - 05 phút /  / - 05 phút /  / - 1 phút /  |
|    Tổng cộng: 13 phút |  |

P25: Đối tượng: Giảng viên

## Table 2
|  | Kế hoạch Phỏng vấn |
| Người phỏng vấn: Nguyễn Ngọc Hào | Người được hỏi: Giảng viên  |
| Địa điểm: Văn phòng Bộ môn, Trường Đại học Giao thông vận tải | Thời gian: 10/09/2026 |
| Dự kiến:  / - Giới thiệu mục đích phỏng vấn, xin phép ghi âm. / - Chủ đề 1: Khảo sát cách quản lý tiến độ sinh viên, việc lưu vết nhận xét báo cáo tuần và quy trình chấm điểm.  / - Chủ đề 2: Tìm hiểu nhu cầu về hệ thống tự động cảnh báo trễ hạn, giao diện nhập điểm trực tiếp cho Hội đồng.  / - Cảm ơn và kết thúc. | Thời gian dự kiến:  / - 02 phút /  / - 05 phút /  / - 05 phút /  / - 1 phút /  |
|    Tổng cộng: 13 phút |  |

P27: Đối tượng: Khoa

## Table 3
|  | Kế hoạch Phỏng vấn |
| Người phỏng vấn: Nguyễn Tiến Hanh | Người được hỏi:  Giáo vụ Khoa |
| Địa điểm: Văn phòng Khoa CNTT | Thời gian: ??? |
| Dự kiến:  / - Giới thiệu mục đích buổi phỏng vấn. /  / - Chủ đề 1: Tìm hiểu quy trình lập danh sách, phân công GVHD thủ công và sắp xếp Hội đồng bảo vệ (nguyên tắc không trùng lặp GVHD).  /  / - Chủ đề 2: Ghi nhận nhu cầu về thuật toán phân bổ tự động, tự động tính điểm tổng kết và xuất biên bản PDF.  /  / - Cảm ơn và kết thúc. /  | Thời gian dự kiến:  / - 02 phút /  / - 06 phút /  / - 06 phút /  /  / - 1 phút /  |
|    Tổng cộng: 13 phút |  |

P28: Các câu hỏi cụ thể:
P29: 1. Đối tượng: Sinh viên (Người thực hiện đồ án)
P30: Bạn hiện đang theo dõi các thông báo về đợt làm đồ án tốt nghiệp (thời gian đăng ký, biểu mẫu) qua kênh nào? (Mở) 
P31: Bạn đăng ký GVHD bằng cách nào và có bất tiện gì không?
P32: Bạn có gặp khó khăn khi tìm kiếm thông tin về hướng nghiên cứu và chỉ tiêu của từng Giảng viên hướng dẫn (GVHD) không? (Đóng: Có/Không) 
P33: Bạn có mong muốn được biết ngay trên hệ thống xem nguyện vọng 1 của mình đã đầy chỉ tiêu hay chưa để kịp chuyển sang nguyện vọng 2, 3 không? (Đóng: Có/Không) 
P34: Khi làm đề cương và báo cáo tiến độ tuần, bạn tương tác, nộp file (PDF, Source code) cho giảng viên qua công cụ nào? (Mở) 
P35: Bạn có gặp tình trạng bị trôi mất file báo cáo hoặc quên mất yêu cầu chỉnh sửa của giảng viên do dùng chung nhóm chat Zalo/Facebook không? (Đóng: Có/Không) 
P36: Bạn mong muốn hệ thống có chức năng tự động gửi thông báo/email nhắc nhở khi sắp đến hạn chốt nộp đề cương hoặc nộp quyển Final PDF không? (Đóng: Có/Không) 
P37: Hiện tại việc tra cứu lịch bảo vệ (thuộc hội đồng nào, phòng nào, thứ tự mấy) có thuận tiện cho bạn không? (Mở) 
P38: Bạn có muốn xem điểm thành phần (Điểm HD, Điểm Phản biện) và điểm tổng kết ngay trên hệ thống phần mềm sau khi bảo vệ xong không? (Đóng: Có/Không) 
P40: 2. Đối tượng: Giảng viên (Hướng dẫn, Phản biện, Hội đồng)
P41: Thầy/Cô hiện tại quản lý danh sách sinh viên mình hướng dẫn (thông tin liên hệ, tên đề tài, tiến độ) bằng công cụ gì (Excel, Sổ tay, v.v.)? (Mở) 
P42: Mỗi đợt hướng dẫn, Thầy/Cô có gặp khó khăn trong việc kiểm soát việc nộp báo cáo hàng tuần của tất cả các sinh viên không? (Đóng: Có/Không) 
P43: Thầy/Cô thường ghi nhận và lưu vết các đánh giá (Đạt/Không đạt/Cần sửa) cho sinh viên qua từng tuần như thế nào? (Mở) 
P44: Khi được phân công làm Giảng viên phản biện (GVPB), Thầy/Cô nhận file đồ án chéo từ Khoa hoặc sinh viên qua kênh nào và có hay bị thất lạc không? (Mở) 
P45: Thầy/Cô có mong muốn có một giao diện chung (Workspace) để xem toàn bộ lịch sử nộp bài và nhận xét tiến độ của sinh viên trong suốt kỳ học không? (Đóng: Có/Không) 
P46: Khi tham gia Hội đồng bảo vệ, việc chấm điểm hiện tại trên biên bản giấy có gây bất tiện trong việc tính toán tổng điểm không? (Đóng: Có/Không) 
P47: Thầy/Cô có đồng tình với việc sử dụng thiết bị (như máy tính bảng/laptop) để nhập điểm trực tiếp theo các tiêu chí (Rubric) ngay tại buổi bảo vệ không? (Đóng: Có/Không) 
P48: Ngoài những chức năng trên, Thầy/Cô mong muốn phần mềm có thêm tính năng gì để hỗ trợ việc đánh giá đồ án nhanh chóng hơn? (Mở) 
P50: 3. Đối tượng: Giáo vụ Khoa / Quản trị hệ thống
P51: Hiện nay Khoa đang sử dụng phương pháp nào để lập danh sách sinh viên đủ điều kiện làm đồ án và cấu hình đợt bảo vệ? (Mở) 
P52: Việc khớp 3 nguyện vọng của sinh viên với chỉ tiêu (Quota) của từng giảng viên hiện tại được thực hiện thủ công như thế nào? (Mở) 
P53: Anh/chị có gặp sai sót hoặc áp lực khi phải tự đối chiếu điểm GPA để ưu tiên xếp giảng viên cho sinh viên bị trùng nguyện vọng 1 không? (Đóng: Có/Không) 
P54: Anh/chị có mong muốn hệ thống áp dụng thuật toán phân công bán tự động (ưu tiên xét theo NV1, NV2, NV3 và GPA) để giảm thiểu thao tác thủ công không? (Đóng: Có/Không) 
P55: Khoa mất khoảng bao lâu để chia Hội đồng bảo vệ sao cho đảm bảo nguyên tắc khách quan (Giảng viên hướng dẫn tuyệt đối không ngồi Hội đồng chấm sinh viên do mình hướng dẫn)? (Mở) 
P56: Việc sắp xếp lịch bảo vệ (ngày, buổi sáng/chiều) và thứ tự sinh viên theo bảng chữ cái hiện đang được thao tác trên công cụ gì? (Mở) 
P57: Anh/chị có muốn hệ thống tự động gạch tên các sinh viên không đủ điều kiện ra Hội đồng (ví dụ: điểm Hướng dẫn < 5.0 hoặc điểm Phản biện < 5.0) không? (Đóng: Có/Không) 
P58: Việc tổng hợp điểm (Điểm HD x Trọng số + Điểm PB x Trọng số + Điểm HĐ x Trọng số) hiện đang được tính bằng Excel hay tính tay? (Mở) 
P59: Anh/chị mong đợi hệ thống hỗ trợ tự động xuất các biểu mẫu, biên bản bảo vệ định dạng PDF nào nhất để Hội đồng đồng ký xác nhận? (Mở) 
P61: Kết quả phỏng vấn các bên liên quan (Sinh viên, Giảng viên, Giáo vụ Khoa) 
P62: Tổng hợp kết quả phỏng vấn
P63: Đối tượng 1: Khoa

## Table 4
| Phiếu phỏng vấn |  |
| Dự án: Quản lý hướng dẫn đồ án tốt nghiệp | Ngày phỏng vấn:  |
| Người phỏng vấn: Nguyễn Tiến Hanh | Đối tượng phỏng vấn: Giáo vụ Khoa |
| Câu hỏi | Trả lời |
| Câu 1: Hiện nay Khoa đang sử dụng phương pháp nào để lập danh sách sinh viên đủ điều kiện làm đồ án và cấu hình đợt bảo vệ? |  |
| Câu 2: Việc khớp 3 nguyện vọng của sinh viên với chỉ tiêu của giảng viên hiện tại được thực hiện như thế nào? |  |
| Câu 3: Khoa mất khoảng bao lâu để chia Hội đồng và sắp xếp lịch bảo vệ? |  |
| Câu 4: Khoa có mong muốn hệ thống tự động hỗ trợ phân công, kiểm tra điều kiện và tổng hợp điểm không? |  |
| Nhận xét: |  |

P65: Đối tượng 2: Giảng viên

## Table 5
| Phiếu phỏng vấn |  |
| Dự án: Quản lý hướng dẫn đồ án tốt nghiệp | Ngày phỏng vấn:  |
| Người phỏng vấn: Phan Danh Vương Quy | Đối tượng phỏng vấn: Giảng viên Hướng dẫn |
| Câu hỏi | Trả lời |
| Câu 1: Thầy/Cô hiện đang quản lý danh sách sinh viên hướng dẫn, đề tài và tiến độ bằng công cụ gì? |  |
| Câu 2: Thầy/Cô có gặp khó khăn trong việc kiểm soát sinh viên nộp báo cáo tiến độ hàng tuần không? |  |
| Câu 3: Thầy/Cô thường ghi nhận đánh giá và yêu cầu chỉnh sửa của sinh viên như thế nào? |  |
| Nhận xét: |  |

P67: Đối tượng 3: Sinh viên

## Table 6
| Phiếu phỏng vấn |  |
| Dự án: Quản lý hướng dẫn đồ án tốt nghiệp | Ngày phỏng vấn:  |
| Người phỏng vấn: Nguyễn Ngọc Hào | Đối tượng phỏng vấn: Sinh viên năm cuối |
| Câu hỏi | Trả lời |
| Câu 1: Bạn hiện đang theo dõi thông báo về đợt làm đồ án, thời gian đăng ký và biểu mẫu qua kênh nào? | Thường thì mình theo dõi thông báo qua nhóm Zalo/Facebook của lớp hoặc thông báo từ khoa. Nhiều khi thông tin nằm ở nhiều chỗ nên cũng hơi khó theo dõi. |
| Câu 2: Bạn có gặp khó khăn khi tìm thông tin về hướng nghiên cứu và chỉ tiêu của từng giảng viên không? | Có. Thường phải tự tìm thông tin về hướng nghiên cứu và hỏi các bạn hoặc giảng viên. Mình không biết chính xác giảng viên nào còn chỉ tiêu. |
| Câu 3: Bạn có mong muốn hệ thống cho biết ngay tình trạng chỉ tiêu và gửi thông báo khi gần đến hạn nộp không? | Có. Nếu hệ thống hiển thị số chỉ tiêu còn lại và thông báo khi sắp hết hạn thì sẽ dễ theo dõi hơn, đặc biệt là khi nguyện vọng 1 đã đủ người. |
| Nhận xét: | Sinh viên cần sự minh bạch về thông tin (Quota giảng viên, trạng thái đề cương, lịch bảo vệ) và mong muốn hệ thống có trải nghiệm liền mạch từ lúc đăng ký đến lúc xem điểm.  |

P69: 1.1.3. Kết quả quan sát quy trình thực tế 
P70: Để có cái nhìn thực tế và toàn diện về bài toán quản lý quá trình thực hiện và hướng dẫn đồ án tốt nghiệp, chúng tôi tiến hành quan sát các hoạt động liên quan đến việc đăng ký đồ án, phân công giảng viên hướng dẫn, theo dõi tiến độ, nộp báo cáo và tổ chức bảo vệ tại khoa. Kết quả quan sát cho thấy một số quy trình và vấn đề nổi bật như sau:
P71: Quy trình đăng ký và phân công đồ án:Sinh viên theo dõi thông báo về đợt làm đồ án, tìm hiểu hướng nghiên cứu và chỉ tiêu của giảng viên, sau đó đăng ký các nguyện vọng. Khoa tiến hành tổng hợp danh sách, đối chiếu nguyện vọng với chỉ tiêu của giảng viên và thực hiện phân công. Khi có nhiều sinh viên cùng đăng ký một giảng viên, việc đối chiếu và sắp xếp có thể phải thực hiện thủ công.
P72: Quy trình thực hiện và hướng dẫn đồ án:Sau khi được phân công, sinh viên trao đổi với giảng viên để thống nhất đề tài và kế hoạch thực hiện. Trong quá trình làm đồ án, sinh viên thực hiện các công việc theo từng giai đoạn, nộp đề cương và báo cáo tiến độ cho giảng viên. Giảng viên theo dõi tiến độ, đưa ra nhận xét và yêu cầu sinh viên chỉnh sửa, hoàn thiện sản phẩm.
P73: Quy trình nộp bài và trao đổi thông tin:Việc trao đổi giữa sinh viên và giảng viên có thể được thực hiện thông qua nhiều công cụ khác nhau như Zalo, Facebook, email hoặc các hình thức trao đổi trực tiếp. File báo cáo, mã nguồn và các tài liệu liên quan được gửi qua các kênh này, dẫn đến việc thông tin và lịch sử trao đổi có thể bị phân tán.
P74: Quy trình tổ chức bảo vệ và công bố điểm:Khoa thực hiện việc lập danh sách sinh viên đủ điều kiện, thành lập hội đồng, phân công giảng viên phản biện và sắp xếp lịch bảo vệ. Trong buổi bảo vệ, các thành viên hội đồng thực hiện đánh giá và chấm điểm. Sau đó, điểm thành phần được tổng hợp để tính điểm cuối cùng và công bố kết quả cho sinh viên.
P75: Vấn đề chung quan sát được:
P76: Thông tin còn phân tán:Thông báo, tài liệu, báo cáo, nhận xét và lịch sử trao đổi giữa sinh viên với giảng viên có thể được lưu trữ trên nhiều kênh khác nhau, gây khó khăn cho việc tra cứu và theo dõi quá trình thực hiện đồ án.
P77: Nhiều thao tác thủ công:Một số công việc như tổng hợp danh sách, đối chiếu nguyện vọng với chỉ tiêu, theo dõi tiến độ, sắp xếp hội đồng, lịch bảo vệ và tổng hợp điểm có thể phải thực hiện thủ công, làm tăng thời gian xử lý.
P78: Khó kiểm soát tiến độ:Giảng viên phải theo dõi nhiều sinh viên, trong khi báo cáo và lịch sử nhận xét có thể nằm ở nhiều nơi. Điều này gây khó khăn khi cần kiểm tra quá trình thực hiện và đánh giá tiến độ của từng sinh viên.
P79: Khó tra cứu và tổng hợp dữ liệu:Khi cần tìm lại thông tin về đề tài, sinh viên, giảng viên hướng dẫn, báo cáo tiến độ, điểm thành phần hoặc kết quả bảo vệ, việc tổng hợp từ nhiều nguồn có thể mất thời gian và dễ xảy ra sai sót.
P80: Khó đảm bảo tính nhất quán trong quản lý:Khi dữ liệu được quản lý bằng nhiều công cụ khác nhau, việc cập nhật và đồng bộ thông tin giữa sinh viên, giảng viên và giáo vụ khoa có thể gặp khó khăn.
P82: 1.1.4. Thu thập các mẫu phiếu, biên bản nghiệp vụ (Phiếu nhận xét HD, Phản biện, Đề cương, Giấy thành lập HĐ) 
P83: a.Mẫu nhận xét của Giảng viên hướng dẫn
P84: Đây là tờ phiếu được sử dụng khi sinh viên đã hoàn thành xong đồ án và chuẩn bị ra hội đồng. Trong phiếu này, giảng viên hướng dẫn (GVHD) sẽ ghi nhận xét đánh giá tổng quan về ý thức, thái độ làm việc của sinh viên trong suốt kỳ học, cũng như tính cấp thiết và kết quả thực tế mà đề tài đạt được. Dựa vào đó, giảng viên sẽ chốt điểm (trên thang điểm 10) và ký xác nhận để làm cơ sở cho sinh viên được phép bảo vệ.
[embedded image relationship: rId5]
P90: b.Mẫu nhận xét của Giảng viên phản biện
P91: Khác với phiếu của GVHD chủ yếu là nhận xét chung, phiếu dành cho giảng viên phản biện được thiết kế chi tiết hơn dưới dạng các barem điểm thành phần. Cụ thể, tổng điểm 10 được chia đôi: 5 điểm tối đa cho hình thức và nội dung của quyển báo cáo, 5 điểm tối đa cho chất lượng của sản phẩm phần mềm (đánh giá về ý nghĩa, tính hoàn thiện và khả năng làm chủ mã nguồn của sinh viên). Ngoài ra, trên phiếu còn có một phần bắt buộc để giảng viên phản biện ghi chú lại ít nhất 2 câu hỏi sẽ dùng để chất vấn sinh viên trong buổi bảo vệ. 
[embedded image relationship: rId6]
P93: c.Đề cương đồ án tốt nghiệp
P94: Có thể coi đây là một bản cam kết ban đầu giữa sinh viên, giảng viên và Khoa. Ngay từ đầu đợt, sinh viên phải điền vào mẫu này để chốt rõ phạm vi đề tài, công cụ/ngôn ngữ lập trình sẽ sử dụng và những kết quả dự kiến. Phần quan trọng nhất của đề cương là bảng "Kế hoạch thực hiện đề tài", trong đó chia nhỏ các đầu việc theo từng mốc thời gian để sinh viên bám sát tiến độ. Một bản đề cương hợp lệ bắt buộc phải có đủ 4 chữ ký: Sinh viên, GVHD, Trưởng bộ môn và Trưởng khoa. 
[embedded image relationship: rId7]
P95: d.Mẫu giấy lập Hội đồng
P96: Trong khi 3 biểu mẫu trên gắn liền với quá trình làm việc của sinh viên, thì đây là văn bản hành chính nội bộ do Khoa lập ra. Tờ trình này được gửi lên Ban Giám hiệu và Phòng Đào tạo Đại học để xin quyết định thành lập các hội đồng chấm đồ án. Mẫu giấy sẽ liệt kê cụ thể danh sách từng hội đồng (Hội đồng 1, Hội đồng 2...) và phân công rõ vai trò của từng giảng viên (ai làm Chủ tịch, ai làm Thư ký, ai làm Ủy viên), kèm theo đơn vị công tác của các thầy cô tham gia.
[embedded image relationship: rId8]
P97: 1.2. Phân tích quy trình nghiệp vụ
P98: 1.2.1. Phân tích quy trình quản lý hiện tại & các hạn chế 
P99: Từ đề án hiện có, quy trình hiện tại có thể khái quát: tạo kỳ/đợt - nhập danh sách SV đủ điều kiện - SV đăng ký hướng và đề xuất GV - phân GVHD bán tự động/thủ công - thống nhất đề tài/đề cương - tạo nhóm duyệt - sửa/chốt - hướng dẫn và báo cáo hàng tuần - tổ chức bảo vệ - phản biện - lập lịch - chấm - xuất kết quả. 

## Table 7
| Khâu | Hiện trạng | Điểm hạn chế |
| Mở đợt | Khoa tạo kỳ/đợt và kế hoạch | Chưa có workflow trạng thái rõ ràng. |
| Đăng ký | SV đăng ký hướng + đề xuất GV | Tổng hợp thủ công. |
| Phân GVHD | Bán tự động, còn lại thủ công | Khó giải thích và cân bằng tải. |
| Đề tài/đề cương | Trao đổi, cập nhật, xuất PDF | Nhiều vòng sửa, khó quản lý phiên bản. |
| Duyệt | Tạo nhóm GV và phân đề cương | Cần workflow rõ người duyệt và trạng thái. |
| Hướng dẫn | SV gửi báo cáo/code, GV nhận xét | Cần theo dõi deadline, trạng thái, lịch sử. |
| Bảo vệ | Lập HĐ, phân phản biện, lập lịch | Dễ xung đột và mất cân bằng. |
| Điểm | Thành viên nhập, hệ thống tổng hợp | Công thức phải được xác nhận và khóa/audit. |

P101: 1.2.2. Phân tích quy trình nghiệp vụ đề xuất (10 bước từ mở đợt đến công bố điểm) 
P102: KHOA CNTT MỞ ĐỢT + LẬP KẾ HOẠCH 
P103: SINH VIÊN ĐĂNG KÝ HƯỚNG + NGUYỆN VỌNG GVHD 
P104: HỆ THỐNG ĐỀ XUẤT PHÂN CÔNG - KHOA ĐIỀU CHỈNH - CHỐT 
P105: GVHD + SV THỐNG NHẤT ĐỀ TÀI + LẬP ĐỀ CƯƠNG 
P106: NHÓM/NGƯỜI ĐƯỢC KHOA PHÂN QUYỀN DUYỆT - SỬA - CHỐT 
P107: GVHD GIAO VIỆC + SV BÁO CÁO + ĐÁNH GIÁ THEO MỐC 
P108: XÉT ĐIỀU KIỆN BẢO VỆ - BẢO LƯU/CHƯA DUYỆT/ĐỦ ĐIỀU KIỆN 
P109: THÀNH LẬP HỘI ĐỒNG - CHIA SV - PHẢN BIỆN - LẬP LỊCH 
P110: NGÀY BẢO VỆ - NHẬP ĐIỂM/ĐÁNH GIÁ - TỔNG HỢP 
P111: XUẤT DANH SÁCH - KÝ/NỘP - CÔNG BỐ - ĐÓNG ĐỢT
P113: Quy trình tổ chức và quản lý đồ án tốt nghiệp (ĐATN) tại Khoa bao gồm 10 bước nghiệp vụ tuần tự và liên kết dữ liệu chặt chẽ như sau: 
P114: Bước 1. Tạo đợt làm đồ án & Nhập danh sách sinh viên đủ điều kiện: Giáo vụ Khoa tạo kỳ học và đợt làm đồ án cho từng hệ đào tạo (Chính quy, Liên thông, Từ xa). Thiết lập Bảng kế hoạch thực hiện học phần đồ án/thực tập (mở/đóng đăng ký, chốt đề cương, báo cáo tuần, nộp PDF đồ án final, bảo vệ). Nhập vào hệ thống danh sách sinh viên đủ điều kiện làm đồ án đợt mới nhất. 
P115: Bước 2. Sinh viên cập nhật thông tin & Đăng ký nguyện vọng: Sinh viên đăng nhập bằng mã sinh viên (mật khẩu mặc định là mã SV), bắt buộc đổi mật khẩu và cập nhật Email, Số điện thoại. Sau đó đăng ký 01 Hướng làm đồ án (Phát triển phần mềm, Ứng dụng game, Kiểm thử, Thuật toán & Học máy, Thiết kế & Quản trị mạng,...) và đăng ký tối đa 03 Nguyện vọng GVHD (NV1, NV2, NV3) theo thứ tự ưu tiên. 
P116: Bước 3. Phân công Giảng viên hướng dẫn (Bán tự động): Hệ thống tự động phân công GVHD dựa trên nguyện vọng, hướng đồ án và Quota tối đa của giảng viên. 
P117: Logic ưu tiên: Ưu tiên phân theo NV1  Nếu quá Quota thì xét ưu tiên GPA tích lũy cao hơn hoặc đã từng làm việc/nghiên cứu chung  SV bị vượt Quota được xét tiếp NV2, NV3  SV trượt hết nguyện vọng sẽ chuyển sang phân tự động theo Hướng đồ án. 
P118: Số SV còn lại được Giáo vụ Khoa phân công thủ công. Sau khi chốt, hệ thống gửi Email thông báo tự động cho GV và mở quyền xem cho SV. SV gặp GVHD thống nhất đề tài, cập nhật đề cương lên phần mềm và xuất file PDF. 
P119: Bước 4. Tạo các nhóm giảng viên duyệt đề cương: Giáo vụ Khoa tạo các Nhóm giảng viên duyệt đề cương trên hệ thống (chia theo Bộ môn chuyên môn). 
P120: Bước 5. Phân công & Xét duyệt đề cương: Hệ thống phân đề cương về các nhóm bộ môn tương ứng duyệt. Nhóm họp xét duyệt trực tiếp trên phần mềm và đưa ra các yêu cầu chỉnh sửa (nếu có). 
P121: Bước 6. Chỉnh sửa nội dung đề cương: GVHD và sinh viên thống nhất chỉnh sửa nội dung đề cương trên phần mềm theo góp ý của nhóm xét duyệt. 
P122: Bước 7. Chốt & Nộp đề cương chính thức: Sinh viên xuất đề cương hoàn thiện ra file PDF theo mẫu chuẩn, in ra xin chữ ký GVHD và nộp về Khoa. 
P123: Bước 8. Quá trình thực hiện đồ án & Báo cáo tiến độ tuần: Hàng tuần (theo kế hoạch đợt), sinh viên bắt buộc upload file báo cáo tiến độ và mã nguồn (source code) lên hệ thống. GVHD truy cập review, nhận xét, đánh giá (Đạt/Không đạt/Cần sửa) và giao việc cho tuần tiếp theo. Lịch sử nhận xét được lưu vết đầy đủ. 
P124: Bước 9. Tổ chức bảo vệ & Chấm điểm:
P125: Chốt nộp đồ án: SV upload file Đồ án hoàn chỉnh (PDF) lên hệ thống. GVHD viết nhận xét và cho Điểm hướng dẫn. 
P126: Thành lập Hội đồng & Phân công phản biện: Khoa lập các Hội đồng chấm đồ án (3-5 GV/HĐ). Phân công Giảng viên phản biện (GVPB) theo nguyên tắc: GV thuộc Hội đồng nào thì SV do GV đó hướng dẫn KHÔNG được phân cho các thành viên của HĐ đó chấm/phản biện (GVHD tuyệt đối không ngồi chấm SV do mình hướng dẫn). Cân bằng khối lượng đồ án giữa các HĐ và các thành viên. 
P127: Chấm Phản biện: GVPB tải file đồ án được phân công, đọc duyệt, viết nhận xét và nhập Điểm phản biện trên phần mềm. 
P128: Xếp lịch bảo vệ: Giáo vụ Khoa xác định số buổi bảo vệ (Sáng/Chiều). Hệ thống tự động sắp xếp thứ tự SV bảo vệ tại các HĐ theo thứ tự Alphabet của [Tên + Họ đệm]. 
P129: Chấm điểm Ngày bảo vệ: Trong ngày bảo vệ, từng thành viên HĐ dùng giao diện riêng chấm điểm trực tiếp theo các tiêu chí (Rubric). Hệ thống tự động tính điểm tổng hợp theo công thức chuẩn. 
P130: Bước 10. Xuất kết quả bảo vệ & Tổng kết: Hệ thống tự động xuất kết quả bảo vệ tại các Hội đồng theo mẫu biểu chuẩn để các thành viên đồng ký xác nhận và gửi lưu trữ cho Khoa. 
P131: Quy trình đề xuất
P132: Quy trình To-Be được thiết kế thành 6 giai đoạn lớn, trong đó một số giai đoạn chứa các workflow con.

## Table 8
| Giai đoạn | Tên | Đầu vào | Xử lý chính | Đầu ra |
| 1 | Mở đợt và kế hoạch | Nhu cầu tổ chức | Tạo đợt, đối tượng, timeline | Đợt đồ án |
| 2 | Đăng ký hướng + phân GVHD | SV đủ điều kiện, hướng, GV | Đăng ký, tính phương án, chỉnh,chốt | Phân công GVHD |
| 3 | Đề tài + đề cương | GVHD + SV | Thống nhất, lập, duyệt/sửa, chốt | Hồ sơ được duyệt |
| 4 | Hướng dẫn + đánh giá | Đề cương duyệt | Nhiệm vụ, nộp, phản hồi, đánh giá | Lịch sử tiến độ |
| 5 | Xét bảo vệ + hội đồng | SV + học vụ + GVHD | Lọc, bảo lưu, HĐ, phản biện, lịch | Danh sách/lịch HĐ |
| 6 | Bảo vệ + kết thúc | HĐ + điểm | Nhập, tính, chốt, xuất, công bố | Kết quả chính thức |

P135: 1.3. Xác định tác nhân và đặc tả yêu cầu
P136: 1.3.1. Các tác nhân tham gia hệ thống 

## Table 9
| STT | Tác nhân | Mô tả |
| 1 | Admin (Quản trị hệ thống) | Quản lý tài khoản toàn hệ thống, phân quyền (RBAC), cấu hình tham số kỹ thuật, sao lưu dữ liệu và giám sát System Audit Log để bảo mật thông tin.  |
| 2 | Khoa (Giáo vụ Khoa) | Điều phối toàn bộ đợt đồ án: Tạo đợt/kỳ học import danh sách SV, set Quota GV, vận hành thuật toán phân GVHD tự động & điều chỉnh thủ công, tạo nhóm duyệt đề cương , lập HĐ bảo vệ & phân GVPB khách quan , xếp lịch theo alphabet, cấu hình trọng số điểm và xuất báo cáo.  |
| 3 | Giảng viên | Đóng nhiều vai trò: GVHD (thống nhất đề tài, nhận xét tuần, cho Điểm HD; Thành viên nhóm duyệt đề cương (góp ý đề cương cấp bộ môn ; GVPB (đọc đồ án chéo, cho Điểm PB).  |
| 4 | Sinh viên | Đăng nhập, đổi mật khẩu, cập nhật Email/SĐT, chọn hướng & 3 nguyện vọng GVHD , cập nhật đề cương & xuất PDF, nộp báo cáo tuần & code, nộp PDF đồ án final, tra cứu lịch bảo vệ và xem điểm số.  |
| 5 | Hội đồng bảo vệ | Các thành viên HĐ (Chủ tịch, Thư ký, Ủy viên) đăng nhập giao diện riêng chấm điểm thời gian thực trong buổi bảo vệ theo các tiêu chí Rubric và đồng ký xác nhận biên bản.  |

P138: 1.3.2. Phân tích nghiệp vụ chi tiết
P139: Giai đoạn 1 – Xác định phạm vi và tạo đợt
P140: Khoa CNTT xác định đợt đồ án cần tổ chức.
P141: Cán bộ được phân quyền tạo đợt.
P142: Nhập tên đợt, khóa/lớp/đối tượng, thời gian bắt đầu–kết thúc.
P143: Thiết lập các mốc: đăng ký hướng, phân công, đề tài, đề cương, duyệt, hướng dẫn, đánh giá, xét bảo vệ, hội đồng, bảo vệ, công bố điểm.
P144: Hệ thống kiểm tra các mốc không mâu thuẫn.
P145: Đợt chỉ mở đăng ký khi cấu hình bắt buộc đã đủ.
P146: Mọi thay đổi mốc quan trọng sau khi mở đợt phải có quyền và audit.

## Table 10
| Trạng thái đợt | Ý nghĩa | Thao tác |
| Nháp | Đang thiết lập | Sửa cấu hình |
| Sắp mở | Đã cấu hình, chưa đến thời điểm | Xem |
| Đang đăng ký | SV được đăng ký | Đăng ký |
| Đang thực hiện | Đã phân công | Theo dõi |
| Đang bảo vệ | Đang tổ chức bảo vệ | Hội đồng chấm |
| Đã kết thúc | Hoàn thành | Xem/báo cáo |
| Hủy | Đợt bị hủy | Chỉ xem/lưu lịch sử |

P148: Giai đoạn 2 – Đăng ký hướng
P149: SV không đăng ký một đề tài có sẵn ngay từ đầu mà đăng ký hướng/chuyên môn dự kiến. Các hướng phải lấy từ danh mục do Khoa quản lý.

## Table 11
| Bước | SV | Hệ thống | Khoa |
| 1 | Đăng nhập | Kiểm tra tài khoản + điều kiện |  |
| 2 | Xem danh sách hướng | Lọc hướng đang mở | Công bố hướng |
| 3 | Chọn hướng | Kiểm tra hợp lệ |  |
| 4 | Chọn/nhập nguyện vọng GVHD | Lưu thứ tự nếu áp dụng |  |
| 5 | Xác nhận gửi | Ghi thời gian + trạng thái |  |
| 6 |  | Khóa khi hết hạn | Xem thống kê |

P151: Các hướng ví dụ trong đề án gồm: phát triển phần mềm, phát triển ứng dụng game, kiểm thử phần mềm, thuật toán và học máy, thiết kế và quản trị mạng. Đây là danh mục tham khảo; danh mục chính thức phải do Khoa cung cấp. 
P152: Giai đoạn 2 – Phân công GVHD
P153: Đây là module quan trọng nhất. Mục tiêu là biến thao tác Excel thủ công thành một cơ chế tạo phương án có tham số, có kiểm tra ràng buộc, có giải thích và cho phép cán bộ Khoa điều chỉnh trước khi chốt.

## Table 12
| Tham số | Mục đích | Trạng thái |
| Số lượng SV/GV | Giới hạn hoặc sức chứa | Cần Khoa xác nhận |
| Hệ số chức danh/năng lực | Quy đổi tải hướng dẫn | Cần Khoa xác nhận |
| Phù hợp hướng | Đảm bảo đúng chuyên môn | Cần xây dựng thang điểm |
| Nguyện vọng SV | Ưu tiên GV mong muốn | Đã nêu trong yêu cầu |
| GPA | Ưu tiên khi GV quá tải | Cần xác nhận chính thức |
| Đăng ký trước | Xử lý đồng hạng | Cần xác nhận |
| Cân bằng tải | Không dồn SV | Yêu cầu |
| Điều chỉnh tay | Xử lý trường hợp đặc biệt | Bắt buộc |

P155: Luồng thuật toán nghiệp vụ đề xuất
P156: Khóa dữ liệu đăng ký.
P157: Lấy danh sách SV chưa phân công và danh sách GV có thể hướng dẫn.
P158: Tạo tập GV ứng viên theo hướng/chuyên môn và điều kiện tham gia.
P159: Tính mức phù hợp cho từng cặp SV–GV theo trọng số cấu hình.
P160: Loại phương án làm GV vượt tải.
P161: Xếp/ghép SV–GV nhằm ưu tiên phù hợp hướng, nguyện vọng và cân bằng tải.
P162: Nếu một GV quá nhiều nguyện vọng, áp dụng tiêu chí ưu tiên đã cấu hình; GPA chỉ được dùng khi Khoa xác nhận.
P163: Sinh phương án cùng điểm/tiêu chí giải thích.
P164: Khoa điều chỉnh thủ công nếu cần.
P165: Kiểm tra lại toàn bộ ràng buộc và chốt.
P166: Nguyên tắc tải giảng viên
P167: Các hệ số 1, 1,2, 1,3, 2 được thầy nêu như ví dụ, không được hard-code. Thiết kế nên lưu một trường hệ số năng lực/tải trong cấu hình của từng đợt hoặc cấu hình GV. Khi Khoa thay đổi quy định, chỉ cần thay tham số.
P168: Ví dụ mô hình khái niệm: Tải sử dụng của GV = tổng tải quy đổi của các SV được phân / sức chứa tải của GV. Công thức thực tế phải lấy từ quy định hoặc xác nhận của Khoa.
P169: Giai đoạn 3 – Thống nhất đề tài và lập đề cương
P170: Sau khi chốt GVHD, GV gặp SV để trao đổi.
P171: GV và SV thống nhất tên đề tài, phạm vi và nội dung.
P172: GV/SV cập nhật đề tài lên hệ thống.
P173: Lập đề cương theo form của Khoa.
P174: Đề cương thể hiện tối thiểu: mục tiêu, phạm vi, nội dung, công cụ, thời gian và kế hoạch từng giai đoạn.
P175: Khoa tạo lịch duyệt và nhóm/người duyệt theo bộ môn hoặc cơ chế được xác nhận.
P176: Người duyệt đánh giá tính phù hợp, ý nghĩa, phạm vi và mức khả thi.
P177: Nếu chưa đạt, hệ thống ghi cụ thể yêu cầu sửa.
P178: GV/SV sửa và gửi lại; hệ thống lưu phiên bản.
P179: Khi đạt, hồ sơ được duyệt/chốt và xuất biểu mẫu để in, ký, nộp Khoa.

## Table 13
| Trạng thái đề cương | Chuyển bởi | Điều kiện |
| Nháp | GV/SV | Đang soạn |
| Chờ duyệt | GV/SV | Đã gửi |
| Đang duyệt | Người duyệt | Đang xem xét |
| Yêu cầu sửa | Người duyệt | Có nhận xét |
| Đã sửa – chờ duyệt | GV/SV | Đã cập nhật |
| Đã duyệt | Người có quyền | Đạt |
| Đã chốt | Khoa | Hoàn tất hồ sơ |

P181: Giai đoạn 4 – Hướng dẫn và quản lý tiến độ
P182: Hệ thống không chỉ lưu file mà phải phản ánh lộ trình thực hiện theo đề cương. GV tạo nhiệm vụ, deadline, yêu cầu sản phẩm và nhận xét; SV thực hiện, nộp minh chứng và phản hồi.

## Table 14
| Đối tượng | Chức năng |
| GVHD | Tạo kế hoạch/nhiệm vụ; deadline; nhận bài; nhận xét; yêu cầu sửa; đánh giá; xác nhận hoàn thành; ghi buổi hướng dẫn. |
| SV | Xem kế hoạch; cập nhật trạng thái; nộp sản phẩm; ghi tiến độ; xem phản hồi; nộp lại. |
| Khoa | Theo dõi toàn đợt; lọc SV/GV chậm; xem đánh giá; kiểm tra mốc. |


## Table 15
| Trạng thái nhiệm vụ | Ý nghĩa |
| Chưa bắt đầu | Đã giao nhưng SV chưa thực hiện |
| Đang thực hiện | SV đang làm |
| Đã nộp | SV gửi sản phẩm |
| Yêu cầu sửa | GV yêu cầu điều chỉnh |
| Đã hoàn thành | GV xác nhận đạt |
| Quá hạn | Vượt deadline chưa hoàn thành |

P186: Đánh giá theo giai đoạn
P187: Mỗi mốc đánh giá liên kết với kế hoạch/đề cương đã duyệt. Số mốc, tiêu chí và trọng số phải cấu hình được để tránh hard-code.

## Table 16
| Thành phần | Dữ liệu lưu |
| Mốc đánh giá | Tên mốc, thời gian, mục tiêu |
| Tiêu chí | Tên, mô tả, trọng số nếu có |
| Điểm/nhận xét | Giá trị, nhận xét, người đánh giá |
| Minh chứng | File/link nếu yêu cầu |
| Lịch sử | Thời gian, người thao tác, phiên bản |

P190: Giai đoạn 5 – Xét điều kiện bảo vệ
P191: Hệ thống tổng hợp danh sách SV cuối giai đoạn hướng dẫn.
P192: GVHD xác nhận đồng ý/không đồng ý cho bảo vệ.
P193: Khoa kiểm tra tình trạng học vụ/nợ học phần từ nguồn dữ liệu được xác nhận.
P194: SV thiếu điều kiện được đưa vào trạng thái phù hợp: chưa được duyệt, bảo lưu hoặc trạng thái đặc biệt.
P195: Nếu quy định cho phép phản biện trước nhưng chưa bảo vệ, phải có trạng thái riêng.
P196: SV bảo lưu kỳ trước khi quay lại phải được liên kết hồ sơ cũ và kiểm tra điều kiện mới.
P197: Khoa chốt danh sách SV được bảo vệ thực tế.

## Table 17
| Trạng thái | Ý nghĩa |
| Chờ xác nhận GVHD | GV chưa đưa ra quyết định |
| Đủ điều kiện | Đủ các kiểm tra và được phép bảo vệ |
| Chưa được duyệt | Thiếu điều kiện/xác nhận |
| Bảo lưu | Chuyển sang kỳ sau theo quy định |
| Được phản biện nhưng chưa bảo vệ | Trạng thái đặc biệt nếu Khoa áp dụng |
| Đủ điều kiện sau bổ sung | Đã hoàn thiện điều kiện sau lần kiểm tra trước |

P199: Thành lập hội đồng và phân SV
P200: Lấy danh sách SV ở trạng thái được bảo vệ.
P201: Xác định quy mô hội đồng theo tham số/quyết định.
P202: Tính số hội đồng cần lập.
P203: Tạo hội đồng và gắn chức vụ: chủ tịch, thư ký, ủy viên... theo quyết định.
P204: Kiểm tra xung đột GVHD–SV.
P205: Chia SV vào các hội đồng tương đối đều.
P206: Phân SV cho thành viên phản biện theo quy tắc.
P207: Khoa điều chỉnh thủ công nếu cần.
P208: Chốt hội đồng và lịch bảo vệ.

## Table 18
| Ràng buộc | Hệ thống xử lý |
| GVHD – SV | Không cho GVHD chấm/ngồi hội đồng của SV mình hướng dẫn theo quy tắc đã xác nhận. |
| Trùng lịch | Không cho GV/hội đồng/phòng có lịch trùng. |
| Sức chứa | Cảnh báo/chặn khi vượt quy mô. |
| Thiếu thành viên | Không cho chốt nếu thiếu thành phần bắt buộc. |
| SV chưa đủ điều kiện | Không cho đưa vào danh sách bảo vệ chính thức. |
| Điểm thiếu | Không cho chốt khi thiếu điểm bắt buộc. |

P210: Phản biện
P211: Mỗi SV được phân phản biện theo quy tắc của Khoa.
P212: Loại GV bị xung đột.
P213: GV phản biện xem đề tài, đề cương và tài liệu được phép.
P214: GV nhập nhận xét và điểm theo form.
P215: Hệ thống lưu người chấm, thời điểm và lịch sử sửa nếu được phép.
P216: Khoa xuất Excel theo mẫu.
P218: Giai đoạn 6 – Ngày bảo vệ và chấm điểm
P219: Ngày bảo vệ cần có giao diện riêng cho từng SV. Giao diện hiển thị đề tài, hội đồng, các thành phần điểm và form nhập nhận xét/điểm theo đúng quy định.

## Table 19
| Vai trò | Thao tác |
| Chủ tịch | Điều hành; xem tổng quan; xác nhận kết quả hội đồng nếu được phân quyền. |
| Thư ký | Quản lý danh sách, biên bản, tổng hợp dữ liệu. |
| Ủy viên | Nhập điểm/nhận xét theo mẫu. |
| Khoa | Theo dõi và xử lý điều chỉnh có thẩm quyền. |

P221: Đề án mô tả việc xác định số buổi bảo vệ, thời gian, sắp xếp thứ tự SV theo từng buổi và có thể tự động sắp xếp theo alphabet tên + họ đệm. Đây là quy tắc cần đưa vào cấu hình nếu Khoa xác nhận áp dụng. 
P222: Về điểm, ý kiến nghiệp vụ nêu điểm quá trình và điểm bảo vệ theo tỷ lệ 40%–60%, trong đó điểm bảo vệ được tổng hợp từ các thành viên. Tuy nhiên công thức chính thức, thành phần và trọng số phải được xác nhận bằng quy định/biểu mẫu trước khi khóa trong hệ thống.
P223: 3.5.11. Xuất kết quả và kết thúc đợt
P224: Tổng hợp điểm từng SV.
P225: Sinh danh sách kết quả theo hội đồng.
P226: Sinh danh sách điểm theo lớp.
P227: Sinh danh sách điểm quá trình + điểm bảo vệ của toàn đợt.
P228: Xuất Excel theo mẫu.
P229: Xuất PDF/biểu mẫu nếu cần để in, ký, nộp.
P230: Khoa xác nhận hoàn tất.
P231: Đóng đợt và khóa dữ liệu quan trọng.
P232: Lưu audit toàn bộ thay đổi.
P235: 1.3.3. Đặc tả yêu cầu chức năng

## Table 20
| ID | Tên | Actor | Mô tả |
| FR-01 | Đăng nhập | Tất cả | Xác thực tài khoản và xác định role. |
| FR-02 | Phân quyền RBAC | Khoa/Admin | Cấp quyền theo role, không hard-code. |
| FR-03 | Tạo đợt đồ án | Khoa | Tạo đợt và phạm vi khóa/lớp. |
| FR-04 | Thiết lập kế hoạch | Khoa | Cấu hình giai đoạn và mốc thời gian. |
| FR-05 | Khóa/mở giai đoạn | Khoa | Điều khiển trạng thái từng giai đoạn. |
| FR-06 | Quản lý sinh viên | Khoa | Import/xem/tìm kiếm SV thuộc phạm vi. |
| FR-07 | Quản lý giảng viên | Khoa | Thông tin, chuyên môn, năng lực hướng dẫn. |
| FR-08 | Quản lý hướng | Khoa/GV theo quyền | Tạo hướng và thông tin chuyên môn. |
| FR-09 | SV đăng ký hướng | SV | Đăng ký hướng và nguyện vọng GV. |
| FR-10 | Khóa đăng ký | Khoa | Khóa dữ liệu sau hạn. |
| FR-11 | Tính phương án phân công | Khoa | Sinh phương án theo tham số tải, hướng, nguyện vọng và ưu tiên. |
| FR-12 | Điều chỉnh phân công | Khoa | Đổi GV cho SV bằng tay; kiểm tra lại ràng buộc. |
| FR-13 | Chốt phân công | Khoa | Chốt kết quả khi không vi phạm ràng buộc. |
| FR-14 | Thông báo phân công | Hệ thống | Thông báo GV và SV. |
| FR-15 | Quản lý đề tài | GV/SV theo quyền | Tạo/chỉnh sửa/chốt đề tài. |
| FR-16 | Lập đề cương | GV/SV | Nhập theo form cấu trúc. |
| FR-17 | Duyệt đề tài/đề cương | Khoa | Duyệt hoặc yêu cầu sửa. |
| FR-18 | Quản lý phiên bản đề cương | Hệ thống | Lưu lịch sử sửa/chốt. |
| FR-19 | Chốt hồ sơ đề tài | Khoa | Chốt hồ sơ chính thức. |
| FR-20 | Tạo kế hoạch hướng dẫn | GVHD | Tạo mốc/nhiệm vụ theo đề cương. |
| FR-21 | Giao nhiệm vụ | GVHD | Giao việc và deadline. |
| FR-22 | Cập nhật tiến độ | SV | Cập nhật trạng thái và minh chứng. |
| FR-23 | Nhận xét hướng dẫn | GVHD | Nhận xét và yêu cầu sửa. |
| FR-24 | Ghi buổi hướng dẫn | GVHD | Lưu lịch sử buổi gặp/nội dung. |
| FR-25 | Đánh giá giai đoạn | GVHD/Khoa | Đánh giá theo form. |
| FR-26 | Xác nhận cho bảo vệ | GVHD | Đồng ý/không đồng ý cho SV bảo vệ. |
| FR-27 | Kiểm tra điều kiện học vụ | Khoa/Hệ thống | Kiểm tra theo nguồn dữ liệu được xác nhận. |
| FR-28 | Lọc danh sách bảo vệ | Khoa | Tách đủ điều kiện, bảo lưu, chưa duyệt, đặc biệt. |
| FR-29 | Tạo hội đồng | Khoa | Tạo theo quy mô/chức vụ. |
| FR-30 | Phân thành viên hội đồng | Khoa | Gán GV vào hội đồng. |
| FR-31 | Kiểm tra xung đột | Hệ thống | Chặn/cảnh báo xung đột. |
| FR-32 | Phân SV vào hội đồng | Khoa/Hệ thống | Chia tương đối đều. |
| FR-33 | Điều chỉnh hội đồng | Khoa | Điều chỉnh SV/GV bằng tay. |
| FR-34 | Phân phản biện | Khoa/Hệ thống | Phân SV cho thành viên phản biện. |
| FR-35 | Lập lịch bảo vệ | Khoa | Gán ngày/giờ/phòng/hội đồng/SV. |
| FR-36 | Nhập nhận xét phản biện | GV phản biện | Nhập form nhận xét. |
| FR-37 | Nhập điểm bảo vệ | Hội đồng | Nhập điểm thành phần. |
| FR-38 | Tổng hợp điểm hội đồng | Hệ thống/Thư ký | Tính theo công thức xác nhận. |
| FR-39 | Tính điểm cuối | Hệ thống | Tính theo cấu hình/quy định. |
| FR-40 | Chốt điểm | Khoa/HĐ | Khóa điểm sau xác nhận. |
| FR-41 | Công bố điểm | Khoa | Công bố theo mốc. |
| FR-42 | Xuất Excel | Khoa/HĐ | Xuất danh sách và điểm. |
| FR-43 | Xuất PDF/biểu mẫu | Khoa | Xuất để in/ký. |
| FR-44 | Báo cáo thống kê | Khoa | Thống kê SV/GV/hướng/đề tài/tiến độ/điểm. |
| FR-45 | Audit log | Admin/Khoa | Lưu lịch sử thao tác quan trọng. |

P238: 1.3.4. Các quy tắc nghiệp vụ ràng buộc 

## Table 21
| ID | Chủ đề | Mức độ | Quy tắc |
| BR-01 | Phạm vi quản lý | Đã nêu | Hệ thống tập trung cho Khoa CNTT. |
| BR-02 | Đơn vị quản lý | Đã nêu | Khoa CNTT là đơn vị quản lý trực tiếp; bộ môn không mặc nhiên có quyền toàn hệ thống. |
| BR-03 | Đăng ký theo hướng | Đã nêu | SV đăng ký hướng trước khi được phân GVHD. |
| BR-04 | Nguyện vọng GV | Đã nêu | Phiếu đăng ký có thông tin GVHD mong muốn. |
| BR-05 | Cân bằng tải | Đã nêu | Phân công phải xét số lượng SV/GV và năng lực/chức danh. |
| BR-06 | Ưu tiên khi quá tải | Cần xác nhận | GPA được nêu là tiêu chí cần xem xét; tiêu chí chính thức do Khoa chốt. |
| BR-07 | Điều chỉnh thủ công | Đã nêu | Khoa có quyền chỉnh phương án tự động. |
| BR-08 | Đề tài sau phân công | Đã nêu | GV + SV thống nhất đề tài rồi cập nhật. |
| BR-09 | Đề cương bắt buộc | Đã nêu | Đề tài phải có đề cương theo form. |
| BR-10 | Duyệt đề cương | Đã nêu | Khoa/người được giao quyền duyệt. |
| BR-11 | Yêu cầu sửa | Đã nêu | Nếu chưa phù hợp phải ghi yêu cầu sửa. |
| BR-12 | Chốt hồ sơ | Đã nêu | Hồ sơ đạt được chốt và có thể xuất/in ký. |
| BR-13 | Theo lộ trình | Đã nêu | Hướng dẫn bám kế hoạch/đề cương. |
| BR-14 | Đánh giá giai đoạn | Đã nêu | Sau các giai đoạn cần có đánh giá. |
| BR-15 | GVHD xác nhận bảo vệ | Đã nêu | SV phải được GVHD xác nhận theo quy trình. |
| BR-16 | Lọc danh sách | Đã nêu | Khoa lọc danh sách đủ điều kiện trước khi lập HĐ. |
| BR-17 | Bảo lưu | Đã nêu | Có thể có SV bảo lưu và xử lý ở kỳ sau. |
| BR-18 | Xung đột HĐ | Đã nêu | GVHD không ngồi hội đồng của SV mình hướng dẫn theo quy tắc áp dụng. |
| BR-19 | Chia HĐ cân bằng | Đã nêu | SV được chia tương đối đều. |
| BR-20 | Điều chỉnh HĐ | Đã nêu | Khoa được điều chỉnh sau tự động. |
| BR-21 | Tính điểm | Cần xác nhận | Điểm bảo vệ tổng hợp từ thành viên theo công thức chính thức. |
| BR-22 | Tỷ lệ 40/60 | Cần xác nhận | Ý kiến thầy nêu 40%–60%; phải xác nhận bằng quy định. |
| BR-23 | Công bố điểm | Đã nêu | Chỉ công bố sau khi quy trình hoàn tất. |
| BR-24 | Sửa sau chốt | Cần xác nhận | Chỉ role đặc biệt được sửa và phải audit. |

P241: 1.3.5. Yêu cầu người dùng (User Stories & Acceptance Criteria) 
P242: User Stories

## Table 22
| ID | Chức năng | User Story |
| US-01 | Đăng nhập | Là người dùng, tôi muốn đăng nhập để hệ thống xác định đúng vai trò và quyền. |
| US-02 | Đăng ký hướng | Là SV, tôi muốn chọn hướng và nguyện vọng GVHD để Khoa có dữ liệu phân công. |
| US-03 | Phân công GVHD | Là cán bộ Khoa, tôi muốn hệ thống đề xuất phân công theo tham số để giảm thao tác Excel. |
| US-04 | Quản lý đề tài | Là GV/SV, tôi muốn thống nhất và cập nhật đề tài để tạo hồ sơ chính thức. |
| US-05 | Duyệt đề cương | Là người duyệt, tôi muốn duyệt hoặc yêu cầu sửa để kiểm soát chất lượng đề cương. |
| US-06 | Hướng dẫn | Là GVHD, tôi muốn giao nhiệm vụ và phản hồi để theo dõi tiến độ SV. |
| US-07 | Đánh giá | Là GV/Khoa, tôi muốn đánh giá theo mốc để có điểm/nhận xét quá trình. |
| US-08 | Xét bảo vệ | Là Khoa, tôi muốn lọc điều kiện để chỉ SV hợp lệ vào danh sách chính thức. |
| US-09 | Hội đồng | Là Khoa, tôi muốn tự động chia hội đồng nhưng có thể chỉnh tay. |
| US-10 | Phản biện/chấm | Là thành viên HĐ, tôi muốn xem tài liệu và nhập nhận xét/điểm. |
| US-11 | Kết quả | Là Khoa, tôi muốn tổng hợp và xuất kết quả để ký, nộp và công bố. |

P244: Acceptance Criteria trọng yếu

## Table 23
| ID | Chức năng | Tiêu chí chấp nhận |
| AC-01 | Đăng ký | SV phải đủ điều kiện, đợt đang mở và chưa bị khóa. |
| AC-02 | Nguyện vọng | Nếu Khoa cho phép, SV chọn GV hợp lệ và hệ thống lưu thứ tự. |
| AC-03 | Phân công | Không chốt nếu GV vượt giới hạn tải cấu hình. |
| AC-04 | Chỉnh phân công | Khoa có thể đổi GV trước khi chốt. |
| AC-05 | Kiểm tra lại | Sau đổi phải kiểm tra lại toàn bộ ràng buộc. |
| AC-06 | Đề cương | Không chốt khi thiếu trường bắt buộc. |
| AC-07 | Duyệt | Người duyệt chọn Đạt/Yêu cầu sửa; yêu cầu sửa phải có nhận xét. |
| AC-08 | Tiến độ | SV không thể hoàn thành cuối cùng nếu chưa có xác nhận GV theo quy trình. |
| AC-09 | Bảo vệ | SV chưa được GV xác nhận hoặc chưa đủ điều kiện học vụ không vào danh sách chính. |
| AC-10 | Xung đột | Không cho GVHD ngồi/chấm SV mình hướng dẫn theo quy tắc. |
| AC-11 | Hội đồng | SV chia tương đối đều và Khoa được chỉnh. |
| AC-12 | Điểm | Không chốt khi thiếu thành phần bắt buộc. |
| AC-13 | Công thức | Lấy từ cấu hình/quy định đã xác nhận. |
| AC-14 | Công bố | SV chỉ xem điểm sau trạng thái Công bố. |
| AC-15 | Audit | Sửa điểm sau chốt phải ghi người, thời gian, trước/sau và lý do. |

P247: CHƯƠNG 2. THIẾT KẾ HỆ THỐNG
P248: 2.1. Biểu đồ Ca sử dụng (Use Case Diagram)
P249: 2.1.1. Sơ đồ Use Case tổng quát và danh sách Use Case 

## Table 24
| STT | Tác nhân | Mô tả | Use Case chính |
| 1 | Người dùng | Tên gọi chung cho mọi người dùng đã có tài khoản (Sinh viên, Giảng viên, Khoa/Giáo vụ, Thành viên Hội đồng, Admin) khi thực hiện đăng nhập. | UC01 |
| 2 | Admin | Quản trị kỹ thuật: cấp và quản lý tài khoản, phân quyền RBAC, giám sát nhật ký hệ thống (Audit Log). | UC02, UC03 |
| 3 | Khoa/Giáo vụ | Điều phối toàn bộ đợt đồ án: quản lý dữ liệu SV/GV/hướng, tạo đợt và kế hoạch, phân công GVHD, duyệt và chốt hồ sơ đề tài, xét điều kiện bảo vệ, lập Hội đồng, phân phản biện, lập lịch, chốt và công bố điểm, xuất báo cáo. | UC04 – UC08, UC10, UC13, UC18 – UC21, UC24, UC25 |
| 4 | Sinh viên | Đăng ký hướng và nguyện vọng GVHD, thống nhất đề tài, lập đề cương, cập nhật tiến độ, nộp báo cáo/minh chứng, tra cứu lịch bảo vệ và xem điểm. | UC09, UC11, UC12, UC15 |
| 5 | GVHD | Vai trò của giảng viên khi hướng dẫn sinh viên: thống nhất đề tài, giao nhiệm vụ, nhận xét và đánh giá tiến độ, xác nhận điều kiện cho sinh viên bảo vệ. | UC11, UC14, UC16, UC17 |
| 6 | GV duyệt đề cương | Giảng viên trong nhóm duyệt đề cương theo bộ môn do Khoa phân công; xem xét và ra quyết định Đạt/Yêu cầu sửa (tác nhân phụ của UC13). | UC13 |
| 7 | GV phản biện | Giảng viên được phân công đọc đồ án, viết nhận xét và nhập điểm phản biện. | UC22 |
| 8 | Thành viên Hội đồng | Chủ tịch, Thư ký, Ủy viên: chấm điểm và nhận xét trực tiếp trong buổi bảo vệ; Thư ký tổng hợp biên bản; Chủ tịch xác nhận kết quả hội đồng khi được phân quyền. | UC23 (và tham gia UC24) |
| 9 | Hệ thống | Tác nhân phụ thực hiện các bước tự động: kiểm tra ràng buộc, tính phương án phân công, chia hội đồng, tính điểm, gửi thông báo, ghi audit. | Nhiều UC |

[embedded image relationship: rId9]
P252: 2.1.2. Phân rã Use Case theo nhóm chức năng 
P253: Nhóm 1 — Chung & Quản trị hệ thống:

## Table 25
| ID | Use Case | Actor chính | FR |
| UC01 | Đăng nhập hệ thống | Người dùng | FR-01 |
| UC02 | Quản lý tài khoản và phân quyền RBAC | Admin | FR-02 |
| UC03 | Giám sát lịch sử hệ thống (Audit Log) | Admin | FR-45 |

P255: Nhóm 2 — Quản lý dữ liệu & đợt đồ án:

## Table 26
| ID | Use Case | Actor chính | FR |
| UC04 | Quản lý danh sách sinh viên | Khoa/Giáo vụ | FR-06 |
| UC05 | Quản lý danh sách giảng viên | Khoa/Giáo vụ | FR-07 |
| UC06 | Quản lý danh mục hướng nghiên cứu | Khoa/Giáo vụ | FR-08 |
| UC07 | Quản lý đợt đồ án | Khoa/Giáo vụ | FR-03 |
| UC08 | Quản lý kế hoạch và các giai đoạn | Khoa/Giáo vụ | FR-04, FR-05 |

P257: Nhóm 3 — Đăng ký & phân công GVHD:

## Table 27
| ID | Use Case | Actor chính | FR |
| UC09 | Đăng ký hướng đồ án và nguyện vọng GVHD | Sinh viên | FR-09, FR-10 |
| UC10 | Phân công và điều chỉnh GVHD | Khoa/Giáo vụ | FR-11, FR-12, FR-13 |

P259: Nhóm 4 — Đề tài & đề cương:

## Table 28
| ID | Use Case | Actor chính | FR |
| UC11 | Quản lý và thống nhất đề tài | Sinh viên / GVHD | FR-15 |
| UC12 | Lập và cập nhật đề cương | Sinh viên | FR-16 |
| UC13 | Duyệt đề tài/đề cương và chốt hồ sơ | Khoa/Giáo vụ | FR-17, FR-19 |

P261: Nhóm 5 — Hướng dẫn & tiến độ:

## Table 29
| ID | Use Case | Actor chính | FR |
| UC14 | Lập kế hoạch và giao nhiệm vụ hướng dẫn | GVHD | FR-20, FR-21 |
| UC15 | Cập nhật tiến độ và nộp báo cáo/minh chứng | Sinh viên | FR-22 |
| UC16 | Theo dõi, nhận xét và đánh giá tiến độ | GVHD | FR-23, FR-24, FR-25 |
| UC17 | Xác nhận điều kiện cho sinh viên bảo vệ | GVHD | FR-26 |

P263: Nhóm 6 — Xét điều kiện & tổ chức bảo vệ:

## Table 30
| ID | Use Case | Actor chính | FR |
| UC18 | Xét điều kiện bảo vệ | Khoa/Giáo vụ | FR-28 |
| UC19 | Thành lập và quản lý Hội đồng bảo vệ | Khoa/Giáo vụ | FR-29, FR-30, FR-32, FR-33 |
| UC20 | Phân công giảng viên phản biện | Khoa/Giáo vụ | FR-34 |
| UC21 | Lập và quản lý lịch bảo vệ | Khoa/Giáo vụ | FR-35 |

P265: Nhóm 7 — Phản biện, chấm điểm & kết quả:

## Table 31
| ID | Use Case | Actor chính | FR |
| UC22 | Nhận xét và phản biện đề tài | GV phản biện | FR-36 |
| UC23 | Nhập điểm tại buổi bảo vệ | Thành viên Hội đồng | FR-37 |
| UC24 | Tổng hợp, chốt và công bố kết quả | Khoa/Giáo vụ | FR-40, FR-41 |

P267: Nhóm 8 — Báo cáo và xuất dữ liệu:

## Table 32
| ID | Use Case | Actor chính | FR |
| UC25 | Báo cáo và xuất dữ liệu | Khoa/Giáo vụ | FR-42, FR-43, FR-44 |

P270: 2.1.3. Đặc tả chi tiết các Use Case 
P271: UC01: Đăng nhập hệ thống

## Table 33
| Mã Use Case | UC01 |
| Tên Use Case | Đăng nhập hệ thống |
| Tác nhân chính | Người dùng (Sinh viên, Giảng viên, Khoa/Giáo vụ, Thành viên Hội đồng, Admin) |
| Tác nhân phụ | Không có |
| FR liên quan | FR-01 – Đăng nhập |
| Mô tả tóm tắt | Người dùng xác thực bằng tài khoản được cấp để hệ thống xác định đúng vai trò và quyền truy cập. Sinh viên đăng nhập lần đầu bằng mã sinh viên với mật khẩu mặc định, bắt buộc đổi mật khẩu và cập nhật Email, số điện thoại. |
| Điều kiện trước (Pre-condition) | Tài khoản của người dùng đã được cấp (UC02 hoặc tạo cùng danh sách SV/GV) và đang ở trạng thái hoạt động. |
| Điều kiện sau (Post-condition) | Phiên làm việc được tạo; người dùng được chuyển đến giao diện và chức năng tương ứng với vai trò.Sự kiện đăng nhập được ghi vào nhật ký hệ thống (UC03). |
| Luồng sự kiện chính | Người dùng mở trang đăng nhập và nhập tên đăng nhập (mã sinh viên/mã giảng viên) cùng mật khẩu.Hệ thống kiểm tra thông tin xác thực và trạng thái tài khoản.Hệ thống xác định vai trò và tập quyền của người dùng theo cơ chế RBAC (UC02).Nếu là sinh viên đăng nhập lần đầu (mật khẩu mặc định là mã sinh viên): hệ thống yêu cầu đổi mật khẩu và cập nhật Email, số điện thoại.Hệ thống tạo phiên làm việc và chuyển người dùng đến giao diện theo vai trò.Hệ thống ghi nhận lịch sử đăng nhập. |
| Luồng rẽ nhánh / ngoại lệ | Sai tên đăng nhập hoặc mật khẩu: hệ thống thông báo đăng nhập không thành công, không tiết lộ trường nào sai.Tài khoản bị khóa hoặc vô hiệu hóa: hệ thống từ chối đăng nhập và hướng dẫn liên hệ Khoa/Admin.Nhập sai liên tiếp quá số lần quy định: hệ thống tạm khóa tài khoản trong một khoảng thời gian (đề xuất bổ sung; số lần và thời gian do Admin cấu hình).Sinh viên chưa đổi mật khẩu mặc định ở lần đăng nhập đầu: hệ thống không cho vào các chức năng khác cho đến khi hoàn tất.Người dùng có nhiều vai trò (ví dụ giảng viên vừa là GVHD, vừa là GV phản biện, thành viên Hội đồng): hệ thống hiển thị các chức năng theo từng vai trò được cấp. |

[embedded image relationship: rId10]
P274: UC02: Quản lý tài khoản và phân quyền RBAC

## Table 34
| Mã Use Case | UC02 |
| Tên Use Case | Quản lý tài khoản và phân quyền RBAC |
| Tác nhân chính | Admin |
| Tác nhân phụ | Không có |
| FR liên quan | FR-02 – Phân quyền RBAC |
| Mô tả tóm tắt | Admin tạo, cập nhật, khóa/mở khóa tài khoản và cấp quyền cho các vai trò (Admin, Khoa, Giảng viên, Sinh viên, Hội đồng) theo mô hình RBAC; quyền được cấu hình chứ không hard-code trong hệ thống. |
| Điều kiện trước (Pre-condition) | Admin đã đăng nhập (UC01) và có quyền quản trị tài khoản. |
| Điều kiện sau (Post-condition) | Tài khoản, vai trò và phân quyền mới được lưu và có hiệu lực.Mọi thay đổi được ghi vào nhật ký hệ thống (UC03). |
| Luồng sự kiện chính | Admin mở chức năng quản lý tài khoản và phân quyền.Admin xem/tìm kiếm danh sách tài khoản theo vai trò, trạng thái.Admin tạo tài khoản mới (lẻ hoặc hàng loạt từ danh sách sinh viên/giảng viên đã có) và gán vai trò cho tài khoản.Admin cấu hình quyền cho từng vai trò: chức năng được phép và phạm vi dữ liệu (theo đợt, theo đối tượng).Admin có thể khóa/mở khóa tài khoản hoặc đặt lại mật khẩu về mặc định.Admin xác nhận lưu; hệ thống kiểm tra tính hợp lệ, cập nhật và ghi audit. |
| Luồng rẽ nhánh / ngoại lệ | Tên đăng nhập/mã tài khoản đã tồn tại: hệ thống từ chối và yêu cầu nhập lại.Thao tác làm mất vai trò Admin cuối cùng của hệ thống: hệ thống chặn và cảnh báo.Thay đổi quyền của vai trò đang có người sử dụng: quyền mới áp dụng từ phiên đăng nhập kế tiếp.Tài khoản đang giữ vai trò trong đợt đang hoạt động (ví dụ thành viên Hội đồng đã chốt): hệ thống cảnh báo trước khi khóa/gỡ vai trò. |

[embedded image relationship: rId11]
P277: UC03: Giám sát lịch sử hệ thống (Audit Log)

## Table 35
| Mã Use Case | UC03 |
| Tên Use Case | Giám sát lịch sử hệ thống (Audit Log) |
| Tác nhân chính | Admin |
| Tác nhân phụ | Khoa/Giáo vụ (xem nhật ký nghiệp vụ trong phạm vi được cấp quyền) |
| FR liên quan | FR-45 – Audit log |
| Mô tả tóm tắt | Xem, tra cứu và lọc nhật ký các thao tác quan trọng trong hệ thống (đăng nhập, thay đổi phân quyền, thay đổi mốc kế hoạch, chỉnh phân công, sửa điểm sau chốt...) nhằm bảo đảm bảo mật, minh bạch và truy vết. |
| Điều kiện trước (Pre-condition) | Người dùng đã đăng nhập và có quyền xem nhật ký hệ thống. |
| Điều kiện sau (Post-condition) | Người dùng xem được thông tin nhật ký theo bộ lọc; dữ liệu nhật ký không bị thay đổi. |
| Luồng sự kiện chính | Admin (hoặc Khoa trong phạm vi quyền) mở chức năng Audit Log.Người dùng chọn tiêu chí lọc: khoảng thời gian, người thao tác, loại thao tác, đối tượng bị tác động (đợt, sinh viên, hội đồng, điểm...).Hệ thống hiển thị danh sách bản ghi theo thứ tự thời gian.Người dùng mở một bản ghi để xem chi tiết: người thực hiện, thời điểm, thao tác, giá trị trước/sau và lý do (nếu có).Người dùng có thể xuất kết quả tra cứu phục vụ kiểm tra (nếu được cấp quyền). |
| Luồng rẽ nhánh / ngoại lệ | Không có bản ghi thỏa bộ lọc: hệ thống hiển thị thông báo không có dữ liệu.Người dùng không có quyền với loại nhật ký được chọn: hệ thống ẩn hoặc từ chối truy cập.Yêu cầu sửa hoặc xóa bản ghi nhật ký: hệ thống không cung cấp chức năng này (nhật ký chỉ được ghi thêm). |

P279: UC04: Quản lý danh sách sinh viên
[embedded image relationship: rId12]

## Table 36
| Mã Use Case | UC04 |
| Tên Use Case | Quản lý danh sách sinh viên |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | Không có |
| FR liên quan | FR-06 – Quản lý sinh viên |
| Mô tả tóm tắt | Khoa nhập (import), xem, tìm kiếm và cập nhật danh sách sinh viên đủ điều kiện làm đồ án thuộc phạm vi đợt (khóa/lớp/hệ đào tạo). |
| Điều kiện trước (Pre-condition) | Khoa/Giáo vụ đã đăng nhập và có quyền quản lý sinh viên.Đã xác định phạm vi khóa/lớp/hệ đào tạo của đợt cần nhập danh sách. |
| Điều kiện sau (Post-condition) | Danh sách sinh viên đủ điều kiện của đợt được lưu trong hệ thống, sẵn sàng cho các bước đăng ký (UC09) và phân công (UC10).Tài khoản mặc định cho sinh viên mới được tạo (UC02). |
| Luồng sự kiện chính | Khoa chọn đợt đồ án và mở chức năng quản lý danh sách sinh viên.Khoa tải lên tệp Excel danh sách sinh viên đủ điều kiện theo mẫu.Hệ thống kiểm tra định dạng, các trường bắt buộc, trùng mã sinh viên và hiển thị bản xem trước cùng danh sách lỗi (nếu có).Khoa xác nhận nhập; hệ thống lưu danh sách và tạo tài khoản mặc định cho sinh viên mới.Khoa xem, tìm kiếm, lọc danh sách theo lớp, khóa, hệ đào tạo, trạng thái.Khi cần, Khoa thêm, sửa hoặc loại sinh viên khỏi đợt bằng thao tác riêng lẻ; hệ thống ghi audit. |
| Luồng rẽ nhánh / ngoại lệ | Tệp sai mẫu hoặc thiếu cột bắt buộc: hệ thống từ chối và chỉ rõ lỗi.Mã sinh viên trùng trong tệp hoặc đã tồn tại trong đợt: hệ thống cảnh báo, cho Khoa chọn bỏ qua hoặc cập nhật.Sinh viên đang thuộc một đợt khác còn hiệu lực: hệ thống cảnh báo để Khoa xử lý.Loại sinh viên đã có đăng ký/phân công: hệ thống cảnh báo tác động và yêu cầu xác nhận. |

[embedded image relationship: rId13]
P281: UC05: Quản lý danh sách giảng viên

## Table 37
| Mã Use Case | UC05 |
| Tên Use Case | Quản lý danh sách giảng viên |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | Không có |
| FR liên quan | FR-07 – Quản lý giảng viên |
| Mô tả tóm tắt | Khoa quản lý thông tin giảng viên tham gia đợt: thông tin cá nhân, bộ môn, chức danh, chuyên môn/hướng phụ trách và năng lực hướng dẫn (số lượng tối đa, hệ số tải) phục vụ phân công GVHD và lập Hội đồng. |
| Điều kiện trước (Pre-condition) | Khoa/Giáo vụ đã đăng nhập và có quyền quản lý giảng viên. |
| Điều kiện sau (Post-condition) | Thông tin giảng viên được lưu, sẵn sàng cho UC10 (phân công GVHD), UC13 (nhóm duyệt), UC19 – UC20 (Hội đồng, phản biện). |
| Luồng sự kiện chính | Khoa mở chức năng quản lý danh sách giảng viên.Khoa thêm giảng viên mới (nhập từng người hoặc import Excel): mã giảng viên, họ tên, bộ môn, chức danh, thông tin liên hệ.Khoa gán chuyên môn/hướng mà giảng viên có thể hướng dẫn (từ danh mục hướng ở UC06).Khoa thiết lập năng lực hướng dẫn: số lượng sinh viên tối đa (quota) và hệ số chức danh/tải theo cấu hình của đợt hoặc của giảng viên.Hệ thống kiểm tra hợp lệ và lưu thông tin.Khoa xem, tìm kiếm, cập nhật hoặc ngưng tham gia đối với giảng viên khi cần; hệ thống ghi audit. |
| Luồng rẽ nhánh / ngoại lệ | Mã giảng viên trùng: hệ thống từ chối và yêu cầu nhập lại.Giảm quota thấp hơn số sinh viên đã được phân công: hệ thống cảnh báo và không cho lưu cho đến khi điều chỉnh phân công.Giảng viên đang hướng dẫn hoặc đang trong Hội đồng của đợt hoạt động: hệ thống chỉ cho ngưng tham gia sau khi xử lý, không cho xóa cứng. |

[embedded image relationship: rId14]
P283: UC06: Quản lý danh mục hướng nghiên cứu

## Table 38
| Mã Use Case | UC06 |
| Tên Use Case | Quản lý danh mục hướng nghiên cứu |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | Không có |
| FR liên quan | FR-08 – Quản lý hướng |
| Mô tả tóm tắt | Khoa quản lý danh mục các hướng làm đồ án (ví dụ: phát triển phần mềm, ứng dụng game, kiểm thử phần mềm, thuật toán và học máy, thiết kế và quản trị mạng) mà sinh viên sẽ chọn khi đăng ký. |
| Điều kiện trước (Pre-condition) | Người dùng đã đăng nhập và có quyền quản lý danh mục hướng (Khoa hoặc giảng viên được cấp quyền). |
| Điều kiện sau (Post-condition) | Danh mục hướng được cập nhật; các hướng đang mở được hiển thị cho sinh viên đăng ký ở UC09. |
| Luồng sự kiện chính | Khoa mở chức năng quản lý danh mục hướng.Khoa thêm hướng mới: tên hướng, mô tả chuyên môn, trạng thái.Khoa (hoặc giảng viên được cấp quyền) cập nhật thông tin hướng và liên kết các giảng viên phù hợp với hướng.Khoa chọn các hướng áp dụng (mở) cho đợt.Hệ thống kiểm tra hợp lệ, lưu danh mục và ghi audit. |
| Luồng rẽ nhánh / ngoại lệ | Tên hướng trùng: hệ thống từ chối và yêu cầu đặt tên khác.Xóa hoặc đóng hướng đã có sinh viên đăng ký: hệ thống không cho xóa, chỉ cho ngưng sử dụng cho đợt sau.Hướng chưa có giảng viên phù hợp: hệ thống cảnh báo trước khi mở cho sinh viên đăng ký. |

[embedded image relationship: rId15]
P286: UC07: Quản lý đợt đồ án

## Table 39
| Mã Use Case | UC07 |
| Tên Use Case | Quản lý đợt đồ án |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | Không có |
| FR liên quan | FR-03 – Tạo đợt đồ án |
| Mô tả tóm tắt | Khoa tạo và quản lý đợt đồ án theo từng hệ đào tạo (Chính quy, Liên thông, Từ xa): thông tin đợt, đối tượng khóa/lớp, thời gian; điều khiển vòng đời của đợt qua các trạng thái từ Nháp đến Đã kết thúc hoặc Hủy. |
| Điều kiện trước (Pre-condition) | Cán bộ Khoa đã đăng nhập và được phân quyền tạo/quản lý đợt. |
| Điều kiện sau (Post-condition) | Đợt đồ án được lưu với trạng thái tương ứng; sau khi đóng đợt, các dữ liệu quan trọng bị khóa.Các thay đổi được ghi audit (UC03). |
| Luồng sự kiện chính | Khoa chọn chức năng tạo đợt đồ án mới.Khoa nhập tên đợt, hệ đào tạo, khóa/lớp/đối tượng, thời gian bắt đầu – kết thúc.Hệ thống lưu đợt ở trạng thái “Nháp”.Khoa hoàn thiện cấu hình: danh sách sinh viên (UC04), giảng viên (UC05), hướng (UC06), kế hoạch và các giai đoạn (UC08).Hệ thống kiểm tra cấu hình bắt buộc đã đủ; đợt chuyển sang “Sắp mở”, sau đó “Đang đăng ký” khi đến thời điểm mở.Theo tiến trình nghiệp vụ, đợt lần lượt chuyển sang “Đang thực hiện” (đã phân công), “Đang bảo vệ” (đang tổ chức bảo vệ).Sau khi kết quả đã được công bố (UC24) và Khoa xác nhận hoàn tất, Khoa đóng đợt: trạng thái “Đã kết thúc”, hệ thống khóa các dữ liệu quan trọng. |
| Luồng rẽ nhánh / ngoại lệ | Cấu hình bắt buộc chưa đủ: hệ thống không cho mở đợt và chỉ ra các mục còn thiếu.Thay đổi thông tin/mốc quan trọng sau khi đã mở đợt: chỉ người có quyền được thực hiện và bắt buộc ghi audit.Khoa hủy đợt: trạng thái “Hủy”, dữ liệu chỉ được xem và lưu lịch sử.Đóng đợt khi còn dữ liệu chưa hoàn tất (ví dụ điểm chưa chốt): hệ thống cảnh báo/chặn đóng đợt. |

[embedded image relationship: rId16]
P288: UC08: Quản lý kế hoạch và các giai đoạn

## Table 40
| Mã Use Case | UC08 |
| Tên Use Case | Quản lý kế hoạch và các giai đoạn |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | Không có |
| FR liên quan | FR-04 – Thiết lập kế hoạchFR-05 – Khóa/mở giai đoạn |
| Mô tả tóm tắt | Khoa thiết lập bảng kế hoạch của đợt (các giai đoạn và mốc thời gian) và điều khiển khóa/mở từng giai đoạn. Chức năng “khóa/mở giai đoạn” là một luồng bên trong Use Case này, không tách thành Use Case riêng. |
| Điều kiện trước (Pre-condition) | Đợt đồ án đã được tạo (UC07) và đang ở trạng thái cho phép chỉnh sửa kế hoạch.Khoa đã đăng nhập và có quyền quản lý kế hoạch. |
| Điều kiện sau (Post-condition) | Kế hoạch các giai đoạn và mốc thời gian được lưu; trạng thái khóa/mở của từng giai đoạn được áp dụng cho các Use Case liên quan. |
| Luồng sự kiện chính | Khoa mở kế hoạch của đợt.Khoa thiết lập thời gian bắt đầu – kết thúc cho các mốc: đăng ký hướng, phân công, đề tài, đề cương, duyệt, hướng dẫn, đánh giá, xét bảo vệ, hội đồng, bảo vệ, công bố điểm.Hệ thống kiểm tra các mốc không mâu thuẫn (thứ tự hợp lý, nằm trong thời gian của đợt).Khoa lưu kế hoạch.Trong quá trình thực hiện, Khoa khóa hoặc mở từng giai đoạn (thủ công hoặc theo mốc thời gian); hệ thống áp dụng trạng thái này cho các chức năng liên quan (ví dụ: khóa đăng ký ở UC09, khóa nộp báo cáo ở UC15).Hệ thống ghi audit các thay đổi mốc và trạng thái giai đoạn. |
| Luồng rẽ nhánh / ngoại lệ | Mốc thời gian mâu thuẫn (mốc sau nằm trước mốc trước, ngoài thời gian đợt): hệ thống báo lỗi và không cho lưu.Thay đổi mốc sau khi đã mở đợt: chỉ người có quyền được thực hiện và bắt buộc ghi audit.Mở lại giai đoạn đã khóa: hệ thống yêu cầu xác nhận và ghi audit; các Use Case liên quan cho phép thao tác trở lại. |

[embedded image relationship: rId17]
P290: UC09: Đăng ký hướng đồ án và nguyện vọng GVHD

## Table 41
| Mã Use Case | UC09 |
| Tên Use Case | Đăng ký hướng đồ án và nguyện vọng GVHD |
| Tác nhân chính | Sinh viên |
| Tác nhân phụ | Khoa/Giáo vụ (khóa đăng ký, xem thống kê) |
| FR liên quan | FR-09 – SV đăng ký hướngFR-10 – Khóa đăng ký |
| Mô tả tóm tắt | Sinh viên chọn một hướng làm đồ án và đăng ký tối đa 03 nguyện vọng GVHD (NV1, NV2, NV3) theo thứ tự ưu tiên trong thời gian đợt đang mở đăng ký;. Dữ liệu đăng ký được khóa khi hết hạn. |
| Điều kiện trước (Pre-condition) | Sinh viên đã đăng nhập, thuộc danh sách đủ điều kiện của đợt.Đợt đang ở trạng thái “Đang đăng ký” và giai đoạn đăng ký chưa bị khóa. |
| Điều kiện sau (Post-condition) | Đăng ký hướng và nguyện vọng GVHD của sinh viên được lưu cùng thời gian và trạng thái, sẵn sàng cho việc phân công GVHD (UC10). |
| Luồng sự kiện chính | Sinh viên đăng nhập hệ thống (UC01).Hệ thống kiểm tra điều kiện và hiển thị danh sách hướng đồ án đang mở.Sinh viên chọn 01 hướng làm đồ án.Hệ thống hiển thị danh sách giảng viên phù hợp với hướng đã chọn.Sinh viên chọn tối đa 03 nguyện vọng GVHD theo thứ tự ưu tiên; Sinh viên xác nhận gửi đăng ký.Hệ thống ghi nhận thời gian, trạng thái và cho phép sinh viên chỉnh sửa đến khi hết hạn.Khi hết hạn đăng ký (hoặc Khoa khóa giai đoạn theo UC08), hệ thống khóa dữ liệu đăng ký; Khoa xem thống kê đăng ký. |
| Luồng rẽ nhánh / ngoại lệ | Sinh viên chưa đủ điều kiện: hệ thống từ chối và thông báo lý do.Đợt đã đóng đăng ký hoặc dữ liệu đã bị khóa: hệ thống không cho nhập/sửa nguyện vọng.Giảng viên được chọn không hợp lệ (không thuộc hướng đã chọn hoặc không tham gia đợt): hệ thống cảnh báo và yêu cầu chọn lại. |

[embedded image relationship: rId18]
P293: UC10: Phân công và điều chỉnh GVHD

## Table 42
| Mã Use Case | UC10 |
| Tên Use Case | Phân công và điều chỉnh GVHD |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | Không có |
| FR liên quan | FR-11 – Tính phương án phân côngFR-12 – Điều chỉnh phân côngFR-13 – Chốt phân côngFR-14 – Thông báo phân công (FR hỗ trợ, bổ sung – xem mục 5) |
| Mô tả tóm tắt | Khoa thực hiện phân công GVHD bán tự động trong một Use Case gồm các bước liên tục: chạy phân công tự động, xem phương án, điều chỉnh thủ công nếu cần, kiểm tra ràng buộc và chốt phương án. Các bước này là luồng bên trong Use Case, không tách thành các Use Case riêng. |
| Điều kiện trước (Pre-condition) | Dữ liệu đăng ký hướng và nguyện vọng đã được khóa (UC09).Khoa đã cấu hình quota, hệ số tải của từng giảng viên (UC05) và các tham số phân công. |
| Điều kiện sau (Post-condition) | Danh sách phân công GVHD chính thức được lưu.Hệ thống gửi thông báo (Email) cho giảng viên và mở quyền xem kết quả cho sinh viên. |
| Luồng sự kiện chính | Khoa xác nhận khóa dữ liệu đăng ký và thiết lập/kiểm tra tham số phân công (sức chứa, hệ số tải, trọng số).Chạy phân công tự động: hệ thống lấy danh sách sinh viên chưa phân công và giảng viên có thể hướng dẫn, tạo tập giảng viên ứng viên theo hướng/chuyên môn, tính mức phù hợp cho từng cặp SV–GV theo trọng số cấu hình.Hệ thống xếp theo NV1; nếu giảng viên vượt quota thì áp dụng tiêu chí ưu tiên đã cấu hình (GPA khi Khoa xác nhận, đăng ký trước để xử lý đồng hạng), sau đó xét NV2, NV3; sinh viên trượt hết nguyện vọng được xếp tự động theo hướng đồ án.Xem phương án: hệ thống hiển thị phương án kèm điểm/tiêu chí giải thích, tải sử dụng của từng giảng viên và danh sách sinh viên còn lại cần Khoa xử lý thủ công.Điều chỉnh thủ công nếu cần: Khoa đổi giảng viên cho sinh viên (trường hợp đặc biệt hoặc sinh viên chưa được phân).Kiểm tra ràng buộc: sau mỗi thay đổi, hệ thống kiểm tra lại toàn bộ ràng buộc (vượt tải, sinh viên chưa được phân công, hướng phù hợp...).Chốt phương án: khi không còn vi phạm, Khoa chốt; hệ thống lưu kết quả phân công chính thức.Hệ thống gửi thông báo cho giảng viên và mở quyền xem kết quả cho sinh viên. |
| Luồng rẽ nhánh / ngoại lệ | Giảng viên vượt tải sau khi điều chỉnh: hệ thống cảnh báo và không cho chốt cho đến khi xử lý.Còn sinh viên chưa được phân công sau cả 3 nguyện vọng và phân tự động: hệ thống đưa vào danh sách để Khoa phân công thủ công.Khoa muốn tính lại phương án: hệ thống yêu cầu xác nhận và thay thế phương án nháp (không ảnh hưởng dữ liệu đã chốt).Cần thay đổi sau khi đã chốt: chỉ người có quyền thực hiện, bắt buộc ghi audit và thông báo lại cho các bên (đề xuất; cần Khoa xác nhận).Tiêu chí GPA/ưu tiên chưa được Khoa xác nhận: hệ thống không áp dụng tiêu chí đó khi tính phương án. |

[embedded image relationship: rId19]
P295: UC11: Quản lý và thống nhất đề tài

## Table 43
| Mã Use Case | UC11 |
| Tên Use Case | Quản lý và thống nhất đề tài |
| Tác nhân chính | Sinh viên / GVHD |
| Tác nhân phụ | Khoa/Giáo vụ (theo dõi/chốt theo quyền) |
| FR liên quan | FR-15 – Quản lý đề tài |
| Mô tả tóm tắt | Sau khi được phân công, GVHD và sinh viên trao đổi, thống nhất tên đề tài, phạm vi và nội dung; hai bên cùng tạo/cập nhật/xác nhận đề tài trên hệ thống. Use Case này gộp việc cập nhật đề tài của sinh viên và việc thống nhất/chỉnh sửa/xác nhận đề tài của GVHD. |
| Điều kiện trước (Pre-condition) | Sinh viên đã có GVHD được chốt (UC10).Giai đoạn đề tài đang mở. |
| Điều kiện sau (Post-condition) | Đề tài ở trạng thái đã thống nhất giữa GVHD và sinh viên, sẵn sàng để lập đề cương (UC12) và đưa vào quy trình duyệt (UC13).Lịch sử chỉnh sửa đề tài được lưu. |
| Luồng sự kiện chính | GVHD và sinh viên gặp trao đổi để thống nhất tên đề tài, phạm vi và nội dung.Sinh viên hoặc GVHD tạo/cập nhật thông tin đề tài trên hệ thống (tên đề tài, phạm vi, nội dung chính, hướng).Bên còn lại xem đề tài; có thể chỉnh sửa hoặc đề nghị điều chỉnh.Hai bên lặp lại bước 2 – 3 cho đến khi thống nhất; GVHD xác nhận đề tài.Hệ thống lưu đề tài với trạng thái đã thống nhất và ghi lịch sử chỉnh sửa (người, thời gian, nội dung). |
| Luồng rẽ nhánh / ngoại lệ | Hết hạn giai đoạn đề tài mà chưa thống nhất: hệ thống cảnh báo Khoa để can thiệp.Đề tài đã được duyệt và chốt hồ sơ (UC13): hệ thống không cho sửa trực tiếp; chỉ Khoa có quyền mở lại theo quy trình và ghi audit. |

[embedded image relationship: rId20]
P297: UC12: Lập và cập nhật đề cương

## Table 44
| Mã Use Case | UC12 |
| Tên Use Case | Lập và cập nhật đề cương |
| Tác nhân chính | Sinh viên |
| Tác nhân phụ | GVHD (xem/góp ý theo quy trình); Khoa/Giáo vụ (theo dõi theo quyền) |
| FR liên quan | FR-16 – Lập đề cươngFR-18 – Quản lý phiên bản đề cương (FR hỗ trợ, bổ sung – xem mục 5) |
| Mô tả tóm tắt | Sinh viên lập đề cương theo form cấu trúc của Khoa (mục tiêu, phạm vi, nội dung, công cụ, thời gian, kế hoạch từng giai đoạn), nộp để duyệt và cập nhật lại theo yêu cầu sửa; hệ thống lưu các phiên bản đề cương. |
| Điều kiện trước (Pre-condition) | Đề tài đã được GVHD và sinh viên thống nhất (UC11).Giai đoạn đề cương đang mở. |
| Điều kiện sau (Post-condition) | Đề cương ở trạng thái “Chờ duyệt” (khi nộp) hoặc “Đã sửa – chờ duyệt” (khi nộp lại), sẵn sàng cho UC13.Mỗi lần nộp/sửa được lưu thành một phiên bản. |
| Luồng sự kiện chính | Sinh viên mở đề cương của đề tài đã thống nhất; trạng thái ban đầu là “Nháp”.Sinh viên nhập nội dung theo form của Khoa: mục tiêu, phạm vi, nội dung, công cụ, thời gian và kế hoạch từng giai đoạn.Hệ thống lưu bản nháp; sinh viên và GVHD có thể xem, góp ý và chỉnh sửa nhiều lần trước khi nộp.Sinh viên xác nhận nộp; hệ thống kiểm tra các trường bắt buộc và chuyển trạng thái sang “Chờ duyệt”.Nếu người duyệt yêu cầu sửa (UC13): sinh viên/GVHD cập nhật đề cương theo nhận xét và nộp lại; trạng thái chuyển sang “Đã sửa – chờ duyệt”.Hệ thống lưu phiên bản mới cho mỗi lần nộp/sửa; khi hồ sơ được chốt, hệ thống cho xuất đề cương ra PDF theo mẫu chuẩn. |
| Luồng rẽ nhánh / ngoại lệ | Thiếu trường bắt buộc: hệ thống không cho nộp và đánh dấu các trường còn thiếu.Muốn thay đổi sau khi đã nộp và đang chờ duyệt: đề cương quay về trạng thái “Nháp” và phải nộp lại; hệ thống lưu vết phiên bản.Đã hết hạn nộp đề cương: hệ thống không cho nộp, thông báo cho sinh viên và Khoa.Đề cương đã chốt: chỉ Khoa có quyền mới được mở lại và ghi audit. |

P299: UC13: Duyệt đề tài/đề cương và chốt hồ sơ
[embedded image relationship: rId21]

## Table 45
| Mã Use Case | UC13 |
| Tên Use Case | Duyệt đề tài/đề cương và chốt hồ sơ |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | GV duyệt đề cương; Sinh viên; GVHD (theo phạm vi quy trình) |
| FR liên quan | FR-17 – Duyệt đề tài/đề cươngFR-19 – Chốt hồ sơ đề tàiFR-18 – Quản lý phiên bản đề cương (FR hỗ trợ, bổ sung – xem mục 5) |
| Mô tả tóm tắt | Khoa tổ chức nhóm giảng viên duyệt đề cương (theo bộ môn hoặc cơ chế được xác nhận); người duyệt đánh giá và chọn Đạt hoặc Yêu cầu sửa; khi đạt, Khoa chốt hồ sơ đề tài chính thức và xuất biểu mẫu để in, ký, nộp. |
| Điều kiện trước (Pre-condition) | Đề cương ở trạng thái “Chờ duyệt” hoặc “Đã sửa – chờ duyệt” (UC12).Khoa đã tạo nhóm giảng viên duyệt và lịch duyệt. |
| Điều kiện sau (Post-condition) | Đề cương ở trạng thái “Đã duyệt” hoặc “Yêu cầu sửa” kèm nhận xét cụ thể.Hồ sơ đề tài ở trạng thái “Đã chốt” và có thể xuất PDF để ký, nộp Khoa. |
| Luồng sự kiện chính | Khoa tạo nhóm giảng viên duyệt đề cương (chia theo bộ môn chuyên môn) và thiết lập lịch duyệt.Hệ thống phân đề cương “Chờ duyệt” về đúng nhóm phụ trách theo hướng/bộ môn.Thành viên nhóm duyệt mở đề cương trên hệ thống; trạng thái chuyển sang “Đang duyệt”.Người duyệt đánh giá tính phù hợp, ý nghĩa, phạm vi và mức khả thi.Nếu đạt: người duyệt chọn “Đạt”; đề cương chuyển sang “Đã duyệt”.Nếu chưa đạt: người duyệt chọn “Yêu cầu sửa” và ghi cụ thể nội dung cần sửa; hệ thống thông báo GVHD/sinh viên, quay lại UC12, mỗi lần sửa được lưu thành phiên bản mới.Khi đề cương đạt, Khoa kiểm tra và chốt hồ sơ đề tài chính thức; trạng thái “Đã chốt”.Hệ thống xuất biểu mẫu để sinh viên in, xin chữ ký GVHD và nộp về Khoa. |
| Luồng rẽ nhánh / ngoại lệ | Yêu cầu sửa không có nhận xét: hệ thống không cho lưu.Quá hạn duyệt mà nhóm chưa phản hồi: hệ thống cảnh báo Khoa để can thiệp hoặc phân công lại người duyệt.Hồ sơ thiếu trường bắt buộc: hệ thống không cho chốt hồ sơ.Cần thay đổi sau khi đã chốt: chỉ Khoa có quyền mở lại và bắt buộc ghi audit. |

[embedded image relationship: rId22]
P301: UC14: Lập kế hoạch và giao nhiệm vụ hướng dẫn

## Table 46
| Mã Use Case | UC14 |
| Tên Use Case | Lập kế hoạch và giao nhiệm vụ hướng dẫn |
| Tác nhân chính | GVHD |
| Tác nhân phụ | Sinh viên (nhận nhiệm vụ) |
| FR liên quan | FR-20 – Tạo kế hoạch hướng dẫnFR-21 – Giao nhiệm vụ |
| Mô tả tóm tắt | GVHD lập kế hoạch hướng dẫn gồm các mốc theo đề cương đã duyệt, giao nhiệm vụ kèm yêu cầu sản phẩm và deadline cho sinh viên; kế hoạch phản ánh đúng lộ trình thực hiện theo đề cương. |
| Điều kiện trước (Pre-condition) | Hồ sơ đề tài/đề cương của sinh viên đã được chốt (UC13).Đợt đang ở giai đoạn hướng dẫn. |
| Điều kiện sau (Post-condition) | Kế hoạch hướng dẫn và các nhiệm vụ được lưu ở trạng thái “Chưa bắt đầu”; sinh viên xem được và nhận thông báo. |
| Luồng sự kiện chính | GVHD chọn sinh viên được hướng dẫn và mở đề cương đã chốt.GVHD tạo kế hoạch hướng dẫn: các mốc thực hiện bám theo kế hoạch từng giai đoạn trong đề cương.GVHD tạo nhiệm vụ cho từng mốc: tiêu đề, mô tả, yêu cầu sản phẩm nộp, deadline.GVHD giao nhiệm vụ cho sinh viên; hệ thống lưu và thông báo cho sinh viên.Trong quá trình hướng dẫn, GVHD điều chỉnh, bổ sung hoặc hủy nhiệm vụ khi cần; các nhiệm vụ tiếp theo (ví dụ nhiệm vụ tuần kế tiếp) được giao sau khi nhận xét ở UC16. |
| Luồng rẽ nhánh / ngoại lệ | Deadline nằm ngoài giai đoạn hướng dẫn của đợt: hệ thống cảnh báo/chặn.Đề cương chưa được chốt: hệ thống không cho tạo kế hoạch hướng dẫn.Sửa hoặc hủy nhiệm vụ đã có bài nộp: hệ thống cảnh báo và yêu cầu xác nhận; ghi lại lịch sử thay đổi. |

P303: UC15: Cập nhật tiến độ và nộp báo cáo/minh chứng

## Table 47
| Mã Use Case | UC15 |
| Tên Use Case | Cập nhật tiến độ và nộp báo cáo/minh chứng |
| Tác nhân chính | Sinh viên |
| Tác nhân phụ | GVHD (nhận bài nộp, phản hồi) |
| FR liên quan | FR-22 – Cập nhật tiến độ |
| Mô tả tóm tắt | Sinh viên xem kế hoạch/nhiệm vụ, cập nhật trạng thái thực hiện, nộp báo cáo tiến độ hàng tuần, mã nguồn (source code) và các minh chứng; đến mốc chốt nộp sinh viên tải lên bản đồ án hoàn chỉnh (PDF). |
| Điều kiện trước (Pre-condition) | Đã có kế hoạch/nhiệm vụ được giao (UC14).Đợt đang ở giai đoạn thực hiện đồ án; giai đoạn nộp chưa bị khóa. |
| Điều kiện sau (Post-condition) | Sản phẩm/báo cáo được lưu với thời gian nộp và phiên bản; trạng thái nhiệm vụ được cập nhật (“Đang thực hiện”, “Đã nộp”, “Quá hạn”).GVHD nhận được thông báo có bài nộp mới. |
| Luồng sự kiện chính | Sinh viên xem kế hoạch hướng dẫn, danh sách nhiệm vụ và deadline.Sinh viên cập nhật trạng thái thực hiện (“Đang thực hiện”) và ghi tiến độ.Đến hạn, sinh viên tải lên báo cáo tiến độ, mã nguồn và các minh chứng theo yêu cầu của nhiệm vụ.Hệ thống ghi nhận thời gian nộp, đối chiếu deadline (đúng hạn/trễ hạn) và chuyển trạng thái nhiệm vụ sang “Đã nộp”.Hệ thống thông báo GVHD; sinh viên xem phản hồi của GVHD (UC16).Nếu GVHD yêu cầu sửa: sinh viên nộp lại; hệ thống lưu phiên bản mới.Đến mốc chốt nộp đồ án: sinh viên tải lên tệp đồ án hoàn chỉnh (PDF) để phục vụ nhận xét của GVHD và phản biện. |
| Luồng rẽ nhánh / ngoại lệ | Nộp sau deadline: hệ thống đánh dấu “Quá hạn” và thông báo GVHD.Tệp sai định dạng hoặc vượt dung lượng cho phép: hệ thống từ chối và thông báo lý do.Giai đoạn nộp đã bị khóa: hệ thống không cho nộp và thông báo cho sinh viên.Nhiệm vụ ở trạng thái “Yêu cầu sửa”: sinh viên phải nộp lại trước khi nhiệm vụ được xác nhận hoàn thành. |

P305: UC16: Theo dõi, nhận xét và đánh giá tiến độ
[embedded image relationship: rId23]

## Table 48
| Mã Use Case | UC16 |
| Tên Use Case | Theo dõi, nhận xét và đánh giá tiến độ |
| Tác nhân chính | GVHD |
| Tác nhân phụ | Sinh viên (xem phản hồi); Khoa/Giáo vụ (theo dõi toàn đợt) |
| FR liên quan | FR-23 – Nhận xét hướng dẫnFR-24 – Ghi buổi hướng dẫnFR-25 – Đánh giá giai đoạn |
| Mô tả tóm tắt | GVHD theo dõi tiến độ, xem bài nộp, viết nhận xét hàng tuần, yêu cầu sửa, ghi nhận lịch sử các buổi hướng dẫn và đánh giá theo giai đoạn. Ba hoạt động này thuộc cùng một quá trình theo dõi hướng dẫn nên được gom vào một Use Case. |
| Điều kiện trước (Pre-condition) | Sinh viên đã có nhiệm vụ được giao (UC14) và/hoặc có bài nộp (UC15).Các mốc đánh giá và tiêu chí đã được cấu hình. |
| Điều kiện sau (Post-condition) | Nhận xét, đánh giá và lịch sử buổi hướng dẫn được lưu đầy đủ (thời gian, người thao tác, nội dung, phiên bản).Trạng thái nhiệm vụ được cập nhật; là căn cứ cho việc xác nhận điều kiện bảo vệ (UC17). |
| Luồng sự kiện chính | GVHD xem danh sách sinh viên được hướng dẫn cùng trạng thái nhiệm vụ (lọc theo quá hạn, chờ nhận xét).GVHD mở bài nộp: báo cáo tiến độ, mã nguồn, minh chứng.GVHD viết nhận xét và đánh giá (Đạt/Không đạt/Cần sửa); nếu cần sửa thì yêu cầu sinh viên nộp lại; nếu đạt thì xác nhận “Đã hoàn thành”.GVHD ghi nhận buổi hướng dẫn: thời gian, hình thức, nội dung trao đổi và kết luận.GVHD giao nhiệm vụ cho giai đoạn tiếp theo (UC14).Đến mốc đánh giá, GVHD đánh giá theo giai đoạn: nhập điểm/nhận xét theo các tiêu chí của mốc và đính kèm minh chứng (nếu yêu cầu); Khoa xem được đánh giá theo quyền.Cuối giai đoạn hướng dẫn, GVHD viết nhận xét tổng kết và cho điểm hướng dẫn theo form (nếu Khoa áp dụng).Hệ thống lưu toàn bộ lịch sử thao tác. |
| Luồng rẽ nhánh / ngoại lệ | Sinh viên chưa nộp bài: GVHD không thể xác nhận “Đã hoàn thành”; hệ thống nhắc sinh viên.GVHD chỉnh sửa nhận xét đã lưu: hệ thống lưu lịch sử chỉnh sửa.Mốc đánh giá hoặc tiêu chí chưa cấu hình: hệ thống thông báo để Khoa cấu hình.Sinh viên chậm tiến độ kéo dài: hệ thống cảnh báo GVHD và Khoa (Khoa lọc được sinh viên/giảng viên chậm). |

P307: UC17: Xác nhận điều kiện cho sinh viên bảo vệ
[embedded image relationship: rId24]

## Table 49
| Mã Use Case | UC17 |
| Tên Use Case | Xác nhận điều kiện cho sinh viên bảo vệ |
| Tác nhân chính | GVHD |
| Tác nhân phụ | Khoa/Giáo vụ (nhận kết quả xác nhận) |
| FR liên quan | FR-26 – Xác nhận cho bảo vệ |
| Mô tả tóm tắt | Cuối giai đoạn hướng dẫn, GVHD xem xét toàn bộ quá trình và xác nhận Đồng ý hoặc Không đồng ý cho từng sinh viên được bảo vệ. |
| Điều kiện trước (Pre-condition) | Giai đoạn hướng dẫn kết thúc hoặc đến mốc xét điều kiện bảo vệ (UC08).Có dữ liệu tiến độ và đánh giá của sinh viên (UC15, UC16). |
| Điều kiện sau (Post-condition) | Quyết định của GVHD đối với từng sinh viên được ghi nhận, là đầu vào của UC18. |
| Luồng sự kiện chính | Hệ thống tổng hợp danh sách sinh viên do GVHD hướng dẫn kèm tóm tắt tiến độ (nhiệm vụ hoàn thành, quá hạn, đánh giá các mốc).GVHD xem xét toàn bộ quá trình thực hiện của từng sinh viên.GVHD chọn Đồng ý hoặc Không đồng ý cho sinh viên bảo vệ; nếu không đồng ý thì ghi rõ lý do.Hệ thống lưu quyết định, ghi thời gian và thông báo cho Khoa. |
| Luồng rẽ nhánh / ngoại lệ | GVHD chưa xác nhận trước hạn: hệ thống nhắc lại và có thể chuyển Khoa xử lý.Sinh viên còn nhiệm vụ chưa được xác nhận hoàn thành: hệ thống cảnh báo GVHD trước khi chọn Đồng ý.GVHD thay đổi quyết định trước khi Khoa chốt danh sách: hệ thống cho phép và lưu lịch sử. |

[embedded image relationship: rId25]
P309: UC18: Xét điều kiện bảo vệ

## Table 50
| Mã Use Case | UC18 |
| Tên Use Case | Xét điều kiện bảo vệ |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | GVHD (cung cấp/xác nhận thông tin); Sinh viên (xem trạng thái theo quyền) |
| FR liên quan | FR-28 – Lọc danh sách bảo vệFR-27 – Kiểm tra điều kiện học vụ (FR hỗ trợ, bổ sung – xem mục 5) |
| Mô tả tóm tắt | Khoa tổng hợp danh sách sinh viên cuối giai đoạn hướng dẫn, đối chiếu xác nhận của GVHD và tình trạng học vụ/nợ học phần, phân loại trạng thái và chốt danh sách sinh viên được bảo vệ chính thức của đợt. |
| Điều kiện trước (Pre-condition) | Đã đến mốc xét điều kiện bảo vệ; GVHD đã thực hiện xác nhận (UC17).Có nguồn dữ liệu học vụ được xác nhận để đối chiếu. |
| Điều kiện sau (Post-condition) | Danh sách sinh viên đủ điều kiện bảo vệ chính thức được chốt, sẵn sàng cho việc thành lập Hội đồng (UC19).Sinh viên không đủ điều kiện có trạng thái phù hợp (Chưa được duyệt, Bảo lưu...). |
| Luồng sự kiện chính | Hệ thống tổng hợp danh sách sinh viên đã hoàn thành giai đoạn hướng dẫn cùng quyết định của GVHD.Khoa đối chiếu tình trạng học vụ/nợ học phần từ nguồn dữ liệu được xác nhận (hỗ trợ bởi Hệ thống).Hệ thống lọc và phân loại sinh viên: Đủ điều kiện, Chờ xác nhận GVHD, Chưa được duyệt, Bảo lưu, Được phản biện nhưng chưa bảo vệ (nếu Khoa áp dụng), Đủ điều kiện sau bổ sung.Khoa xem xét các trường hợp đặc biệt (ví dụ bảo lưu kỳ trước quay lại; được phản biện nhưng chưa bảo vệ).Khoa chốt danh sách sinh viên được bảo vệ thực tế của đợt. |
| Luồng rẽ nhánh / ngoại lệ | GVHD chưa xác nhận: sinh viên ở trạng thái “Chờ xác nhận GVHD”, không được đưa vào danh sách chính.Sinh viên không đủ điều kiện học vụ hoặc GVHD không đồng ý: sinh viên ở trạng thái “Chưa được duyệt” hoặc “Bảo lưu”, không vào danh sách bảo vệ chính thức.Sinh viên bảo lưu kỳ trước quay lại: hệ thống liên kết hồ sơ cũ và kiểm tra lại điều kiện mới.Không lấy được dữ liệu học vụ tự động: Khoa nhập/xác nhận thủ công và hệ thống ghi audit (đề xuất; cần Khoa xác nhận nguồn dữ liệu). |

P311: UC19: Thành lập và quản lý Hội đồng bảo vệ
[embedded image relationship: rId26]

## Table 51
| Mã Use Case | UC19 |
| Tên Use Case | Thành lập và quản lý Hội đồng bảo vệ |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | Thành viên Hội đồng; GVHD/Giảng viên (theo vai trò được phân công) |
| FR liên quan | FR-29 – Tạo hội đồngFR-30 – Phân thành viên hội đồngFR-32 – Phân SV vào hội đồngFR-33 – Điều chỉnh hội đồngFR-31 – Kiểm tra xung đột (FR hỗ trợ, bổ sung – xem mục 5) |
| Mô tả tóm tắt | Khoa thành lập các Hội đồng chấm đồ án (3–5 giảng viên/hội đồng) trong một Use Case gồm các bước liên tục: tạo Hội đồng, chọn thành viên, phân bổ sinh viên, kiểm tra cơ cấu, điều chỉnh thủ công và chốt Hội đồng. Không tách thành nhiều Use Case riêng. |
| Điều kiện trước (Pre-condition) | Danh sách sinh viên được bảo vệ đã được chốt (UC18).Danh sách giảng viên và quy mô hội đồng theo tham số/quyết định đã có. |
| Điều kiện sau (Post-condition) | Các Hội đồng, thành viên và danh sách sinh viên theo từng Hội đồng được chốt, sẵn sàng cho phân công phản biện (UC20) và lập lịch (UC21). |
| Luồng sự kiện chính | Khoa xác định quy mô Hội đồng (3–5 giảng viên) theo tham số cấu hình; hệ thống tính số Hội đồng cần lập dựa trên số sinh viên được bảo vệ.Tạo Hội đồng: Khoa tạo các Hội đồng (mã/tên, thời gian dự kiến).Chọn thành viên: Khoa gán giảng viên vào từng Hội đồng và chức vụ Chủ tịch, Thư ký, Ủy viên theo quyết định.Phân bổ sinh viên: hệ thống chia sinh viên vào các Hội đồng theo nguyên tắc tương đối đều (hoặc Khoa phân bổ thủ công).Kiểm tra cơ cấu: hệ thống kiểm tra đủ thành phần bắt buộc, số lượng thành viên, sức chứa và xung đột GVHD–sinh viên.Điều chỉnh thủ công: Khoa điều chỉnh giảng viên/sinh viên giữa các Hội đồng khi cần; hệ thống kiểm tra lại các ràng buộc sau mỗi thay đổi.Chốt Hội đồng: khi đạt yêu cầu, Khoa chốt; hệ thống khóa cơ cấu Hội đồng. |
| Luồng rẽ nhánh / ngoại lệ | Phát hiện xung đột GVHD–sinh viên (GVHD nằm trong Hội đồng chấm sinh viên của mình): hệ thống chặn và yêu cầu phân công lại.Thiếu thành viên bắt buộc (thiếu Chủ tịch/Thư ký) hoặc thiếu số lượng tối thiểu: hệ thống không cho chốt.Số sinh viên vượt quy mô cho phép: hệ thống cảnh báo/chặn.Sinh viên chưa đủ điều kiện: hệ thống không cho đưa vào danh sách bảo vệ chính thức.Cần thay đổi sau khi đã chốt: chỉ người có quyền thực hiện và bắt buộc ghi audit (đề xuất; cần Khoa xác nhận). |

P313: UC20: Phân công giảng viên phản biện
[embedded image relationship: rId27]

## Table 52
| Mã Use Case | UC20 |
| Tên Use Case | Phân công giảng viên phản biện |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | GV phản biện |
| FR liên quan | FR-34 – Phân phản biệnFR-31 – Kiểm tra xung đột (FR hỗ trợ, bổ sung – xem mục 5) |
| Mô tả tóm tắt | Khoa phân công mỗi sinh viên cho giảng viên phản biện theo quy tắc của Khoa, bảo đảm khách quan (GVHD không phản biện sinh viên của mình) và cân bằng khối lượng đồ án giữa các Hội đồng và các thành viên. |
| Điều kiện trước (Pre-condition) | Các Hội đồng đã được thành lập và sinh viên đã được phân vào Hội đồng (UC19). |
| Điều kiện sau (Post-condition) | Mỗi sinh viên có giảng viên phản biện được ghi nhận; giảng viên phản biện xem được hồ sơ được phân (UC22). |
| Luồng sự kiện chính | Khoa mở chức năng phân công phản biện cho đợt/Hội đồng.Hệ thống loại các giảng viên bị xung đột (GVHD của sinh viên đó) khỏi danh sách phản biện khả dụng.Hệ thống đề xuất phân sinh viên cho giảng viên phản biện theo quy tắc đã cấu hình, cân bằng khối lượng giữa các Hội đồng và các thành viên.Khoa xem phương án và điều chỉnh thủ công nếu cần.Hệ thống kiểm tra lại các ràng buộc sau mỗi điều chỉnh.Khoa chốt phân công; hệ thống thông báo cho giảng viên phản biện. |
| Luồng rẽ nhánh / ngoại lệ | Không đủ giảng viên hợp lệ cho một sinh viên (do ràng buộc xung đột): hệ thống cảnh báo và đưa vào danh sách để Khoa xử lý thủ công.Giảng viên bị phân quá nhiều bài phản biện so với mức cân bằng: hệ thống cảnh báo.Phân công vi phạm nguyên tắc GVHD – sinh viên: hệ thống chặn không cho chốt. |

[embedded image relationship: rId28]
P315: UC21: Lập và quản lý lịch bảo vệ

## Table 53
| Mã Use Case | UC21 |
| Tên Use Case | Lập và quản lý lịch bảo vệ |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | Sinh viên; Giảng viên; Thành viên Hội đồng (xem lịch) |
| FR liên quan | FR-35 – Lập lịch bảo vệ |
| Mô tả tóm tắt | Khoa xác định số buổi bảo vệ (Sáng/Chiều), ngày, giờ, phòng cho từng Hội đồng; hệ thống sắp xếp thứ tự sinh viên bảo vệ theo bảng chữ cái (Tên + Họ đệm) nếu Khoa áp dụng, kiểm tra trùng lịch và cho phép Khoa điều chỉnh, chốt và công bố. |
| Điều kiện trước (Pre-condition) | Hội đồng và danh sách sinh viên theo Hội đồng đã được chốt (UC19). |
| Điều kiện sau (Post-condition) | Lịch bảo vệ chính thức (ngày/giờ/phòng/Hội đồng/sinh viên) được chốt; sinh viên, giảng viên và thành viên Hội đồng tra cứu được. |
| Luồng sự kiện chính | Khoa xác định số buổi bảo vệ (Sáng/Chiều), ngày, giờ và phòng cho từng Hội đồng.Hệ thống sắp xếp thứ tự sinh viên bảo vệ trong từng buổi theo bảng chữ cái của Tên + Họ đệm (nếu Khoa xác nhận áp dụng quy tắc này).Hệ thống kiểm tra trùng lịch của giảng viên, Hội đồng và phòng.Khoa xem lịch, điều chỉnh khi cần và chốt lịch.Hệ thống công bố lịch cho các bên liên quan; Khoa có thể xuất lịch ra biểu mẫu (UC25). |
| Luồng rẽ nhánh / ngoại lệ | Trùng lịch giảng viên/Hội đồng/phòng: hệ thống chặn hoặc cảnh báo và yêu cầu điều chỉnh.Số sinh viên vượt sức chứa của buổi/Hội đồng: hệ thống cảnh báo.Thay đổi lịch sau khi đã công bố: hệ thống thông báo lại cho các bên và ghi audit. |

[embedded image relationship: rId29]
P317: UC22: Nhận xét và phản biện đề tài

## Table 54
| Mã Use Case | UC22 |
| Tên Use Case | Nhận xét và phản biện đề tài |
| Tác nhân chính | GV phản biện |
| Tác nhân phụ | Khoa/Giáo vụ (theo dõi, xuất dữ liệu) |
| FR liên quan | FR-36 – Nhập nhận xét phản biện |
| Mô tả tóm tắt | Giảng viên phản biện xem hồ sơ (đề tài, đề cương, đồ án hoàn chỉnh) của các sinh viên được phân công, đọc duyệt, viết nhận xét và nhập điểm phản biện theo form. |
| Điều kiện trước (Pre-condition) | Giảng viên đã được phân công phản biện (UC20).Sinh viên đã nộp đồ án hoàn chỉnh (PDF) ở mốc chốt nộp (UC15).Đang trong mốc thời gian phản biện. |
| Điều kiện sau (Post-condition) | Nhận xét và điểm phản biện của từng sinh viên được lưu cùng người chấm và thời điểm; là đầu vào của UC24. |
| Luồng sự kiện chính | Giảng viên phản biện đăng nhập và xem danh sách sinh viên được phân công.Giảng viên mở hồ sơ và tải đồ án hoàn chỉnh cùng tài liệu được phép xem (đề tài, đề cương).Giảng viên đọc duyệt đồ án.Giảng viên nhập nhận xét và điểm phản biện theo form của Khoa.Giảng viên lưu (nháp) hoặc gửi kết quả phản biện.Hệ thống lưu người chấm, thời điểm và lịch sử sửa (nếu được phép); Khoa theo dõi tiến độ phản biện và xuất Excel theo mẫu. |
| Luồng rẽ nhánh / ngoại lệ | Sinh viên chưa nộp đồ án hoàn chỉnh: hệ thống thông báo giảng viên không thể phản biện, đồng thời cảnh báo Khoa.Thiếu nội dung/điểm bắt buộc: hệ thống không cho gửi.Quá hạn phản biện: hệ thống cảnh báo giảng viên và Khoa.Giảng viên truy cập hồ sơ không được phân công: hệ thống từ chối.Sửa kết quả sau khi đã gửi: chỉ thực hiện khi có quyền và hệ thống lưu lịch sử sửa. |

[embedded image relationship: rId30]
P319: UC23: Nhập điểm tại buổi bảo vệ

## Table 55
| Mã Use Case | UC23 |
| Tên Use Case | Nhập điểm tại buổi bảo vệ |
| Tác nhân chính | Thành viên Hội đồng (Chủ tịch, Thư ký, Ủy viên) |
| Tác nhân phụ | Khoa/Giáo vụ (theo dõi, xử lý điều chỉnh có thẩm quyền) |
| FR liên quan | FR-37 – Nhập điểm bảo vệ |
| Mô tả tóm tắt | Trong ngày bảo vệ, từng thành viên Hội đồng dùng giao diện riêng để xem thông tin sinh viên đang bảo vệ và nhập điểm/nhận xét theo các tiêu chí (rubric); Thư ký quản lý danh sách và biên bản; Chủ tịch điều hành và xác nhận kết quả khi được phân quyền. |
| Điều kiện trước (Pre-condition) | Lịch bảo vệ và danh sách sinh viên theo Hội đồng đã được chốt (UC21).Đợt đang ở trạng thái “Đang bảo vệ”; đang trong ngày/buổi bảo vệ.Thành viên Hội đồng đã đăng nhập. |
| Điều kiện sau (Post-condition) | Điểm thành phần và nhận xét của từng thành viên cho mỗi sinh viên được ghi nhận, sẵn sàng cho tổng hợp ở UC24. |
| Luồng sự kiện chính | Thành viên Hội đồng đăng nhập; hệ thống hiển thị giao diện bảo vệ của Hội đồng mình theo thứ tự sinh viên đã sắp xếp.Thành viên chọn sinh viên đang bảo vệ; hệ thống hiển thị đề tài, thông tin Hội đồng và các thành phần điểm/rubric.Từng thành viên nhập điểm thành phần và nhận xét theo các tiêu chí rubric đã cấu hình.Thư ký quản lý danh sách, ghi biên bản và tổng hợp dữ liệu buổi bảo vệ.Hệ thống ghi nhận điểm theo từng thành viên và từng sinh viên.Chủ tịch xem tổng quan và xác nhận kết quả của Hội đồng (nếu được phân quyền). |
| Luồng rẽ nhánh / ngoại lệ | Điểm nhập ngoài khoảng hợp lệ hoặc thiếu thành phần bắt buộc: hệ thống không cho lưu.Người dùng không thuộc Hội đồng của sinh viên đang bảo vệ: hệ thống không cho truy cập/nhập điểm.GVHD nằm trong Hội đồng chấm sinh viên do mình hướng dẫn: hệ thống không cho chấm (đã bị chặn từ UC19).Sửa điểm sau khi đã gửi trong buổi bảo vệ: thực hiện theo quyền và lưu lịch sử thay đổi. |

P321: UC24: Tổng hợp, chốt và công bố kết quả
[embedded image relationship: rId31]

## Table 56
| Mã Use Case | UC24 |
| Tên Use Case | Tổng hợp, chốt và công bố kết quả |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | Thư ký/Chủ tịch Hội đồng; Sinh viên (xem điểm sau công bố) |
| FR liên quan | FR-40 – Chốt điểmFR-41 – Công bố điểmFR-38 – Tổng hợp điểm hội đồng (FR hỗ trợ, bổ sung – xem mục 5)FR-39 – Tính điểm cuối (FR hỗ trợ, bổ sung – xem mục 5) |
| Mô tả tóm tắt | Tổng hợp điểm từ các thành phần (điểm quá trình/hướng dẫn, điểm phản biện, điểm các thành viên Hội đồng), tính điểm cuối theo công thức cấu hình, kiểm tra, chốt (khóa) điểm và công bố cho sinh viên theo mốc. Bao gồm các bước liên tục: thu thập điểm, tổng hợp/tính kết quả, kiểm tra, chốt điểm, công bố điểm. |
| Điều kiện trước (Pre-condition) | Đã có điểm quá trình/hướng dẫn (UC16), điểm phản biện (UC22) và điểm bảo vệ (UC23).Công thức tính điểm, thành phần và trọng số đã được xác nhận và cấu hình. |
| Điều kiện sau (Post-condition) | Điểm cuối của từng sinh viên được chốt và khóa.Điểm được công bố; sinh viên xem được điểm sau khi ở trạng thái “Công bố”. |
| Luồng sự kiện chính | Thu thập điểm: hệ thống tập hợp điểm quá trình/hướng dẫn, điểm phản biện và điểm của từng thành viên Hội đồng cho mỗi sinh viên.Tổng hợp/tính kết quả: hệ thống tổng hợp điểm Hội đồng và tính điểm cuối theo công thức cấu hình (ví dụ điểm quá trình 40% – điểm bảo vệ 60%, phải theo quy định đã xác nhận).Kiểm tra: hệ thống kiểm tra đủ thành phần điểm bắt buộc; Hội đồng (Thư ký/Chủ tịch) xác nhận kết quả của Hội đồng mình; Khoa rà soát.Chốt điểm: Khoa (cùng Hội đồng) chốt; hệ thống khóa điểm.Công bố điểm: Khoa công bố theo mốc; sinh viên chỉ xem được điểm khi ở trạng thái “Công bố”. |
| Luồng rẽ nhánh / ngoại lệ | Thiếu thành phần điểm bắt buộc: hệ thống không cho chốt và chỉ ra sinh viên/thành phần còn thiếu.Công thức hoặc trọng số chưa được xác nhận/cấu hình: hệ thống không cho tính điểm cuối.Công bố trước khi quy trình hoàn tất hoặc trước mốc công bố: hệ thống chặn.Sửa điểm sau khi đã chốt: chỉ role đặc biệt được thực hiện; hệ thống bắt buộc ghi người, thời gian, giá trị trước/sau và lý do (UC03). |

P323: UC25: Báo cáo và xuất dữ liệu
[embedded image relationship: rId32]

## Table 57
| Mã Use Case | UC25 |
| Tên Use Case | Báo cáo và xuất dữ liệu |
| Tác nhân chính | Khoa/Giáo vụ |
| Tác nhân phụ | Thành viên Hội đồng (xuất dữ liệu theo quyền) |
| FR liên quan | FR-42 – Xuất ExcelFR-43 – Xuất PDF/biểu mẫuFR-44 – Báo cáo thống kê |
| Mô tả tóm tắt | Khoa xuất danh sách và điểm ra Excel, xuất biểu mẫu/biên bản ra PDF để in, ký, nộp và xem các báo cáo thống kê tổng hợp. Ba chức năng này được tổ chức thành một Use Case thay vì tách thành các Use Case nghiệp vụ riêng. |
| Điều kiện trước (Pre-condition) | Người dùng đã đăng nhập và có quyền xuất/xem báo cáo.Dữ liệu cần xuất đã tồn tại trong hệ thống (kết quả điểm chính thức chỉ có sau UC24). |
| Điều kiện sau (Post-condition) | Tệp Excel/PDF theo mẫu được tạo và tải về, hoặc báo cáo thống kê được hiển thị.Thao tác xuất dữ liệu được ghi audit. |
| Luồng sự kiện chính | Người dùng chọn loại chức năng: xuất Excel (FR-42), xuất PDF/biểu mẫu (FR-43) hoặc xem báo cáo thống kê (FR-44).Người dùng chọn đợt và bộ lọc (theo Hội đồng, theo lớp, toàn đợt...).Xuất Excel: hệ thống sinh danh sách theo mẫu (kết quả theo Hội đồng, điểm theo lớp, điểm quá trình + điểm bảo vệ toàn đợt, danh sách phản biện...).Xuất PDF/biểu mẫu: hệ thống sinh biểu mẫu để in, ký, nộp (đề cương, biên bản Hội đồng, kết quả bảo vệ).Xem báo cáo thống kê: hệ thống hiển thị thống kê về sinh viên, giảng viên, hướng, đề tài, tiến độ và điểm.Người dùng tải tệp về hoặc xem báo cáo; hệ thống ghi nhật ký xuất dữ liệu. |
| Luồng rẽ nhánh / ngoại lệ | Không có dữ liệu theo bộ lọc: hệ thống thông báo không có dữ liệu để xuất.Dữ liệu điểm chưa chốt: hệ thống cảnh báo hoặc đánh dấu kết quả là chưa chính thức.Biểu mẫu chưa được cấu hình: hệ thống thông báo để Khoa bổ sung.Người dùng không có quyền xuất loại dữ liệu này: hệ thống từ chối. |

[embedded image relationship: rId33]
P328: 2.2. Biểu đồ hoạt động (Activity Diagram)
P329: 2.3.1. Sơ đồ hoạt động cho từng workflow nghiệp vụ chính 
[embedded image relationship: rId34]
P331: 4.3.2. Ma trận ACT – Use Case 

## Table 58
| ACT | Use Case | Nội dung |
| ACT01 | UC07, UC08 | Quản lý đợt & kế hoạch |
| ACT02 | UC09 | Đăng ký hướng & nguyện vọng GVHD |
| ACT03 | UC10 | Phân công & điều chỉnh GVHD |
| ACT04 | UC11, UC12, UC13 | Quản lý đề tài & đề cương |
| ACT05 | UC14, UC15, UC16, UC17 | Hướng dẫn & cập nhật tiến độ |
| ACT06 | UC18 | Xét điều kiện bảo vệ |
| ACT07 | UC19, UC20 | Thành lập Hội đồng & phân công phản biện |
| ACT08 | UC21 | Lập & quản lý lịch bảo vệ |
| ACT09 | UC22, UC23 | Phản biện & chấm điểm bảo vệ |
| ACT10 | UC24, UC25 | Tổng hợp & công bố kết quả |

P334: ACT01 – Quản lý đợt & kế hoạch

## Table 59
| Use Case liên quan | UC07, UC08 |
| Mục tiêu | Tạo, cấu hình, lập kế hoạch, mở/đóng và quản lý trạng thái của một đợt đồ án. |
| Swimlane đề nghị | Khoa/Giáo vụ; Hệ thống |

[embedded image relationship: rId35]
P336: ACT02 – Đăng ký hướng & nguyện vọng GVHD

## Table 60
| Use Case liên quan | UC09 |
| Mục tiêu | Cho phép sinh viên chọn hướng và đăng ký nguyện vọng GVHD trong thời gian được mở. |
| Swimlane đề nghị | Sinh viên; Hệ thống |

[embedded image relationship: rId36]
P338: ACT03 – Phân công & điều chỉnh GVHD

## Table 61
| Use Case liên quan | UC10 |
| Mục tiêu | Tính phương án phân công GVHD, kiểm tra ràng buộc, cho phép Khoa điều chỉnh và chốt phân công. |
| Swimlane đề nghị | Khoa/Giáo vụ; Hệ thống |

[embedded image relationship: rId37]
P340: ACT04 – Quản lý đề tài & đề cương

## Table 62
| Use Case liên quan | UC11, UC12, UC13 |
| Mục tiêu | Thống nhất đề tài, lập đề cương, duyệt/sửa, quản lý phiên bản và chốt hồ sơ. |
| Swimlane đề nghị | Sinh viên; GVHD; Nhóm giảng viên duyệt; Khoa/Giáo vụ; Hệ thống |

[embedded image relationship: rId38]
P342: ACT05 – Hướng dẫn & cập nhật tiến độ

## Table 63
| Use Case liên quan | UC14, UC15, UC16, UC17 |
| Mục tiêu | Tổ chức kế hoạch hướng dẫn, giao nhiệm vụ, nhận bài nộp, nhận xét, đánh giá và xác nhận điều kiện cho bảo vệ. |
| Swimlane đề nghị | GVHD; Sinh viên; Khoa/Giáo vụ; Hệ thống |

[embedded image relationship: rId39]
P345: ACT06 – Xét điều kiện bảo vệ

## Table 64
| Use Case liên quan | UC18 |
| Mục tiêu | Tổng hợp dữ liệu hướng dẫn và học vụ, lọc danh sách, xử lý ngoại lệ và chốt trạng thái đủ điều kiện bảo vệ. |
| Swimlane đề nghị | Khoa/Giáo vụ; Hệ thống; GVHD (cung cấp xác nhận) |

[embedded image relationship: rId40]
P348: ACT07 – Thành lập Hội đồng & phân công phản biện

## Table 65
| Use Case liên quan | UC19, UC20 |
| Mục tiêu | Tạo Hội đồng, phân sinh viên, kiểm tra cơ cấu/xung đột và phân công giảng viên phản biện hợp lệ. |
| Swimlane đề nghị | Khoa/Giáo vụ; Hệ thống; GV phản biện |

[embedded image relationship: rId41]
P350: ACT08 – Lập & quản lý lịch bảo vệ

## Table 66
| Use Case liên quan | UC21 |
| Mục tiêu | Lập lịch bảo vệ theo buổi/ngày/giờ/phòng, kiểm tra xung đột và công bố lịch. |
| Swimlane đề nghị | Khoa/Giáo vụ; Hệ thống; Sinh viên; Giảng viên; Hội đồng |

[embedded image relationship: rId42]
P352: ACT09 – Phản biện & chấm điểm bảo vệ

## Table 67
| Use Case liên quan | UC22, UC23 |
| Mục tiêu | Chuẩn bị hồ sơ chấm, cung cấp hồ sơ cho GV phản biện và Hội đồng, tiếp nhận nhận xét/điểm và lưu dữ liệu làm đầu vào tổng hợp. |
| Swimlane đề nghị | Hệ thống; GV phản biện; Thành viên Hội đồng |

[embedded image relationship: rId43]
P354: ACT10 – Tổng hợp & công bố kết quả

## Table 68
| Use Case liên quan | UC24, UC25 |
| Mục tiêu | Thu thập các thành phần điểm, tính điểm cuối, kiểm tra, chốt/khóa, công bố và xuất báo cáo. |
| Swimlane đề nghị | Khoa/Giáo vụ; Hệ thống; Sinh viên |

[embedded image relationship: rId44]
P356: 2.3. Thiết kế Cơ sở dữ liệu (Database Design)
P357: 2.4.1. Sơ đồ thực thể kết hợp tổng quan (ERD) 
P358: Dựa trên việc phân tích luồng dữ liệu (DFD) và đặc tả ca sử dụng (Use Case), cơ sở dữ liệu của hệ thống được thiết kế theo mô hình quan hệ (Relational Database) đạt chuẩn 3NF (Third Normal Form). Kiến trúc CSDL được chia thành các phân hệ (module) độc lập nhưng liên kết chặt chẽ, đảm bảo tính toàn vẹn dữ liệu, hiệu năng truy vấn cao và đáp ứng trọn vẹn các quy tắc nghiệp vụ (Business Rules) phức tạp của Khoa.
[embedded image relationship: rId45]
P360: 2.4.2. Thiết kế chi tiết các phân hệ CSDL 
P361: Nguyên tắc và Kiến trúc thiết kế cốt lõi
P362: Kiến trúc Multi-tenant (dựa trên Đợt học): Để giải quyết bài toán sinh viên/giảng viên tham gia nhiều đợt đồ án khác nhau qua các năm, hệ thống áp dụng kỹ thuật "Snapshot Dữ liệu". Các bảng như TERM_STUDENT và TERM_LECTURER được tạo ra để lưu trữ trạng thái độc lập của người dùng trong từng đợt cụ thể (THESIS_TERM). 
P363: Cơ chế bảo mật RBAC (Role-Based Access Control): Quyền hạn không bị hard-code mà được quản lý động thông qua các bảng USER_ACCOUNT, ROLE, PERMISSION, ROLE_PERMISSION. 
P364: Cơ chế Audit Log tập trung: Mọi thao tác thay đổi dữ liệu quan trọng (sửa điểm, đổi giảng viên, chốt đề cương) đều được lưu vết tập trung tại bảng AUDIT_LOG nhằm đảm bảo tính minh bạch. 
P365: Phân tích các Phân hệ CSDL trọng tâm
P366: a. Phân hệ Tài khoản, Danh mục và Phân quyền (ERD 1 & ERD 2)
P367: Phân hệ này quản lý dữ liệu gốc của hệ thống.
P368: Bảng STUDENT và LECTURER lưu trữ thông tin nhân sự. 
P369: Mỗi nhân sự được liên kết với một USER_ACCOUNT. 
P370: Bảng RESEARCH_AREA quản lý danh mục các hướng nghiên cứu của Khoa. 
P371: Việc đăng nhập hệ thống sẽ sinh ra các LOGIN_SESSION có thời hạn để quản lý bảo mật. 
[embedded image relationship: rId46]
[embedded image relationship: rId47]
P374: b. Phân hệ Quản lý Đợt đồ án và Phân công (ERD 3)
P375: Đây là phân hệ lõi điều phối luồng thời gian thực hiện.
P376: Bảng THESIS_TERM đại diện cho một đợt bảo vệ. Đợt này được chia thành nhiều giai đoạn cụ thể thông qua bảng TERM_PHASE. 
P377: Nghiệp vụ sinh viên đăng ký nguyện vọng được giải quyết qua bảng REGISTRATION (chọn hướng) và REGISTRATION_PREF (chọn tối đa 3 ưu tiên giảng viên). 
P378: Kết quả phân công giảng viên hướng dẫn (bán tự động hoặc thủ công) được lưu tại ADVISOR_ASSIGNMENT, tuân thủ nghiêm ngặt chỉ tiêu (quota) ghi nhận tại TERM_LECTURER. 
[embedded image relationship: rId48]
P380: c. Phân hệ Quản lý Đề tài, Đề cương và Tiến độ 
P381: Hệ thống được thiết kế theo chuẩn nghiệp vụ Đồ án cá nhân (1 Sinh viên thực hiện 1 Đề tài).
P382: Bảng TOPIC (Đề tài) chứa khóa ngoại term_student_id, khẳng định quyền sở hữu duy nhất của một sinh viên trong đợt học đối với đề tài đó. 
P383: Quá trình làm đề cương có tính lặp lại (sửa đi sửa lại nhiều lần) được giải quyết bằng bảng PROPOSAL_VERSION, giúp hệ thống lưu trữ được lịch sử các phiên bản. 
P384: Việc theo dõi tiến độ hàng tuần được cụ thể hóa thông qua bảng GUIDANCE_PLAN, TASK (nhiệm vụ GV giao) và TASK_SUBMISSION (bài nộp của sinh viên theo term_student_id). 
P385: Hệ thống cho phép nhóm xét duyệt đánh giá đề cương qua PROPOSAL_REVIEW và đánh giá tiến độ qua PHASE_EVALUATION. 
[embedded image relationship: rId49]
[embedded image relationship: rId50]
P389: d. Phân hệ Xét điều kiện, Hội đồng và Chấm điểm 
P390: Giải quyết bài toán lập lịch và tính điểm phức tạp:
P391: Bảng DEFENSE_ELIGIBILITY đóng vai trò chốt chặn, chỉ những sinh viên đạt đủ điều kiện học vụ và được GVHD xác nhận mới được chuyển sang COMMITTEE_STUDENT để bảo vệ. 
P392: Cấu trúc Hội đồng được chia nhỏ logic: DEFENSE_COMMITTEE (Hội đồng chung) chứa nhiều COMMITTEE_MEMBER (Thành viên). Việc bảo vệ diễn ra theo các ca/buổi được lưu tại DEFENSE_SESSION. 
P393: Chấm điểm động (Dynamic Scoring): Thay vì tạo các cột điểm cứng, CSDL sử dụng bộ RUBRIC_CRITERIA để linh hoạt cấu hình barem điểm. Các giảng viên chấm điểm chi tiết vào SCORE_DETAIL và tổng hợp tại SCORE_ENTRY. 
[embedded image relationship: rId51]
[embedded image relationship: rId52]
P397: 2.4.3. Các ràng buộc toàn vẹn và Trigger xử lý quy tắc nghiệp vụ ở tầng CSDL 
P398: Để hệ thống vận hành không xảy ra sai sót logic, thiết kế ERD áp dụng các kỹ thuật sau:
P399: Ràng buộc Hội đồng (BR-18): Giảng viên hướng dẫn không được phép ngồi hội đồng chấm sinh viên của mình. Ràng buộc này được xử lý bằng cách lập trình các Trigger trong CSDL nhằm chặn các thao tác INSERT/UPDATE không hợp lệ trên bảng COMMITTEE_MEMBER và COMMITTEE_STUDENT. 
P400: Tính toàn vẹn của Điểm số cuối cùng: Bảng FINAL_RESULT được thiết kế thêm cờ hiệu is_locked. Khi đợt đang diễn ra, điểm số được tính toán động (Derived attributes) thông qua View/SQL từ các bảng điểm thành phần. Bảng FINAL_RESULT chỉ lưu lại dữ liệu vật lý (Snapshot) khi Khoa đã chính thức ấn nút chốt điểm (is_locked = TRUE), giúp tránh hiện tượng dị thường dữ liệu (Data Anomaly) do đồng bộ kém.
P402: CHƯƠNG 3. PHÂN TÍCH LỰA CHỌN CÔNG NGHỆ
P403: 3.1. Đánh giá và lựa chọn bộ công nghệ phát triển

## Table 69
| Thành phần | Công nghệ | Vai trò / lý do lựa chọn |
| Frontend | React + Vite + TypeScript | Xây dựng giao diện web theo component; Vite phục vụ phát triển và đóng gói ứng dụng. |
| Backend | NestJS | Tổ chức backend theo module, controller và service; phù hợp cấu trúc module nghiệp vụ của dự án. |
| ORM | Prisma | Quản lý mô hình dữ liệu qua schema.prisma và sinh kiểu dữ liệu để giảm sai khác tên bảng/cột trong code. |
| Cơ sở dữ liệu | PostgreSQL | Lưu trữ dữ liệu quan hệ và hỗ trợ các ràng buộc như JSON, CHECK, UNIQUE theo thiết kế phù hợp. |
| Kiểm tra dữ liệu | Zod | Dùng để kiểm tra dữ liệu đầu vào; tài liệu nguồn đề xuất chia sẻ định nghĩa giữa form frontend và API khi kiến trúc cho phép. |
| Giao diện | shadcn/ui + Tailwind CSS hoặc Ant Design | shadcn/ui + Tailwind hướng đến khả năng tùy biến giao diện; Ant Design giúp triển khai nhanh bảng và biểu mẫu quản trị. Nhóm cần chọn một hướng chính. |
| Quản lý dữ liệu frontend | TanStack Query | Quản lý truy vấn API, cache, trạng thái tải và đồng bộ dữ liệu máy chủ. |
| Hợp đồng API | OpenAPI + client sinh tự động | Mô tả API và sinh client frontend nhằm giảm việc viết hàm gọi API thủ công. |
| Quản lý monorepo | pnpm workspaces | Quản lý frontend, backend và gói shared trong một repository; hỗ trợ chia sẻ kiểu dữ liệu. |
| Môi trường | Docker Compose | Chuẩn hóa môi trường chạy cơ sở dữ liệu, backend, frontend và MailHog trong phát triển. |
| Kiểm thử | Vitest hoặc Jest; Testcontainers; Playwright | Unit test, kiểm thử tích hợp với PostgreSQL và kiểm thử luồng giao diện đầu cuối. |
| Chất lượng mã | ESLint, Prettier, TypeScript strict | Kiểm tra quy tắc mã nguồn, định dạng thống nhất và phát hiện lỗi kiểu dữ liệu. |
| CI | GitHub Actions | Tự động chạy lint, build và test khi cập nhật mã nguồn. |
| Công cụ hỗ trợ | Git/GitHub, Docker Desktop, DBeaver hoặc Prisma Studio, Bruno hoặc Swagger UI | Quản lý mã nguồn, chạy môi trường, xem dữ liệu và kiểm thử API. |
| Email phát triển | MailHog | Nhận email giả lập trong môi trường phát triển mà không gửi email thật ra ngoài. |
| Import/export | exceljs; Puppeteer hoặc pdfmake; Nodemailer | Các thư viện được tài liệu nguồn nêu làm lựa chọn cho Excel, PDF và email; cần chọn và thử nghiệm theo yêu cầu thực tế. |
| Lịch định kỳ/xác thực | @nestjs/schedule; Passport + JWT | Hỗ trợ tác vụ định kỳ như xử lý task quá hạn và phương án xác thực bằng Passport/JWT; cần xác nhận theo mô hình bảo mật đã chọn. |

P405: 3.2. Lý do lựa chọn Cơ sở dữ liệu Mã nguồn mở (PostgreSQL)
P406: Chi phí bản quyền (Free/Open-source): Miễn phí hoàn toàn, tối ưu chi phí vận hành cho nhà trường. 
P407: Tính năng & Hiệu năng cao: Hỗ trợ chuẩn ACID, xử lý giao dịch phức tạp, truy vấn dữ liệu quan hệ và kiểu dữ liệu JSON linh hoạt. 
P408: Tính an toàn & Bảo mật: Hỗ trợ cơ chế phân quyền mạnh mẽ, sao lưu khôi phục dữ liệu tin cậy. 
P409: Khả năng mở rộng & Cộng đồng: Cộng đồng hỗ trợ lớn, tích hợp mượt mà với Prisma ORM và Docker. 
P410: 3.3. Đánh giá ưu điểm và nhược điểm của bộ công nghệ (Full-stack TypeScript)
P411: 3.3.1. Sử dụng Full-stack TypeScript
P412: - Ưu điểm:
P413: + Tính nhất quán cao: Dùng một ngôn ngữ duy nhất cho toàn bộ hệ thống.
P414: + Chia sẻ dữ liệu linh hoạt: Dễ dàng chia sẻ types, interfaces, DTOs và Zod schemas giữa
P415: Frontend và Backend thông qua packages dùng chung trong Monorepo.
P416: + Hỗ trợ tối ưu công cụ AI: Tăng hiệu quả và tính chính xác khi sử dụng AI (Claude Code,
P417: ChatGPT) hỗ trợ sinh code và refactor.
P418: + Phát hiện lỗi sớm: Lỗi kiểu dữ liệu (type errors) được phát hiện ngay trong quá trình
P419: biên dịch (compile-time).
P420: - Nhược điểm:
P421: + Ràng buộc kiểu dữ liệu không tự động bảo đảm tính đúng đắn của quy tắc nghiệp vụ
P422: (phân công GVHD, tính điểm, kiểm tra trùng lịch). Vẫn cần viết đầy đủ validator và unit tests.
P423: 3.3.2. Backend NestJS
P424: - Ưu điểm:
P425: + Tổ chức mã nguồn chuẩn hóa: Chia mô-đun rõ ràng (Controller, Service, Validator,
P426: Repository), phù hợp với kiến trúc Modular Monolith.
P427: + Hệ sinh thái mạnh mẽ: Tích hợp tốt với Passport, JWT, Swagger/OpenAPI, và tác vụ định
P428: kỳ (@nestjs/schedule).
P429: - Nhược điểm:
P431: + Cần tuân thủ chặt chẽ các quy tắc thiết kế (Dependency Injection, Decorator), yêu cầu các
P432: thành viên nắm vững kiến trúc.
P433: 3.3.3. Cơ sở dữ liệu PostgreSQL và Prisma ORM
P434: - Ưu điểm:
P435: + Prisma giúp tự động sinh TypeScript Types từ schema.prisma, giảm thiểu rủi ro lệch tên
P436: bảng/cột giữa database và code.
P437: + PostgreSQL hỗ trợ tốt các ràng buộc toàn vẹn dữ liệu (PK, FK, UNIQUE, CHECK) và kiểu
P438: dữ liệu JSON.
P439: - Nhược điểm / Rủi ro:
P440: + Rủi ro xung đột nếu dùng song song Prisma Migrate và SQL Migration (Flyway) mà không
P441: thống nhất một quy trình duy nhất.
P442: 3.3.4. Frontend React + Vite + TanStack Query
P443: - Ưu điểm:
P444: + Tốc độ đóng gói và khởi chạy môi trường phát triển (dev server) của Vite cực nhanh.
P445: + TanStack Query quản lý cache, trạng thái tải dữ liệu và đồng bộ với Server một cách tự
P446: động, tối ưu performance.
P447: - Nhược điểm:
P448: + Cần phân định rõ ràng giữa Server State (TanStack Query) và Client UI State để tránh
P449: chồng chéo dữ liệu.
P450: 3.3.5. Quản lý Monorepo với pnpm workspaces
P451: - Ưu điểm:
P452: + Tiết kiệm dung lượng đĩa và tốc độ cài đặt thư viện nhanh.
P453: + Quản lý toàn bộ mã nguồn (Frontend, Backend, Shared) trong cùng 1 repository duy
P454: nhất.
P455: - Nhược điểm:
P456: + Cần cấu hình đường dẫn (paths) và script build cẩn thận để tránh lỗi import chéo giữa
P457: các workspace.
P458: 3.3.6. Môi trường phát triển với Docker Compose &amp; MailHog
P459: - Ưu điểm:
P460: + Đảm bảo đồng nhất môi trường chạy ứng dụng giữa các thành viên trong nhóm.
P461: + MailHog hỗ trợ kiểm thử tính năng gửi email an toàn, không gửi nhầm email ra bên ngoài.
P462: - Nhược điểm:
P463: + Đòi hỏi máy tính cá nhân của thành viên có cấu hình đủ để chạy Docker Desktop mượt.
P464: 3.4. Các công cụ và môi trường hỗ trợ phát triển
P465: Docker Compose, MailHog (Email giả lập), pnpm workspaces, GitHub Actions (CI/CD) 
P466: CHƯƠNG 4. PHÁT TRIỂN ỨNG DỤNG VÀ GIAO DIỆN HỆ THỐNG
P467: 4.1. Môi trường cài đặt và triển khai ứng dụng
P468: Yêu cầu cấu hình hệ thống, hướng dẫn chạy Docker Compose cho Backend, Frontend và Database. 
P469: 4.2. Giao diện các chức năng ứng dụng (Đưa hình ảnh thực tế vào)
P470: 4.2.1. Phân hệ Quản trị hệ thống (Admin):
P471: Giao diện Đăng nhập & Đổi mật khẩu lần đầu 
P472: Giao diện Quản lý tài khoản & Phân quyền RBAC 
P473: Giao diện Giám sát nhật ký hệ thống (Audit Log) 
P474: 4.2.2. Phân hệ Giáo vụ Khoa:
P475: Giao diện Quản lý đợt đồ án & Lập kế hoạch các mốc 
P476: Giao diện Chạy thuật toán phân công GVHD bán tự động & Điều chỉnh thủ công 
P477: Giao diện Duyệt/Chốt hồ sơ đề cương & Lập nhóm duyệt 
P478: Giao diện Thành lập Hội đồng, phân GVPB & Xếp lịch bảo vệ 
P479: Giao diện Chốt điểm, Công bố kết quả & Xuất báo cáo PDF/Excel 
P480: 4.2.3. Phân hệ Giảng viên (GVHD / GVPB / Hội đồng):
P481: Giao diện Thống nhất đề tài & Theo dõi/Nhận xét báo cáo tiến độ tuần 
P482: Giao diện Đọc duyệt & Nhập điểm/nhận xét phản biện 
P483: Giao diện Chấm điểm bảo vệ trực tiếp theo Rubric dành cho Hội đồng 
P484: 4.2.4. Phân hệ Sinh viên:
P485: Giao diện Đăng ký hướng làm đồ án & Chọn 3 nguyện vọng GVHD 
P486: Giao diện Soạn thảo đề cương & Nộp báo cáo tuần / source code / quyển PDF đồ án 
P487: Giao diện Tra cứu lịch bảo vệ & Xem điểm thành phần/tổng kết 
P488: PHẦN KẾT LUẬN VÀ TÀI LIỆU THAM KHẢO
P489: 1. Kết luận
P490: Các kết quả đạt được của hệ thống so với mục tiêu ban đầu. 
P491: Hạn chế còn tồn tại và hướng phát triển mở rộng ứng dụng trong tương lai. 
P492: 2. Tài liệu tham khảo
P493: Các tài liệu chuyên ngành về Phân tích thiết kế hệ thống (OOAD/UML). 
P494: Trang tài liệu chính thức của NestJS, React, PostgreSQL, Prisma. 
P495: Các quy định, quy chế đào tạo và biểu mẫu đồ án tốt nghiệp của nhà trường. 

## Embedded assets inventory
- word/media/image48.png (122475 bytes)
- word/media/image1.png (41612 bytes)
- word/media/image2.png (46348 bytes)
- word/media/image3.png (26800 bytes)
- word/media/image4.png (43065 bytes)
- word/media/image5.png (100415 bytes)
- word/media/image6.png (93726 bytes)
- word/media/image7.png (62514 bytes)
- word/media/image8.png (57357 bytes)
- word/media/image9.png (115549 bytes)
- word/media/image10.png (116545 bytes)
- word/media/image11.png (46717 bytes)
- word/media/image12.png (157078 bytes)
- word/media/image13.png (76516 bytes)
- word/media/image14.png (105345 bytes)
- word/media/image15.png (38860 bytes)
- word/media/image16.png (551054 bytes)
- word/media/image17.png (61907 bytes)
- word/media/image18.png (58937 bytes)
- word/media/image19.png (58383 bytes)
- word/media/image20.png (63320 bytes)
- word/media/image21.png (55116 bytes)
- word/media/image22.png (66743 bytes)
- word/media/image23.png (47530 bytes)
- word/media/image24.png (48011 bytes)
- word/media/image25.png (83562 bytes)
- word/media/image26.png (49394 bytes)
- word/media/image27.png (62622 bytes)
- word/media/image28.png (48117 bytes)
- word/media/image29.png (56995 bytes)
- word/media/image30.png (348352 bytes)
- word/media/image31.png (1075673 bytes)
- word/media/image32.png (1036230 bytes)
- word/media/image33.png (1082308 bytes)
- word/media/image34.png (971604 bytes)
- word/media/image35.png (896359 bytes)
- word/media/image36.png (761324 bytes)
- word/media/image37.png (1070951 bytes)
- word/media/image38.png (1202834 bytes)
- word/media/image39.png (1250556 bytes)
- word/media/image40.png (1219784 bytes)
- word/media/image42.png (558835 bytes)
- word/media/image43.png (577192 bytes)
- word/media/image44.png (121576 bytes)
- word/media/image45.png (85751 bytes)
- word/media/image46.png (107606 bytes)
- word/media/image47.png (165792 bytes)
- word/media/image41.png (141283 bytes)

## Image relationships
- rId13 => media/image9.png
- rId18 => media/image14.png
- rId26 => media/image22.png
- rId39 => media/image35.png
- rId21 => media/image17.png
- rId34 => media/image30.png
- rId42 => media/image38.png
- rId47 => media/image43.png
- rId50 => media/image46.png
- rId7 => media/image3.png
- rId16 => media/image12.png
- rId29 => media/image25.png
- rId11 => media/image7.png
- rId24 => media/image20.png
- rId32 => media/image28.png
- rId37 => media/image33.png
- rId40 => media/image36.png
- rId45 => media/image41.png
- rId5 => media/image1.png
- rId10 => media/image6.png
- rId19 => media/image15.png
- rId31 => media/image27.png
- rId44 => media/image40.png
- rId52 => media/image48.png
- rId9 => media/image5.png
- rId14 => media/image10.png
- rId22 => media/image18.png
- rId27 => media/image23.png
- rId30 => media/image26.png
- rId35 => media/image31.png
- rId43 => media/image39.png
- rId48 => media/image44.png
- rId8 => media/image4.png
- rId51 => media/image47.png
- rId12 => media/image8.png
- rId17 => media/image13.png
- rId25 => media/image21.png
- rId33 => media/image29.png
- rId38 => media/image34.png
- rId46 => media/image42.png
- rId20 => media/image16.png
- rId41 => media/image37.png
- rId6 => media/image2.png
- rId15 => media/image11.png
- rId23 => media/image19.png
- rId28 => media/image24.png
- rId36 => media/image32.png
- rId49 => media/image45.png
