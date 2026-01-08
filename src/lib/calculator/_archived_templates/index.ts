/**
 * 템플릿 기반 계산기
 * 특수공식을 템플릿 + 파라미터로 정규화하여 계산
 */

import { StudentScores, CalculationLog } from '../types';

export type TemplateType =
  | 'basic_ratio'
  | 'top_n_select'
  | 'ranked_weights'
  | 'max_subject'
  | 'normalized'
  | 'weighted_std'
  | 'custom';

export interface TemplateParams {
  // basic_ratio
  국어?: number;
  수학?: number;
  영어?: number;
  탐구?: number;
  탐구수?: number;
  점수유형?: '백분위' | '표준점수' | '변환표준점수';

  // top_n_select
  선택대상?: string[];
  선택개수?: number;
  계산방식?: '평균' | '합계';
  배수?: number;
  기본점?: number;

  // ranked_weights
  가중치?: number[];

  // max_subject
  택1대상?: string[];
  택1비율?: number;
  영어비율?: number;
  탐구비율?: number;

  // normalized
  국어배점?: number;
  수학배점?: number;
  영어처리?: '등급환산' | '비율적용';
  탐구배점?: number;

  // weighted_std
  국어계수?: number;
  수학계수?: number;
  탐구계수?: number;
  영어처리방식?: '등급환산추가' | '제외';
  한국사처리?: '등급환산추가' | '가감점' | '제외';

  // custom
  수식?: string;
  설명?: string;
}

export interface TemplateContext {
  // 점수들
  kor_pct: number;
  kor_std: number;
  math_pct: number;
  math_std: number;
  eng_grade: number;
  eng_grade_score: number;
  inq1_pct: number;
  inq1_std: number;
  inq2_pct: number;
  inq2_std: number;
  inq_avg_pct: number;
  inq_sum_std: number;
  hist_grade: number;
  hist_grade_score: number;

  // 최고점
  kor_max?: number;
  math_max?: number;

  // 설정
  total: number;
  suneung_ratio: number;
}

/**
 * 템플릿 타입에 따른 점수 계산
 */
export function calculateByTemplate(
  templateType: TemplateType,
  params: TemplateParams,
  ctx: TemplateContext,
  logs: CalculationLog[]
): number {
  switch (templateType) {
    case 'basic_ratio':
      return calcBasicRatio(params, ctx, logs);
    case 'top_n_select':
      return calcTopNSelect(params, ctx, logs);
    case 'ranked_weights':
      return calcRankedWeights(params, ctx, logs);
    case 'max_subject':
      return calcMaxSubject(params, ctx, logs);
    case 'weighted_std':
      return calcWeightedStd(params, ctx, logs);
    case 'normalized':
      return calcNormalized(params, ctx, logs);
    case 'custom':
      // 커스텀은 기존 특수공식 방식 사용
      throw new Error('Custom template requires special formula evaluation');
    default:
      throw new Error(`Unknown template type: ${templateType}`);
  }
}

/**
 * 기본 비율 계산
 */
function calcBasicRatio(
  params: TemplateParams,
  ctx: TemplateContext,
  logs: CalculationLog[]
): number {
  const { 국어 = 25, 수학 = 25, 영어 = 25, 탐구 = 25, 점수유형 = '백분위' } = params;

  // 점수 유형에 따른 값 선택
  const korScore = 점수유형 === '표준점수' ? ctx.kor_std : ctx.kor_pct;
  const mathScore = 점수유형 === '표준점수' ? ctx.math_std : ctx.math_pct;
  const inqScore = 점수유형 === '표준점수' ? ctx.inq_avg_pct : ctx.inq_avg_pct; // 탐구는 보통 백분위

  const korPart = korScore * (국어 / 100);
  const mathPart = mathScore * (수학 / 100);
  const engPart = ctx.eng_grade_score * (영어 / 100);
  const inqPart = inqScore * (탐구 / 100);

  const suneungScore = korPart + mathPart + engPart + inqPart;
  const finalScore = suneungScore * (ctx.total / 100) * (ctx.suneung_ratio / 100);

  logs.push({
    step: 'template:basic_ratio',
    detail: `국어${국어}% + 수학${수학}% + 영어${영어}% + 탐구${탐구}%`,
    values: { korPart, mathPart, engPart, inqPart, suneungScore }
  });

  return finalScore + ctx.hist_grade_score;
}

/**
 * 상위 N개 선택 계산
 */
function calcTopNSelect(
  params: TemplateParams,
  ctx: TemplateContext,
  logs: CalculationLog[]
): number {
  const {
    선택대상 = ['국어', '수학', '영어', '탐구'],
    선택개수 = 3,
    계산방식 = '평균',
    배수 = 1,
    기본점 = 0
  } = params;

  // 과목별 점수 매핑
  const subjectScores: Record<string, number> = {
    국어: ctx.kor_pct,
    수학: ctx.math_pct,
    영어: ctx.eng_grade_score,
    탐구: ctx.inq_avg_pct
  };

  // 선택 대상 과목의 점수들
  const scores = 선택대상.map(subj => subjectScores[subj] || 0);

  // 상위 N개 선택
  const sortedScores = [...scores].sort((a, b) => b - a);
  const topN = sortedScores.slice(0, 선택개수);

  // 계산
  const sum = topN.reduce((acc, v) => acc + v, 0);
  const result = 계산방식 === '평균' ? sum / 선택개수 : sum;
  const finalScore = result * 배수 + 기본점;

  logs.push({
    step: 'template:top_n_select',
    detail: `상위 ${선택개수}개 ${계산방식} × ${배수} + ${기본점}`,
    values: { topN, sum, result, finalScore }
  });

  return finalScore * (ctx.suneung_ratio / 100) + ctx.hist_grade_score;
}

/**
 * 가중치 차등 계산 (select_ranked_weights)
 */
function calcRankedWeights(
  params: TemplateParams,
  ctx: TemplateContext,
  logs: CalculationLog[]
): number {
  const {
    선택대상 = ['국어', '수학', '영어', '탐구'],
    가중치 = [0.5, 0.3, 0.2],
    점수유형 = '백분위'
  } = params;

  // 과목별 점수 매핑
  const getScore = (subj: string) => {
    if (subj === '국어') return 점수유형 === '표준점수' ? ctx.kor_std : ctx.kor_pct;
    if (subj === '수학') return 점수유형 === '표준점수' ? ctx.math_std : ctx.math_pct;
    if (subj === '영어') return ctx.eng_grade_score;
    if (subj === '탐구') return ctx.inq_avg_pct;
    return 0;
  };

  // 점수와 과목명 쌍으로 만들기
  const scorePairs = 선택대상.map(subj => ({
    subject: subj,
    score: getScore(subj)
  }));

  // 점수 높은 순 정렬
  scorePairs.sort((a, b) => b.score - a.score);

  // 가중치 적용
  let weightedSum = 0;
  const details: string[] = [];
  for (let i = 0; i < 가중치.length && i < scorePairs.length; i++) {
    const contribution = scorePairs[i].score * 가중치[i];
    weightedSum += contribution;
    details.push(`${scorePairs[i].subject}(${scorePairs[i].score.toFixed(1)})×${가중치[i]}`);
  }

  logs.push({
    step: 'template:ranked_weights',
    detail: details.join(' + '),
    values: { scorePairs, 가중치, weightedSum }
  });

  return weightedSum * (ctx.total / 100) * (ctx.suneung_ratio / 100) + ctx.hist_grade_score;
}

/**
 * 국/수 택1 계산
 */
function calcMaxSubject(
  params: TemplateParams,
  ctx: TemplateContext,
  logs: CalculationLog[]
): number {
  const {
    택1대상 = ['국어', '수학'],
    택1비율 = 40,
    영어비율 = 30,
    탐구비율 = 30
  } = params;

  // 택1 점수 (국어, 수학 중 높은 것)
  const korScore = ctx.kor_pct;
  const mathScore = ctx.math_pct;
  const maxScore = Math.max(korScore, mathScore);
  const selectedSubject = korScore >= mathScore ? '국어' : '수학';

  const maxPart = maxScore * (택1비율 / 100);
  const engPart = ctx.eng_grade_score * (영어비율 / 100);
  const inqPart = ctx.inq_avg_pct * (탐구비율 / 100);

  const suneungScore = maxPart + engPart + inqPart;

  logs.push({
    step: 'template:max_subject',
    detail: `${selectedSubject}(택1) ${택1비율}% + 영어 ${영어비율}% + 탐구 ${탐구비율}%`,
    values: { selectedSubject, maxScore, maxPart, engPart, inqPart }
  });

  return suneungScore * (ctx.total / 100) * (ctx.suneung_ratio / 100) + ctx.hist_grade_score;
}

/**
 * 가중 표준점수 합 계산
 */
function calcWeightedStd(
  params: TemplateParams,
  ctx: TemplateContext,
  logs: CalculationLog[]
): number {
  const {
    국어계수 = 1,
    수학계수 = 1,
    탐구계수 = 1,
    영어처리방식 = '등급환산추가',
    한국사처리 = '등급환산추가'
  } = params;

  let score = 0;
  const parts: string[] = [];

  // 국어
  const korPart = ctx.kor_std * 국어계수;
  score += korPart;
  parts.push(`국어(${ctx.kor_std})×${국어계수}`);

  // 수학
  const mathPart = ctx.math_std * 수학계수;
  score += mathPart;
  parts.push(`수학(${ctx.math_std})×${수학계수}`);

  // 탐구
  const inqPart = ctx.inq_sum_std * 탐구계수;
  score += inqPart;
  parts.push(`탐구(${ctx.inq_sum_std})×${탐구계수}`);

  // 영어
  if (영어처리방식 === '등급환산추가') {
    score += ctx.eng_grade_score;
    parts.push(`영어(${ctx.eng_grade_score})`);
  }

  // 한국사
  if (한국사처리 !== '제외') {
    score += ctx.hist_grade_score;
    parts.push(`한국사(${ctx.hist_grade_score})`);
  }

  logs.push({
    step: 'template:weighted_std',
    detail: parts.join(' + '),
    values: { korPart, mathPart, inqPart, engScore: ctx.eng_grade_score, histScore: ctx.hist_grade_score, score }
  });

  return score;
}

/**
 * 정규화 계산
 */
function calcNormalized(
  params: TemplateParams,
  ctx: TemplateContext,
  logs: CalculationLog[]
): number {
  const {
    국어배점 = 200,
    수학배점 = 200,
    탐구배점 = 200,
    영어처리 = '등급환산'
  } = params;

  // 최고점 기준 정규화
  const korMax = ctx.kor_max || 150;
  const mathMax = ctx.math_max || 150;

  const korPart = (ctx.kor_std / korMax) * 국어배점;
  const mathPart = (ctx.math_std / mathMax) * 수학배점;
  const inqPart = (ctx.inq_avg_pct / 100) * 탐구배점;
  const engPart = 영어처리 === '등급환산' ? ctx.eng_grade_score : (ctx.eng_grade_score / 100) * 200;

  const score = korPart + mathPart + inqPart + engPart + ctx.hist_grade_score;

  logs.push({
    step: 'template:normalized',
    detail: `국어(${ctx.kor_std}/${korMax})×${국어배점} + 수학 + 탐구 + 영어`,
    values: { korPart, mathPart, inqPart, engPart, score }
  });

  return score;
}
