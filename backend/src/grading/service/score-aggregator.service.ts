import { Injectable } from '@nestjs/common';

/**
 * ScoreAggregatorService - Bộ tính điểm đồ án tốt nghiệp chuẩn UTC (Đại học Giao thông vận tải)
 *
 * Công thức chuẩn:
 * 1. Điểm Quá trình (QT) = 0.5 * Điểm_GVHD + 0.5 * Điểm_GVPB
 * 2. Điểm Hội đồng (KTHP) = Trung bình cộng điểm các thành viên Hội đồng tham gia chấm
 * 3. Điểm Học phần (Tổng kết) = 0.4 * Điểm_QT + 0.6 * Điểm_KTHP
 */
@Injectable()
export class ScoreAggregatorService {
  /**
   * Tính điểm Quá trình (QT)
   * @param advisorScore Điểm GVHD (thang 10)
   * @param reviewerScore Điểm GVPB (thang 10)
   */
  calculateProcessScore(advisorScore: number, reviewerScore: number): number {
    const qt = advisorScore * 0.5 + reviewerScore * 0.5;
    return Math.round(qt * 100) / 100; // 2 chữ số thập phân
  }

  /**
   * Tính điểm Bảo vệ Hội đồng (KTHP)
   * @param memberScores Danh sách điểm của các thành viên HĐ (Chủ tịch, Thư ký, Ủy viên)
   */
  calculateCommitteeScore(memberScores: number[]): number {
    if (!memberScores || memberScores.length === 0) {
      throw new Error('Hội đồng phải có ít nhất 1 thành viên chấm điểm');
    }
    const sum = memberScores.reduce((acc, score) => acc + score, 0);
    const avg = sum / memberScores.length;
    return Math.round(avg * 1000) / 1000;
  }

  /**
   * Tính điểm Học phần cuối cùng (HP)
   * @param processScore Điểm QT
   * @param committeeScore Điểm KTHP
   * @param processWeight Trọng số quá trình (mặc định 0.4)
   * @param committeeWeight Trọng số hội đồng (mặc định 0.6)
   */
  calculateFinalScore(
    processScore: number,
    committeeScore: number,
    processWeight = 0.4,
    committeeWeight = 0.6,
  ): number {
    const finalScore = processScore * processWeight + committeeScore * committeeWeight;
    return Math.round(finalScore * 100) / 100;
  }

  /**
   * Kiểm tra điều kiện đạt
   */
  isPassed(finalScore: number, minPassScore = 5.0): boolean {
    return finalScore >= minPassScore;
  }
}
