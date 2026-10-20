import { describe, it, expect } from 'vitest';
import { runAssignmentAlgorithm, RegistrationInput, LecturerCapacity } from './assignment-algorithm';

describe('runAssignmentAlgorithm (GPA Priority & Quota Check)', () => {
  it('ưu tiên sinh viên có GPA cao hơn khi cùng chọn NV1 của 1 giảng viên có quota=1', () => {
    const capacities: LecturerCapacity[] = [
      { lecturerId: 'gv-phong', quota: 1, currentCount: 0 },
      { lecturerId: 'gv-du', quota: 5, currentCount: 0 },
    ];

    const registrations: RegistrationInput[] = [
      {
        registrationId: 'reg-sv-thap-diem',
        studentId: 'sv-01',
        gpa: 2.8,
        preferences: [
          { lecturerId: 'gv-phong', order: 1 },
          { lecturerId: 'gv-du', order: 2 },
        ],
      },
      {
        registrationId: 'reg-sv-cao-diem',
        studentId: 'sv-02',
        gpa: 3.6,
        preferences: [
          { lecturerId: 'gv-phong', order: 1 },
          { lecturerId: 'gv-du', order: 2 },
        ],
      },
    ];

    const results = runAssignmentAlgorithm(registrations, capacities);

    const caoDiem = results.find((r) => r.registrationId === 'reg-sv-cao-diem');
    const thapDiem = results.find((r) => r.registrationId === 'reg-sv-thap-diem');

    // Sinh viên điểm cao hơn (3.6) được gán cho gv-phong (NV1)
    expect(caoDiem?.assignedLecturerId).toBe('gv-phong');

    // Sinh viên điểm thấp hơn (2.8) bị hết quota gv-phong -> chuyển sang NV2 (gv-du)
    expect(thapDiem?.assignedLecturerId).toBe('gv-du');
  });

  it('tính đúng số lượng đã hướng dẫn trước đó (currentCount > 0)', () => {
    const capacities: LecturerCapacity[] = [
      { lecturerId: 'gv-phong', quota: 2, currentCount: 2 }, // Đã hết chỗ
      { lecturerId: 'gv-minh', quota: 3, currentCount: 1 },  // Còn 2 chỗ
    ];

    const registrations: RegistrationInput[] = [
      {
        registrationId: 'reg-03',
        studentId: 'sv-03',
        gpa: 3.8,
        preferences: [
          { lecturerId: 'gv-phong', order: 1 },
          { lecturerId: 'gv-minh', order: 2 },
        ],
      },
    ];

    const results = runAssignmentAlgorithm(registrations, capacities);
    expect(results[0].assignedLecturerId).toBe('gv-minh');
  });
});
