/**
 * 정규화 및 점수 변환 유틸리티
 *
 * 원점수 → 정규화 비율, 최고표점 해석 등
 */

import type {
  SubjectScore,
  ScoreConfig,
  ParsedStudentScores,
  FormulaData,
  HighestScoreMap,
} from '../types';
import { safeParse } from '../utils/safe-parse';

/** 과목 데이터에서 타입에 따른 점수 추출 */
export function pickByType(
  row: SubjectScore | undefined | null,
  type: '표준점수' | '백분위' | '변환표준점수'
): number {
  if (!row) return 0;
  if (type === '표준점수' || type === '변환표준점수') {
    return Number(row.std || 0);
  }
  return Number(row.percentile || 0);
}

/** 국어 과목명 추출 */
export function kmSubjectNameForKorean(row: SubjectScore | undefined): string {
  return row?.subject || '국어';
}

/** 수학 과목명 추출 */
export function kmSubjectNameForMath(row: SubjectScore | undefined): string {
  return row?.subject || '수학';
}

/** 탐구 과목명 추출 */
export function inquirySubjectName(row: SubjectScore | undefined): string {
  return row?.subject || '탐구';
}

/** 총점 해석 (기본 1000) */
export function resolveTotal(F: FormulaData | null | undefined): number {
  const t = Number(F?.총점);
  return Number.isFinite(t) && t > 0 ? t : 1000;
}

/** 영어 가산점 모드 감지 */
export function detectEnglishAsBonus(F: FormulaData): boolean {
  const kw = ['가산점', '가감점', '가점', '감점'];

  if (typeof F?.영어처리 === 'string' && kw.some((k) => F.영어처리!.includes(k))) {
    return true;
  }
  if (typeof F?.영어비고 === 'string' && kw.some((k) => F.영어비고!.includes(k))) {
    return true;
  }

  for (const [k, v] of Object.entries(F)) {
    if (typeof v !== 'string') continue;
    if (k.includes('영어') || k.includes('비고') || k.includes('설명') || k.includes('기타')) {
      if (v.includes('영어') && kw.some((t) => v.includes(t))) return true;
    }
  }

  if (Number(F?.영어 || 0) === 0 && F?.english_scores) return true;

  return false;
}

/** selection_rules에서 특정 과목이 사용되는지 확인 */
export function isSubjectUsedInRules(
  name: string,
  rulesArr: unknown
): boolean {
  const rules = Array.isArray(rulesArr) ? rulesArr : rulesArr ? [rulesArr] : [];
  for (const r of rules) {
    if (!r || !Array.isArray((r as { from?: string[] }).from)) continue;
    if ((r as { from: string[] }).from.includes(name)) return true;
  }
  return false;
}

/** 탐구 대표점수 계산 (상위 N개 평균) */
export function calcInquiryRepresentative(
  inquiryRows: SubjectScore[] | undefined,
  type: '표준점수' | '백분위' | '변환표준점수',
  inquiryCount: number
): {
  rep: number;
  sorted: Array<{ row: SubjectScore; subject: string; val: number }>;
  picked: Array<{ row: SubjectScore; subject: string; val: number }>;
} {
  const key = type === '표준점수' || type === '변환표준점수' ? 'std' : 'percentile';
  const arr = (inquiryRows || [])
    .map((t) => ({
      row: t,
      subject: inquirySubjectName(t),
      val: Number(t?.[key] || 0),
    }))
    .sort((a, b) => b.val - a.val);

  if (arr.length === 0) return { rep: 0, sorted: arr, picked: [] };

  const n = Math.max(1, inquiryCount || 1);
  const picked = arr.slice(0, Math.min(n, arr.length));
  const rep = picked.reduce((s, x) => s + x.val, 0) / picked.length;

  return { rep, sorted: arr, picked };
}

/** 최고표점 결정 */
export function resolveMaxScores(
  scoreConfig: ScoreConfig | null | undefined,
  englishScores: Record<string, number> | null | undefined,
  highestMap: HighestScoreMap | null | undefined,
  S: ParsedStudentScores
): {
  korMax: number;
  mathMax: number;
  engMax: number;
  inqMax: number;
} {
  const kmType = scoreConfig?.korean_math?.type || '백분위';
  const inqType = scoreConfig?.inquiry?.type || '백분위';
  const kmMethod = scoreConfig?.korean_math?.max_score_method || '';
  const inqMethod = scoreConfig?.inquiry?.max_score_method || '';

  let korMax = kmType === '표준점수' || kmMethod === 'fixed_200' ? 200 : 100;
  let mathMax = korMax;
  let inqMax =
    inqType === '표준점수' || inqType === '변환표준점수' || inqMethod === 'fixed_100'
      ? 100
      : 100;

  if (kmMethod === 'highest_of_year' && highestMap) {
    const korKey = kmSubjectNameForKorean(S?.국어);
    const mathKey = kmSubjectNameForMath(S?.수학);
    if (highestMap[korKey] != null) korMax = Number(highestMap[korKey]);
    if (highestMap[mathKey] != null) mathMax = Number(highestMap[mathKey]);
  }

  let engMax = 100;
  if (
    scoreConfig?.english?.type === 'fixed_max_score' &&
    Number(scoreConfig?.english?.max_score)
  ) {
    engMax = Number(scoreConfig.english.max_score);
  } else {
    if (englishScores && typeof englishScores === 'object') {
      const vals = Object.values(englishScores)
        .map(Number)
        .filter((n) => !Number.isNaN(n));
      if (vals.length) engMax = Math.max(...vals);
    }
  }

  return { korMax, mathMax, engMax, inqMax };
}

/** 변환표준점수 읽기 (여러 별칭 지원) */
export function readConvertedStd(t: SubjectScore | null | undefined): number {
  return Number(
    t?.converted_std ?? t?.vstd ?? t?.conv_std ?? t?.std ?? t?.percentile ?? 0
  );
}

/** 탐구 계열 추측 (과목명 기반) */
export function guessInquiryGroup(subjectName: string = ''): '사탐' | '과탐' {
  const s = String(subjectName);
  const sci = ['물리', '화학', '생명', '지구'];
  if (sci.some((w) => s.includes(w))) return '과탐';
  return '사탐';
}
