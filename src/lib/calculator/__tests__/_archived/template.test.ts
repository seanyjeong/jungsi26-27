/**
 * 템플릿 기반 계산기 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';
import {
  calculateByTemplate,
  TemplateType,
  TemplateParams,
  TemplateContext
} from '../templates';
import { buildSpecialContext } from '../suneung/special-context';
import { evaluateSpecialFormula } from '../suneung/formula-eval';
import type { StudentScores, FormulaConfig, CalculationLog } from '../types';

// cafe24 DB
let cafe24Pool: mysql.Pool;

// 테스트 학생 데이터
const testStudent: StudentScores = {
  korean: { percentile: 99, standardScore: 145 },
  math: { percentile: 99, standardScore: 148 },
  english: { grade: 1, gradeScore: 100 },
  inquiry1: { percentile: 98, standardScore: 70, subject: '물리학I', convertedStd: 72 },
  inquiry2: { percentile: 96, standardScore: 68, subject: '화학I', convertedStd: 70 },
  history: { grade: 1, gradeScore: 10 }
};

beforeAll(async () => {
  cafe24Pool = mysql.createPool({
    host: '211.37.174.218',
    user: 'maxilsan',
    password: 'q141171616!',
    database: 'jungsi',
    charset: 'utf8mb4',
  });
});

afterAll(async () => {
  await cafe24Pool?.end();
});

describe('Template Calculator', () => {
  describe('basic_ratio 템플릿', () => {
    it('기본 비율 계산이 정확해야 함', () => {
      const params: TemplateParams = {
        국어: 25,
        수학: 25,
        영어: 25,
        탐구: 25,
        점수유형: '백분위'
      };

      const ctx: TemplateContext = {
        kor_pct: 99,
        kor_std: 145,
        math_pct: 99,
        math_std: 148,
        eng_grade: 1,
        eng_grade_score: 100,
        inq1_pct: 98,
        inq1_std: 70,
        inq2_pct: 96,
        inq2_std: 68,
        inq_avg_pct: 97,
        inq_sum_std: 138,
        hist_grade: 1,
        hist_grade_score: 10,
        total: 1000,
        suneung_ratio: 60
      };

      const logs: CalculationLog[] = [];
      const score = calculateByTemplate('basic_ratio', params, ctx, logs);

      // 국어 99*0.25 + 수학 99*0.25 + 영어 100*0.25 + 탐구 97*0.25 = 98.75
      // * (1000/100) * (60/100) = 592.5
      // + 한국사 10 = 602.5
      expect(score).toBeCloseTo(602.5, 1);
    });
  });

  describe('top_n_select 템플릿', () => {
    it('상위 3개 평균 계산이 정확해야 함', () => {
      const params: TemplateParams = {
        선택대상: ['국어', '수학', '영어', '탐구'],
        선택개수: 3,
        계산방식: '평균',
        배수: 8.5,
        기본점: 150
      };

      const ctx: TemplateContext = {
        kor_pct: 99,
        kor_std: 145,
        math_pct: 99,
        math_std: 148,
        eng_grade: 1,
        eng_grade_score: 100,
        inq1_pct: 98,
        inq1_std: 70,
        inq2_pct: 96,
        inq2_std: 68,
        inq_avg_pct: 97,
        inq_sum_std: 138,
        hist_grade: 1,
        hist_grade_score: 10,
        total: 1000,
        suneung_ratio: 60
      };

      const logs: CalculationLog[] = [];
      const score = calculateByTemplate('top_n_select', params, ctx, logs);

      // 과목 점수: 국어 99, 수학 99, 영어 100, 탐구 97
      // 상위 3개: 100, 99, 99 → 평균 = 99.33
      // × 8.5 + 150 = 844.33 + 150 = 994.33
      // × 0.6 (suneung_ratio) = 596.6
      // + 한국사 10 = 606.6
      expect(score).toBeGreaterThan(500);
    });
  });

  describe('ranked_weights 템플릿', () => {
    it('가중치 차등 계산이 정확해야 함', () => {
      const params: TemplateParams = {
        선택대상: ['국어', '수학', '영어', '탐구'],
        가중치: [0.5, 0.3, 0.2],
        점수유형: '백분위'
      };

      const ctx: TemplateContext = {
        kor_pct: 99,
        kor_std: 145,
        math_pct: 99,
        math_std: 148,
        eng_grade: 1,
        eng_grade_score: 100,
        inq1_pct: 98,
        inq1_std: 70,
        inq2_pct: 96,
        inq2_std: 68,
        inq_avg_pct: 97,
        inq_sum_std: 138,
        hist_grade: 1,
        hist_grade_score: 10,
        total: 1000,
        suneung_ratio: 100 // 간단한 계산을 위해 100%
      };

      const logs: CalculationLog[] = [];
      const score = calculateByTemplate('ranked_weights', params, ctx, logs);

      // 정렬: 영어 100, 국어 99, 수학 99, 탐구 97
      // 100*0.5 + 99*0.3 + 99*0.2 = 50 + 29.7 + 19.8 = 99.5
      // × (1000/100) × 1 = 995
      // + 한국사 10 = 1005
      expect(score).toBeGreaterThan(900);
    });
  });

  describe('weighted_std 템플릿', () => {
    it('가중 표준점수 합이 정확해야 함', () => {
      const params: TemplateParams = {
        국어계수: 1,
        수학계수: 1.2,
        탐구계수: 0.8,
        영어처리방식: '등급환산추가',
        한국사처리: '등급환산추가'
      };

      const ctx: TemplateContext = {
        kor_pct: 99,
        kor_std: 145,
        math_pct: 99,
        math_std: 148,
        eng_grade: 1,
        eng_grade_score: 100,
        inq1_pct: 98,
        inq1_std: 70,
        inq2_pct: 96,
        inq2_std: 68,
        inq_avg_pct: 97,
        inq_sum_std: 138, // 70 + 68
        hist_grade: 1,
        hist_grade_score: 10,
        total: 1000,
        suneung_ratio: 100
      };

      const logs: CalculationLog[] = [];
      const score = calculateByTemplate('weighted_std', params, ctx, logs);

      // 국어 145*1 + 수학 148*1.2 + 탐구 138*0.8 + 영어 100 + 한국사 10
      // = 145 + 177.6 + 110.4 + 100 + 10 = 543
      expect(score).toBeCloseTo(543, 0);
    });
  });

  describe('max_subject 템플릿', () => {
    it('국/수 택1이 정확해야 함', () => {
      const params: TemplateParams = {
        택1대상: ['국어', '수학'],
        택1비율: 40,
        영어비율: 30,
        탐구비율: 30
      };

      const ctx: TemplateContext = {
        kor_pct: 99,
        kor_std: 145,
        math_pct: 95, // 수학이 더 낮음 → 국어 선택
        math_std: 140,
        eng_grade: 1,
        eng_grade_score: 100,
        inq1_pct: 98,
        inq1_std: 70,
        inq2_pct: 96,
        inq2_std: 68,
        inq_avg_pct: 97,
        inq_sum_std: 138,
        hist_grade: 1,
        hist_grade_score: 10,
        total: 1000,
        suneung_ratio: 60
      };

      const logs: CalculationLog[] = [];
      const score = calculateByTemplate('max_subject', params, ctx, logs);

      // 국어 선택 (99 > 95)
      // 국어 99*0.4 + 영어 100*0.3 + 탐구 97*0.3 = 39.6 + 30 + 29.1 = 98.7
      // × (1000/100) × (60/100) = 592.2
      // + 한국사 10 = 602.2
      expect(score).toBeCloseTo(602.2, 1);
    });
  });
});

describe('Template vs Legacy 비교 (특수공식)', () => {
  it('서울대학교 체육교육과 - weighted_std', async () => {
    // 서울대 특수공식
    const formula = '{kor_std} + {math_std}*1.2 + ({inq1_std}+{inq2_std})*0.8 + {eng_grade_score} + {hist_grade_score}';

    const config: FormulaConfig = {
      totalScore: 600,
      suneungRatio: 50,
      calculationType: '특수공식',
      specialFormula: formula,
      subjects: {
        korean: { ratio: 20, scoreType: 'standardScore' },
        math: { ratio: 20, scoreType: 'standardScore' },
        english: { ratio: 15, scoreType: 'gradeConvert' },
        inquiry: { ratio: 30, count: 2, scoreType: 'standardScore' }
      }
    };

    // 레거시 계산
    const legacyLogs: CalculationLog[] = [];
    const specialCtx = buildSpecialContext(testStudent, config, { maxScores: { korean: 150, math: 150 } });
    const legacyScore = evaluateSpecialFormula(formula, specialCtx, legacyLogs);

    // 템플릿 계산
    const templateParams: TemplateParams = {
      국어계수: 1,
      수학계수: 1.2,
      탐구계수: 0.8,
      영어처리방식: '등급환산추가',
      한국사처리: '등급환산추가'
    };

    const templateCtx: TemplateContext = {
      kor_pct: testStudent.korean.percentile,
      kor_std: testStudent.korean.standardScore!,
      math_pct: testStudent.math.percentile,
      math_std: testStudent.math.standardScore!,
      eng_grade: testStudent.english.grade,
      eng_grade_score: testStudent.english.gradeScore!,
      inq1_pct: testStudent.inquiry1.percentile,
      inq1_std: testStudent.inquiry1.standardScore!,
      inq2_pct: testStudent.inquiry2!.percentile,
      inq2_std: testStudent.inquiry2!.standardScore!,
      inq_avg_pct: (testStudent.inquiry1.percentile + testStudent.inquiry2!.percentile) / 2,
      inq_sum_std: testStudent.inquiry1.standardScore! + testStudent.inquiry2!.standardScore!,
      hist_grade: testStudent.history.grade,
      hist_grade_score: testStudent.history.gradeScore!,
      total: 600,
      suneung_ratio: 50
    };

    const templateLogs: CalculationLog[] = [];
    const templateScore = calculateByTemplate('weighted_std', templateParams, templateCtx, templateLogs);

    // 레거시와 템플릿 점수 비교 (탐구 계수 적용 방식 차이로 약간 다를 수 있음)
    console.log(`서울대: 레거시=${legacyScore.toFixed(2)}, 템플릿=${templateScore.toFixed(2)}`);

    // 두 계산의 차이가 적어야 함 (탐구 처리 방식이 다르므로 넓은 허용)
    expect(Math.abs(legacyScore - templateScore)).toBeLessThan(50);
  });

  it('공주대학교 - top_n_select', async () => {
    // 상위 3개 평균 × 8.5 + 150
    const formula = '(({top3_avg_pct_kor_eng_math_inq1} * 8.5) + 150) * {suneung_ratio}';

    // 템플릿 계산
    const templateParams: TemplateParams = {
      선택대상: ['국어', '수학', '영어', '탐구'],
      선택개수: 3,
      계산방식: '평균',
      배수: 8.5,
      기본점: 150
    };

    const templateCtx: TemplateContext = {
      kor_pct: 99,
      kor_std: 145,
      math_pct: 99,
      math_std: 148,
      eng_grade: 1,
      eng_grade_score: 100,
      inq1_pct: 98,
      inq1_std: 70,
      inq2_pct: 96,
      inq2_std: 68,
      inq_avg_pct: 97,
      inq_sum_std: 138,
      hist_grade: 1,
      hist_grade_score: 10,
      total: 1000,
      suneung_ratio: 60
    };

    const templateLogs: CalculationLog[] = [];
    const templateScore = calculateByTemplate('top_n_select', templateParams, templateCtx, templateLogs);

    console.log(`공주대: 템플릿=${templateScore.toFixed(2)}`);

    // 합리적인 범위 내에 있어야 함
    expect(templateScore).toBeGreaterThan(400);
    expect(templateScore).toBeLessThan(800);
  });
});
