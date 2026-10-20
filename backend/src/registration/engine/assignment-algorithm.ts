/**
 * Thuật toán phân công GVHD bán tự động chuẩn UTC
 * - Xét sinh viên theo thứ tự GPA giảm dần (ưu tiên người có điểm cao hơn khi cùng nguyện vọng)
 * - Ưu tiên NV1 -> NV2 -> NV3
 * - Kiểm tra chặt chẽ chỉ tiêu còn lại: currentCount < quota
 * - Cập nhật currentCount tức thời khi gán thành công
 */

export interface RegistrationInput {
  registrationId: string;
  studentId: string;
  gpa: number;
  preferences: Array<{ lecturerId: string; order: number }>;
}

export interface LecturerCapacity {
  lecturerId: string;
  quota: number;
  currentCount: number;
}

export interface AssignmentResult {
  registrationId: string;
  assignedLecturerId: string | null;
  isManual: boolean;
  reason: string;
}

export function runAssignmentAlgorithm(
  registrations: RegistrationInput[],
  capacities: LecturerCapacity[],
): AssignmentResult[] {
  // Tạo bản đồ capacity để theo dõi số lượng cập nhật theo thời gian thực
  const capacityMap = new Map(capacities.map((c) => [c.lecturerId, { ...c }]));
  const results: AssignmentResult[] = [];

  // 1. Sắp xếp danh sách sinh viên theo GPA giảm dần (ưu tiên GPA cao khi cùng chọn 1 GV)
  const sortedRegistrations = [...registrations].sort((a, b) => (b.gpa || 0) - (a.gpa || 0));

  // 2. Duyệt qua từng sinh viên và thử xếp theo các nguyện vọng NV1 -> NV2 -> NV3
  for (const reg of sortedRegistrations) {
    let assigned: string | null = null;
    let reason = 'Không còn chỉ tiêu phù hợp trong các nguyện vọng đã đăng ký';

    // Đảm bảo thứ tự nguyện vọng 1 -> 2 -> 3
    const sortedPrefs = [...reg.preferences].sort((a, b) => a.order - b.order);

    for (const pref of sortedPrefs) {
      const cap = capacityMap.get(pref.lecturerId);
      if (cap && cap.currentCount < cap.quota) {
        assigned = pref.lecturerId;
        cap.currentCount++;
        reason = `Được phân công theo Nguyện vọng ${pref.order} (GPA: ${reg.gpa}, Chỉ tiêu còn lại: ${cap.quota - cap.currentCount})`;
        break;
      }
    }

    results.push({
      registrationId: reg.registrationId,
      assignedLecturerId: assigned,
      isManual: false,
      reason,
    });
  }

  return results;
}
