import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { runAssignmentAlgorithm, RegistrationInput, LecturerCapacity } from '../engine/assignment-algorithm';

@Injectable()
export class AssignmentPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async executeAutoAssignment(termId: string) {
    // 1. Lấy danh sách đăng ký, nguyện vọng và thông tin sinh viên (bao gồm GPA)
    const registrations = await this.prisma.registration.findMany({
      where: { termId, status: 'PENDING' },
      include: {
        preferences: { orderBy: { preferenceOrder: 'asc' } },
        student: true,
        advisorAssignment: true, // Nếu đã có phân công trước đó thì bỏ qua hoặc tính vào đã phân
      },
    });

    // Lọc những sinh viên chưa được phân công
    const unassignedRegistrations = registrations.filter((r) => !r.advisorAssignment);

    // 2. Lấy chỉ tiêu GV tham gia đợt
    const termLecturers = await this.prisma.termLecturer.findMany({
      where: { termId },
      include: { lecturer: true },
    });

    // 3. Tính số lượng sinh viên ĐÃ ĐƯỢC PHÂN CÔNG trước đó cho từng GV trong đợt này
    const currentAssignments = await this.prisma.advisorAssignment.groupBy({
      by: ['advisorId'],
      where: {
        assignmentPlan: { termId },
      },
      _count: {
        id: true,
      },
    });

    const assignmentCountMap = new Map<string, number>();
    currentAssignments.forEach((item) => {
      assignmentCountMap.set(item.advisorId, item._count.id);
    });

    const capacities: LecturerCapacity[] = termLecturers.map((tl) => ({
      lecturerId: tl.lecturerId,
      quota: tl.quota,
      currentCount: assignmentCountMap.get(tl.lecturerId) || 0,
    }));

    const regInputs: RegistrationInput[] = unassignedRegistrations.map((r) => ({
      registrationId: r.id,
      studentId: r.studentId,
      gpa: Number(r.student.gpa || 0),
      preferences: r.preferences.map((p) => ({
        lecturerId: p.lecturerId,
        order: p.preferenceOrder,
      })),
    }));

    // 4. Chạy thuật toán phân công với GPA ưu tiên và chỉ tiêu thực tế
    const results = runAssignmentAlgorithm(regInputs, capacities);
    return results;
  }
}
