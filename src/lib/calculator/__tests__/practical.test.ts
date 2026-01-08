/**
 * 실기 계산 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePracticalScore,
  getEventRules,
  findMaxScore,
  findMinScore,
  lookupScore,
  lookupDeductionLevel,
  convertGradeToScore,
} from '../index';
import type { PracticalFormulaData, StudentPracticalData, PracticalScoreRecord } from '../types';

describe('실기 계산기', () => {
  describe('유틸리티 함수', () => {
    it('getEventRules - 100m 달리기는 lower_is_better', () => {
      const rules = getEventRules('100m');
      expect(rules.method).toBe('lower_is_better');
    });

    it('getEventRules - 제자리멀리뛰기는 higher_is_better', () => {
      const rules = getEventRules('제자리멀리뛰기');
      expect(rules.method).toBe('higher_is_better');
    });

    it('getEventRules - 알 수 없는 종목은 higher_is_better', () => {
      const rules = getEventRules('알수없는종목');
      expect(rules.method).toBe('higher_is_better');
    });

    it('findMaxScore - 배점표에서 최고점 찾기', () => {
      const table: PracticalScoreRecord[] = [
        { 종목명: '100m', 성별: '남', 기록: '11.0', 배점: '100' },
        { 종목명: '100m', 성별: '남', 기록: '11.5', 배점: '90' },
        { 종목명: '100m', 성별: '남', 기록: '12.0', 배점: '80' },
      ];
      expect(findMaxScore(table)).toBe(100);
    });

    it('findMinScore - 배점표에서 최저점 찾기', () => {
      const table: PracticalScoreRecord[] = [
        { 종목명: '100m', 성별: '남', 기록: '11.0', 배점: '100' },
        { 종목명: '100m', 성별: '남', 기록: '11.5', 배점: '90' },
        { 종목명: '100m', 성별: '남', 기록: '12.0', 배점: '80' },
      ];
      // findMinScore returns string
      expect(findMinScore(table)).toBe('80');
    });

    it('lookupScore - higher_is_better 모드에서 점수 조회', () => {
      const table: PracticalScoreRecord[] = [
        { 종목명: '제자리멀리뛰기', 성별: '남', 기록: '280', 배점: '100' },
        { 종목명: '제자리멀리뛰기', 성별: '남', 기록: '270', 배점: '90' },
        { 종목명: '제자리멀리뛰기', 성별: '남', 기록: '260', 배점: '80' },
      ];
      // 275cm는 280 이상? No, 270 이상? Yes → 90점 (returns string)
      expect(lookupScore('275', 'higher_is_better', table, '0점')).toBe('90');
    });

    it('lookupScore - lower_is_better 모드에서 점수 조회', () => {
      const table: PracticalScoreRecord[] = [
        { 종목명: '100m', 성별: '남', 기록: '11.0', 배점: '100' },
        { 종목명: '100m', 성별: '남', 기록: '11.5', 배점: '90' },
        { 종목명: '100m', 성별: '남', 기록: '12.0', 배점: '80' },
      ];
      // lower_is_better: 내림차순 [12.0, 11.5, 11.0]에서 studentValue >= record 찾기
      // 11.3 >= 12.0? No, 11.3 >= 11.5? No, 11.3 >= 11.0? Yes → 100점
      expect(lookupScore('11.3', 'lower_is_better', table, '0점')).toBe('100');
    });

    it('lookupDeductionLevel - 급간 감수 조회', () => {
      const table: PracticalScoreRecord[] = [
        { 종목명: '100m', 성별: '남', 기록: '11.0', 배점: '100', 급간: '0' },
        { 종목명: '100m', 성별: '남', 기록: '11.5', 배점: '90', 급간: '1' },
        { 종목명: '100m', 성별: '남', 기록: '12.0', 배점: '80', 급간: '2' },
      ];
      expect(lookupDeductionLevel(90, table)).toBe(1);
    });

    it('convertGradeToScore - 등급 문자열 → 숫자 변환', () => {
      expect(convertGradeToScore('100', undefined, '100m')).toBe(100);
      expect(convertGradeToScore(95, undefined, '100m')).toBe(95);
      expect(convertGradeToScore('NP', 121, '100m')).toBe(0); // U_ID 121 전용 NP
    });
  });

  describe('Basic 모드 계산', () => {
    it('기본 실기 점수 계산', () => {
      const formula: PracticalFormulaData = {
        U_ID: 1,
        학년도: 2026,
        실기총점: 400,
        기본점수: 0,
        미달처리: '0점',
        실기모드: 'basic',
        실기배점: [
          { 종목명: '100m', 성별: '남', 기록: '11.0', 배점: '100' },
          { 종목명: '100m', 성별: '남', 기록: '11.5', 배점: '90' },
          { 종목명: '100m', 성별: '남', 기록: '12.0', 배점: '80' },
          { 종목명: '100m', 성별: '남', 기록: '12.5', 배점: '70' },
          { 종목명: '제자리멀리뛰기', 성별: '남', 기록: '280', 배점: '100' },
          { 종목명: '제자리멀리뛰기', 성별: '남', 기록: '270', 배점: '90' },
          { 종목명: '제자리멀리뛰기', 성별: '남', 기록: '260', 배점: '80' },
          { 종목명: '제자리멀리뛰기', 성별: '남', 기록: '250', 배점: '70' },
        ],
      };

      const student: StudentPracticalData = {
        gender: '남',
        practicals: [
          { event: '100m', value: '11.3' },
          { event: '제자리멀리뛰기', value: '275' },
        ],
      };

      const result = calculatePracticalScore(formula, student);
      expect(result.totalScore).toBeDefined();
      expect(result.calculationLog.length).toBeGreaterThan(0);
      // 100m: 11.3초 → 11.0 이상 → 100점 (lower_is_better)
      // 제자리멀리뛰기: 275cm → 270 이상 → 90점 (higher_is_better)
      // Sum: 190점 / 200점(배점표만점) * 400점 = 380점
      expect(parseFloat(result.totalScore)).toBe(380);
    });

    it('기본점수 추가 계산', () => {
      const formula: PracticalFormulaData = {
        U_ID: 1,
        학년도: 2026,
        실기총점: 400,
        기본점수: 50, // 기본점수 50점 추가
        미달처리: '0점',
        실기모드: 'basic',
        실기배점: [
          { 종목명: '100m', 성별: '남', 기록: '11.0', 배점: '100' },
          { 종목명: '100m', 성별: '남', 기록: '12.0', 배점: '80' },
        ],
      };

      const student: StudentPracticalData = {
        gender: '남',
        practicals: [{ event: '100m', value: '11.5' }],
      };

      const result = calculatePracticalScore(formula, student);
      // 100m: 11.5초 → 11.0 이상 → 100점 (lower_is_better)
      // Sum: 100점 + 기본점수 50점 = 150점 / 100점 * 400점 = 600점
      expect(parseFloat(result.totalScore)).toBe(600);
    });

    it('기록 없음 처리', () => {
      const formula: PracticalFormulaData = {
        U_ID: 1,
        학년도: 2026,
        실기총점: 400,
        기본점수: 0,
        미달처리: '0점',
        실기모드: 'basic',
        실기배점: [
          { 종목명: '100m', 성별: '남', 기록: '11.0', 배점: '100' },
        ],
      };

      const student: StudentPracticalData = {
        gender: '남',
        practicals: [{ event: '100m', value: '' }], // 빈 기록
      };

      const result = calculatePracticalScore(formula, student);
      expect(result.breakdown?.events?.[0]?.score).toBeNull();
    });
  });

  describe('Special 모드 계산', () => {
    it('Special 모드 - U_ID 121 (PASS/NP 처리)', () => {
      const formula: PracticalFormulaData = {
        U_ID: 121,
        학년도: 2026,
        실기총점: 100,
        기본점수: 0,
        미달처리: '0점',
        실기모드: 'special',
        실기배점: [
          { 종목명: '100m', 성별: '남', 기록: '13.0', 배점: 'P' }, // 13.0초 이하면 PASS
        ],
      };

      const studentPass: StudentPracticalData = {
        gender: '남',
        practicals: [{ event: '100m', value: '12.5' }], // 13.0 이하 → PASS
      };

      const studentFail: StudentPracticalData = {
        gender: '남',
        practicals: [{ event: '100m', value: '14.0' }], // 13.0 초과 → NP
      };

      const resultPass = calculatePracticalScore(formula, studentPass);
      const resultFail = calculatePracticalScore(formula, studentFail);

      // U_ID 121 공식: 기본점 200 + PASS당 100점
      // PASS 1개: 200 + 100 = 300점
      // NP (0개): 200 + 0 = 200점
      expect(parseFloat(resultPass.totalScore)).toBe(300);
      expect(parseFloat(resultFail.totalScore)).toBe(200);
    });

    it('Special 모드 - U_ID 2 (전체 종목 합산)', () => {
      const formula: PracticalFormulaData = {
        U_ID: 2, // 전체 종목 합산
        학년도: 2026,
        실기총점: 300,
        기본점수: 0,
        미달처리: '0점',
        실기모드: 'special',
        실기배점: [
          { 종목명: '100m', 성별: '남', 기록: '11.0', 배점: '100' },
          { 종목명: '100m', 성별: '남', 기록: '11.5', 배점: '90' },
          { 종목명: '100m', 성별: '남', 기록: '12.0', 배점: '80' },
          { 종목명: '제자리멀리뛰기', 성별: '남', 기록: '280', 배점: '100' },
          { 종목명: '제자리멀리뛰기', 성별: '남', 기록: '270', 배점: '90' },
        ],
      };

      const student: StudentPracticalData = {
        gender: '남',
        practicals: [
          { event: '100m', value: '11.3' },
          { event: '제자리멀리뛰기', value: '275' },
        ],
      };

      const result = calculatePracticalScore(formula, student);
      expect(result.totalScore).toBeDefined();
      expect(result.calculationLog.length).toBeGreaterThan(0);
    });

    it('Special 모드 - U_ID 3 (전체 합산 + 기본점수)', () => {
      const formula: PracticalFormulaData = {
        U_ID: 3, // 전체 합산 + 기본점수 1
        학년도: 2026,
        실기총점: 300,
        기본점수: 0,
        미달처리: '0점',
        실기모드: 'special',
        실기배점: [
          { 종목명: '100m', 성별: '남', 기록: '11.0', 배점: '100' },
          { 종목명: '100m', 성별: '남', 기록: '12.0', 배점: '80' },
          { 종목명: '제자리멀리뛰기', 성별: '남', 기록: '280', 배점: '100' },
          { 종목명: '제자리멀리뛰기', 성별: '남', 기록: '260', 배점: '80' },
          { 종목명: '윗몸일으키기', 성별: '남', 기록: '60', 배점: '100' },
          { 종목명: '윗몸일으키기', 성별: '남', 기록: '50', 배점: '80' },
        ],
      };

      const student: StudentPracticalData = {
        gender: '남',
        practicals: [
          { event: '100m', value: '11.5' }, // → 100점
          { event: '제자리멀리뛰기', value: '270' }, // → 80점
          { event: '윗몸일으키기', value: '55' }, // → 80점
        ],
      };

      const result = calculatePracticalScore(formula, student);
      expect(result.totalScore).toBeDefined();
      // U_ID 3: 전체 합산(100+80+80=260) + 기본점수(1) = 261점
      expect(parseFloat(result.totalScore)).toBe(261);
    });

    it('Special 모드 - U_ID 146 (PASS 카운트 기반)', () => {
      const formula: PracticalFormulaData = {
        U_ID: 146, // PASS 카운트 기반
        학년도: 2026,
        실기총점: 300,
        기본점수: 0,
        미달처리: '0점',
        실기모드: 'special',
        실기배점: [
          { 종목명: '100m', 성별: '남', 기록: '13.0', 배점: 'P' },
          { 종목명: '제자리멀리뛰기', 성별: '남', 기록: '250', 배점: 'P' },
        ],
      };

      const student: StudentPracticalData = {
        gender: '남',
        practicals: [
          { event: '100m', value: '12.5' }, // 13.0 이하 → PASS
          { event: '제자리멀리뛰기', value: '240' }, // 250 미만 → NP
        ],
      };

      const result = calculatePracticalScore(formula, student);
      expect(result.totalScore).toBeDefined();
      expect(result.calculationLog.length).toBeGreaterThan(0);
    });
  });

  describe('어댑터 (구형 포맷 호환)', () => {
    it('구형 포맷 자동 변환', () => {
      const formula: PracticalFormulaData = {
        U_ID: 1,
        학년도: 2026,
        실기총점: 400,
        기본점수: 0,
        미달처리: '0점',
        실기모드: 'basic',
        실기배점: [
          { 종목명: '100m', 성별: '남', 기록: '11.0', 배점: '100' },
          { 종목명: '100m', 성별: '남', 기록: '12.0', 배점: '80' },
        ],
      };

      // 구형 포맷: gender가 practicals 안에 있음
      const oldFormatStudent = {
        practicals: [
          { event: '100m', record: '11.5', gender: '남' as const },
        ],
      };

      const result = calculatePracticalScore(formula, oldFormatStudent as StudentPracticalData);
      expect(result.totalScore).toBeDefined();
      // 어댑터 로그가 포함되어 있는지 확인 (로그 문자열 중 하나에 '어댑터' 포함)
      const hasAdapterLog = result.calculationLog.some(log => log.includes('어댑터'));
      expect(hasAdapterLog).toBe(true);
    });

    it('null 학생 데이터 처리', () => {
      const formula: PracticalFormulaData = {
        U_ID: 1,
        학년도: 2026,
        실기총점: 400,
        기본점수: 0,
        미달처리: '0점',
        실기모드: 'basic',
        실기배점: [],
      };

      const result = calculatePracticalScore(formula, null);
      // 오류 로그가 포함되어 있는지 확인
      const hasErrorLog = result.calculationLog.some(log => log.includes('오류'));
      expect(hasErrorLog).toBe(true);
    });
  });
});
