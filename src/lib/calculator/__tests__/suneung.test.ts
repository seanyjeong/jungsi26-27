/**
 * 수능 계산 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  calculateScore,
  pickByType,
  resolveTotal,
  getEnglishGrade,
  getHistoryGrade,
  interpolateScore,
} from '../index';
import type { FormulaData, StudentScores, GradeCut } from '../types';

describe('수능 계산기', () => {
  describe('유틸리티 함수', () => {
    it('pickByType - 표준점수 타입일 때 std 반환', () => {
      const row = { name: '국어' as const, std: 130, percentile: 95 };
      expect(pickByType(row, '표준점수')).toBe(130);
    });

    it('pickByType - 백분위 타입일 때 percentile 반환', () => {
      const row = { name: '국어' as const, std: 130, percentile: 95 };
      expect(pickByType(row, '백분위')).toBe(95);
    });

    it('resolveTotal - 총점이 있으면 해당 값 반환', () => {
      const F = { 학년도: 2026, 총점: 800, 수능: 100, 국어: 30, 수학: 30, 영어: 20, 탐구: 20, 탐구수: 2, 한국사: 0 };
      expect(resolveTotal(F)).toBe(800);
    });

    it('resolveTotal - 총점이 없으면 1000 반환', () => {
      expect(resolveTotal(null)).toBe(1000);
    });

    it('getEnglishGrade - 영어 원점수 → 등급', () => {
      expect(getEnglishGrade(95)).toBe(1);
      expect(getEnglishGrade(85)).toBe(2);
      expect(getEnglishGrade(75)).toBe(3);
      expect(getEnglishGrade(65)).toBe(4);
      expect(getEnglishGrade(55)).toBe(5);
      expect(getEnglishGrade(45)).toBe(6);
      expect(getEnglishGrade(35)).toBe(7);
      expect(getEnglishGrade(25)).toBe(8);
      expect(getEnglishGrade(15)).toBe(9);
    });

    it('getHistoryGrade - 한국사 원점수 → 등급', () => {
      expect(getHistoryGrade(45)).toBe(1);
      expect(getHistoryGrade(37)).toBe(2);
      expect(getHistoryGrade(32)).toBe(3);
      expect(getHistoryGrade(27)).toBe(4);
      expect(getHistoryGrade(22)).toBe(5);
      expect(getHistoryGrade(17)).toBe(6);
      expect(getHistoryGrade(12)).toBe(7);
      expect(getHistoryGrade(7)).toBe(8);
      expect(getHistoryGrade(3)).toBe(9);
    });
  });

  describe('등급컷 보간', () => {
    const gradeCutTable: GradeCut[] = [
      { year_id: 2026, 모형: '수능', 선택과목명: '국어', 등급: 1, 원점수: 94, 표준점수: 131, 백분위: 96 },
      { year_id: 2026, 모형: '수능', 선택과목명: '국어', 등급: 2, 원점수: 88, 표준점수: 125, 백분위: 89 },
      { year_id: 2026, 모형: '수능', 선택과목명: '국어', 등급: 3, 원점수: 80, 표준점수: 117, 백분위: 77 },
    ];

    it('정확히 일치하는 원점수일 경우 해당 값 반환', () => {
      const result = interpolateScore(94, gradeCutTable);
      expect(result.std).toBe(131);
      expect(result.pct).toBe(96);
      expect(result.grade).toBe(1);
    });

    it('구간 내 원점수일 경우 선형 보간', () => {
      const result = interpolateScore(90, gradeCutTable);
      // 90은 94~88 구간의 1/3 지점 (88 + (94-88)/3 * 1)
      // 예상 표준점수: 125 + (131-125) * (90-88)/(94-88) = 125 + 6 * 2/6 = 127
      expect(result.std).toBe(127);
      // 예상 백분위: 89 + (96-89) * 2/6 = 89 + 2.33 = 91.33 → 91
      expect(result.pct).toBe(91);
    });

    it('최고점 이상이면 최고점 반환', () => {
      const result = interpolateScore(100, gradeCutTable);
      expect(result.std).toBe(131);
      expect(result.pct).toBe(96);
    });
  });

  describe('일반 계산', () => {
    it('기본 계산 - 백분위 모드', () => {
      const formula: FormulaData = {
        학년도: 2026,
        총점: 1000,
        수능: 100,
        국어: 30,
        수학: 30,
        영어: 20,
        탐구: 20,
        탐구수: 2,
        한국사: 0,
        english_scores: { '1': 100, '2': 96, '3': 90, '4': 84, '5': 78, '6': 72, '7': 66, '8': 60, '9': 50 },
        history_scores: { '1': 10, '2': 10, '3': 10, '4': 9.6, '5': 9.2, '6': 8.8, '7': 8.4, '8': 8.0, '9': 7.6 },
      };

      const student: StudentScores = {
        subjects: [
          { name: '국어', std: 130, percentile: 95 },
          { name: '수학', std: 135, percentile: 97 },
          { name: '영어', grade: 1 },
          { name: '한국사', grade: 2 },
          { name: '탐구', subject: '생명과학I', std: 65, percentile: 90 },
          { name: '탐구', subject: '지구과학I', std: 62, percentile: 85 },
        ],
      };

      const result = calculateScore(formula, student, null);
      expect(result.totalScore).toBeDefined();
      expect(result.calculationLog.length).toBeGreaterThan(0);
      expect(parseFloat(result.totalScore)).toBeGreaterThan(0);
    });
  });

  describe('하드코딩 특수 대학', () => {
    it('선문대 (U_ID 148) - 등급 기반 계산', () => {
      const formula: FormulaData = {
        U_ID: 148,
        학년도: 2026,
        총점: 200,
        수능: 100,
        국어: 0,
        수학: 0,
        영어: 0,
        탐구: 0,
        탐구수: 1,
        한국사: 0,
        history_scores: { '1': 10, '2': 10, '3': 10, '4': 9.6, '5': 9.2, '6': 8.8, '7': 8.4, '8': 8.0, '9': 7.6 },
      };

      const student: StudentScores = {
        subjects: [
          { name: '국어', grade: 2 },
          { name: '수학', grade: 3 },
          { name: '영어', grade: 2 },
          { name: '한국사', grade: 1 },
          { name: '탐구', subject: '생명과학I', grade: 3 },
        ],
      };

      const result = calculateScore(formula, student, null);
      // 등급표: 1=100, 2=93, 3=86 ...
      // 상위 2개: 국어(93), 영어(93) = 186
      // 한국사: 1등급 = 10
      // 총점: 196
      expect(parseFloat(result.totalScore)).toBe(196);
    });

    it('경동대 (U_ID 76) - 등급 평균 계산', () => {
      const formula: FormulaData = {
        U_ID: 76,
        학년도: 2026,
        총점: 700,
        수능: 100,
        국어: 0,
        수학: 0,
        영어: 0,
        탐구: 0,
        탐구수: 1,
        한국사: 0,
      };

      const student: StudentScores = {
        subjects: [
          { name: '국어', grade: 2 },
          { name: '수학', grade: 2 },
          { name: '영어', grade: 2 },
          { name: '한국사', grade: 1 },
          { name: '탐구', subject: '생명과학I', grade: 2 },
        ],
      };

      const result = calculateScore(formula, student, null);
      // 등급 합: 2+2+2+2 = 8, 평균: 2.0 → 2등급 → 692점
      expect(parseFloat(result.totalScore)).toBe(692);
    });

    it('선문대 (U_ID 149) - 다른 등급 조합', () => {
      const formula: FormulaData = {
        U_ID: 149,
        학년도: 2026,
        총점: 200,
        수능: 100,
        국어: 0,
        수학: 0,
        영어: 0,
        탐구: 0,
        탐구수: 1,
        한국사: 0,
        history_scores: { '1': 10, '2': 10, '3': 10, '4': 9.6, '5': 9.2, '6': 8.8, '7': 8.4, '8': 8.0, '9': 7.6 },
      };

      const student: StudentScores = {
        subjects: [
          { name: '국어', grade: 1 },  // 100
          { name: '수학', grade: 2 },  // 93
          { name: '영어', grade: 3 },  // 86
          { name: '한국사', grade: 2 }, // 10
          { name: '탐구', subject: '생명과학I', grade: 4 }, // 79
        ],
      };

      const result = calculateScore(formula, student, null);
      // 등급표: 1=100, 2=93, 3=86, 4=79
      // 상위 2개: 국어(100), 수학(93) = 193
      // 한국사: 2등급 = 10
      // 총점: 203
      expect(parseFloat(result.totalScore)).toBe(203);
    });
  });
});
