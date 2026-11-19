"use strict";
const assert=require("node:assert/strict");
const {context,read,save,safeError}=require("./context.cjs");
const subjects=[
"quản lý lịch khám và hồ sơ bệnh án cho phòng khám đa khoa",
"đặt lịch sửa chữa và theo dõi bảo dưỡng xe máy",
"quản lý kho và truy xuất nguồn gốc nông sản",
"đặt vé và quản lý chuyến xe khách liên tỉnh",
"quản lý mượn trả thiết bị phòng thí nghiệm",
"quản lý ký túc xá và thanh toán dịch vụ sinh viên",
"quản lý tuyển dụng và đánh giá ứng viên",
"đặt sân thể thao và quản lý giải đấu phong trào",
"quản lý hợp đồng và thu tiền điện nước nhà trọ",
"đặt món và theo dõi đơn hàng cho chuỗi nhà hàng",
"quản lý bảo hành thiết bị điện tử",
"quản lý thư viện số và đề xuất tài liệu theo chủ đề",
"quản lý chăm sóc khách hàng cho doanh nghiệp vận tải",
"quản lý giao hàng chặng cuối và tối ưu tuyến đường",
"quản lý bán hàng và đồng bộ tồn kho đa chi nhánh",
"quản lý hồ sơ nhân sự và chấm công theo ca",
"đăng ký và điều phối tình nguyện viên cho sự kiện",
"quản lý trung tâm ngoại ngữ và xếp lịch lớp học",
"quản lý học phí và công nợ của cơ sở đào tạo",
"quản lý đơn hàng gia công và tiến độ sản xuất",
"quản lý hồ sơ văn bản và luồng phê duyệt nội bộ",
"đặt phòng và quản lý dịch vụ khách sạn",
"quản lý lịch trình và đặt tour du lịch",
"quản lý tài sản và yêu cầu bảo trì cơ sở vật chất",
"quản lý thu gom và phân loại rác thải đô thị",
"quản lý phòng tập và tư vấn lịch tập cá nhân",
"quản lý đặt lịch chăm sóc thú cưng",
"quản lý chuỗi cung ứng thực phẩm an toàn",
"quản lý hồ sơ và dịch vụ công tại phường",
"theo dõi chất lượng không khí và cảnh báo ô nhiễm",
"giám sát mức tiêu thụ điện của tòa nhà",
"quản lý đăng ký và nghiệm thu đề tài nghiên cứu khoa học",
"quản lý câu lạc bộ và hoạt động ngoại khóa",
"quản lý phản ánh hiện trường và xử lý kiến nghị",
"quản lý bãi đỗ xe và nhận diện biển số",
"giám sát nhiệt độ và độ ẩm kho lạnh",
"theo dõi lộ trình xe buýt và dự báo thời gian đến",
"quản lý lịch vận hành và bảo dưỡng máy móc",
"quản lý đơn thuốc và tồn kho nhà thuốc",
"quản lý đăng ký và tổ chức hội thảo khoa học",
"phân tích phản hồi khách hàng từ đánh giá sản phẩm",
"phát hiện giao dịch bất thường trên dữ liệu thanh toán",
"dự báo nhu cầu tiêu thụ hàng hóa theo mùa vụ",
"gợi ý sản phẩm từ lịch sử mua hàng",
"nhận dạng và phân loại bệnh trên lá cây",
"tra cứu tài liệu pháp quy bằng tìm kiếm ngữ nghĩa",
"trích xuất thông tin từ hóa đơn điện tử",
"hỗ trợ tư vấn tuyển sinh bằng trợ lý hội thoại",
"phát hiện tin nhắn rác bằng xử lý ngôn ngữ tự nhiên",
"phân tích và dự báo lưu lượng giao thông đô thị",
"giám sát nhật ký truy cập và cảnh báo sự cố mạng",
"quản lý quyền truy cập và xác thực đa yếu tố",
"phát hiện tấn công trên hệ thống mạng nội bộ",
"kiểm tra cấu hình bảo mật ứng dụng web",
"mô phỏng và đánh giá thuật toán cân bằng tải",
"giám sát dịch vụ và cảnh báo gián đoạn hệ thống",
"quản lý sao lưu và kiểm tra phục hồi dữ liệu",
"kiểm thử tự động quy trình mua hàng trực tuyến",
"kiểm thử hiệu năng cổng đăng ký tín chỉ",
"quản lý ca kiểm thử và theo dõi vòng đời lỗi phần mềm",
"học lập trình thông qua trò chơi tương tác",
"mô phỏng huấn luyện an toàn giao thông",
"trải nghiệm tham quan bảo tàng bằng thực tế tăng cường",
"quản lý và thi đấu cờ vua trực tuyến",
"hỗ trợ luyện phát âm tiếng Anh trên thiết bị di động",
"quản lý chi tiêu cá nhân và dự báo ngân sách",
"kết nối trao đổi sách và vật dụng đã qua sử dụng",
"quản lý đặt lịch tư vấn hướng nghiệp",
"hỗ trợ người khiếm thị nhận biết vật thể",
"quản lý chất lượng nước và cảnh báo ngập lụt",
"quản lý đặt dịch vụ logistics và theo dõi vận đơn",
"phân tích dữ liệu học tập và cảnh báo nguy cơ bỏ học",
"quản lý và đặt lịch sử dụng không gian làm việc chung",
"quản lý đấu giá và thanh toán tài sản trực tuyến",
"quản lý hồ sơ kiểm định phương tiện giao thông",
"quản lý vận hành và sản lượng trang trại thông minh",
"phân tích dữ liệu tuyển dụng và xu hướng kỹ năng",
"quản lý lịch biểu và điều phối nhân viên giao dịch",
"tìm kiếm và đặt lịch sử dụng dịch vụ gia đình",
"quản lý hiến máu và kết nối nhu cầu tiếp nhận máu",
];
function generatedTitle(index){assert.ok(Number.isInteger(index)&&index>=0&&index<subjects.length);return "Xây dựng hệ thống "+subjects[index];}
async function main(){const c=await context();try{
 const {termId}=read("foundation-report.json"),plan=read("workflow-plan.json");
 const results=await c.once("topic-label-correction-v1",{origin:"USER_REQUESTED_SYNTHETIC_TOPIC_VARIETY",reason:"Người dùng yêu cầu đổi các tên đề tài tổng hợp bị lặp để đánh giá giao diện."},async tx=>{
   const proposals=await tx.proposal.findMany({where:{termId},include:{topic:true,student:{select:{studentCode:true}}}});assert.equal(proposals.length,68);
   const results=[];
   for(const p of proposals){const index=plan.scenarios.findIndex(s=>s.studentCode===p.student.studentCode),scenario=plan.scenarios[index];assert.ok(scenario);
     if(scenario.topic.origin!=="GENERATED_SCENARIO")continue;
     assert.equal(p.topic.termId,termId);assert.match(p.topic.title,/^Xây dựng hệ thống quản lý học tập và tiến độ đồ án — hồ sơ /);
     const title=generatedTitle(index);
     // This is a correction to the generated fixture's display label. Frozen
     // proposal versions and signed-off print snapshots retain their historical
     // content and hashes; no operational state/revision/confirmation is changed.
     const changed=await tx.topic.updateMany({where:{id:p.topicId,termId,title:p.topic.title},data:{title}});assert.equal(changed.count,1);
     await tx.auditLog.create({data:{userId:c.faculty.userId,action:"SOURCE_DATASET_TOPIC_LABEL_CORRECTED",resource:"topic",resourceId:p.topicId,oldValue:{title:p.topic.title},newValue:{title,origin:"GENERATED_UI_EVALUATION_LABEL",datasetId:c.dataset.datasetId,proposalId:p.id,historicalSnapshotsPreserved:true}}});
     results.push({studentCode:p.student.studentCode,proposalId:p.id,topicId:p.topicId,previousTitle:p.topic.title,title});
   }
   const all=await tx.topic.findMany({where:{termId},select:{title:true}});assert.equal(new Set(all.map(r=>r.title)).size,all.length);assert.ok(all.every(r=>!r.title.startsWith("Xây dựng hệ thống quản lý học tập và tiến độ đồ án")));
   return results;
 });
 save("topic-variety-report.json",{datasetId:c.dataset.datasetId,termId,changed:results.length,origin:"USER_REQUESTED_TEST_DATA",historicalSnapshotsPreserved:true,results,verifiedAt:new Date().toISOString()});console.log(JSON.stringify({changed:results.length,historicalSnapshotsPreserved:true}));
}finally{await c.db.$disconnect();}}
module.exports={generatedTitle};
if(require.main===module)main().catch(safeError);
