import { describe, it, expect } from 'vitest';
import { ScoreAggregatorService } from './score-aggregator.service';

describe('ScoreAggregatorService (UTC Formula)', () => {
  const service = new ScoreAggregatorService();

  it('tính đúng điểm sinh viên Âu Đức Ngà (HĐ 6 - UTC)', () => {
    const advisorScore = 9.0;
    const reviewerScore = 7.0;
    const committeeScores = [7.5, 8.0, 8.5, 9.0]; // Chủ tịch, Thư ký, UV1, UV2

    const processScore = service.calculateProcessScore(advisorScore, reviewerScore);
    expect(processScore).toBe(8.0); // 9*0.5 + 7*0.5 = 8.0

    const committeeScore = service.calculateCommitteeScore(committeeScores);
    expect(committeeScore).toBe(8.25); // (7.5+8+8.5+9)/4 = 8.25

    const finalScore = service.calculateFinalScore(processScore, committeeScore);
    expect(finalScore).toBe(8.15); // 8.0*0.4 + 8.25*0.6 = 3.2 + 4.95 = 8.15

    expect(service.isPassed(finalScore)).toBe(true);
  });

  it('tính đúng điểm sinh viên Nguyễn Tuấn Giang (HĐ 6 - UTC)', () => {
    const advisorScore = 9.0;
    const reviewerScore = 8.0;
    const committeeScores = [8.0, 8.3, 7.8, 8.5];

    const processScore = service.calculateProcessScore(advisorScore, reviewerScore);
    expect(processScore).toBe(8.5);

    const committeeScore = service.calculateCommitteeScore(committeeScores);
    expect(committeeScore).toBe(8.15);

    const finalScore = service.calculateFinalScore(processScore, committeeScore);
    expect(finalScore).toBe(8.29); // 8.5*0.4 + 8.15*0.6 = 3.4 + 4.89 = 8.29
  });

  it('xác định trượt khi điểm dưới 5.0', () => {
    expect(service.isPassed(4.9)).toBe(false);
    expect(service.isPassed(5.0)).toBe(true);
  });
});
