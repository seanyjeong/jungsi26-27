/**
 * 실기 배점표 조회 유틸리티
 *
 * 종목별 기록 방식 판단, 배점 매칭, 최고/최저점 조회 등
 */

import type { PracticalScoreRecord, RecordMethod } from '../types';

/** 최하점 계산에서 제외할 키워드 */
const FORCE_MIN_SCORE_KEYWORDS = ['F', 'G', '미응시', '파울', '실격'];
const KEYWORDS_TO_IGNORE = ['F', 'G', '미응시', '파울', '실격', 'P', 'PASS'];

/** 종목명으로 기록 방식 판단 */
export function getEventRules(eventName: string | null | undefined): {
  method: RecordMethod;
} {
  const name = eventName || '';
  const LOW_IS_BETTER_KEYWORDS = ['m', 'run', '왕복', '초', '벽', '지그', 'z'];

  let method: RecordMethod = 'higher_is_better';

  if (LOW_IS_BETTER_KEYWORDS.some((k) => name.includes(k))) {
    method = 'lower_is_better';
  }
  // 던지기, 멀리뛰기는 높을수록 좋음
  if (name.includes('던지기') || name.includes('멀리뛰기')) {
    method = 'higher_is_better';
  }

  return { method };
}

/** 배점표에서 해당 종목의 최고 배점(만점) 찾기 */
export function findMaxScore(scoreTable: PracticalScoreRecord[]): number {
  if (!scoreTable || scoreTable.length === 0) return 0;

  const max = scoreTable
    .map((l) => Number(l.배점))
    .filter((n) => !Number.isNaN(n))
    .reduce((m, cur) => Math.max(m, cur), 0);

  return max;
}

/** 배점표에서 순수 숫자 최하점 찾기 (F, P 등 제외) */
export function findMinScore(scoreTable: PracticalScoreRecord[]): string {
  if (!scoreTable || scoreTable.length === 0) return '0';

  const allScores: number[] = [];

  for (const level of scoreTable) {
    const recordStr = String(level.기록).trim().toUpperCase();

    // F, G, P 같은 건 최하점 계산에서 제외
    if (KEYWORDS_TO_IGNORE.includes(recordStr)) {
      continue;
    }

    const score = Number(level.배점);
    if (!Number.isNaN(score)) {
      allScores.push(score);
    }
  }

  if (allScores.length > 0) {
    return String(Math.min(...allScores));
  } else {
    return '0';
  }
}

/** "감수" (급간 레벨) 찾기 (100점 → 0감, 98점 → 1감 ...) */
export function lookupDeductionLevel(
  studentScore: number | string,
  scoreTable: PracticalScoreRecord[]
): number {
  if (!scoreTable || scoreTable.length === 0) return 0;

  const allScores = Array.from(
    new Set(
      scoreTable.map((l) => Number(l.배점)).filter((n) => !Number.isNaN(n))
    )
  );

  allScores.sort((a, b) => b - a);

  const studentScoreNum = Number(studentScore);
  if (Number.isNaN(studentScoreNum)) return 0;

  const levelIndex = allScores.indexOf(studentScoreNum);
  return levelIndex === -1 ? 0 : levelIndex;
}

/** 학생 기록으로 배점 등급 찾기 */
export function lookupScore(
  studentRecord: string | number | null | undefined,
  method: RecordMethod,
  scoreTable: PracticalScoreRecord[],
  outOfRangeRule: '0점' | '최하점'
): string {
  if (!scoreTable || scoreTable.length === 0) {
    return '0';
  }

  const studentValueStr = String(studentRecord ?? '').trim().toUpperCase();

  // F/G/미응시 등은 최하점 처리
  if (FORCE_MIN_SCORE_KEYWORDS.includes(studentValueStr)) {
    return findMinScore(scoreTable);
  }

  const studentValueNum = Number(studentValueStr);
  const isNumericInput = !Number.isNaN(studentValueNum) && studentValueStr !== '';

  const numericLevels: Array<{ record: number; grade: number }> = [];
  const exactMatchLevels = new Map<string, number>();
  const rangeLevels: Array<{ rangeStr: string; grade: number }> = [];

  for (const level of scoreTable) {
    const recordStr = String(level.기록).trim();
    const recordNum = Number(recordStr);
    const gradeNum = Number(level.배점);

    if (!Number.isNaN(recordNum) && recordStr !== '') {
      numericLevels.push({ record: recordNum, grade: gradeNum });
    } else if (
      recordStr.includes('이상') ||
      recordStr.includes('이하') ||
      recordStr.includes('초과') ||
      recordStr.includes('미만')
    ) {
      rangeLevels.push({ rangeStr: recordStr, grade: gradeNum });
    } else {
      exactMatchLevels.set(recordStr.toUpperCase(), gradeNum);
    }
  }

  // 1순위: 문자(P/F 등) 정확히 일치
  if (exactMatchLevels.has(studentValueStr)) {
    return String(exactMatchLevels.get(studentValueStr));
  }

  if (isNumericInput) {
    // 2순위: "200 이상" 같은 범위
    for (const level of rangeLevels) {
      const parts = level.rangeStr.match(/([0-9.]+)\s*(이상|이하|초과|미만)/);
      if (parts && parts[1]) {
        const limit = Number(parts[1]);
        const type = parts[2];
        if (type === '이상' && studentValueNum >= limit) return String(level.grade);
        if (type === '이하' && studentValueNum <= limit) return String(level.grade);
        if (type === '초과' && studentValueNum > limit) return String(level.grade);
        if (type === '미만' && studentValueNum < limit) return String(level.grade);
      }
    }

    // 3순위: 단순 숫자 비교
    if (numericLevels.length > 0) {
      if (method === 'lower_is_better') {
        numericLevels.sort((a, b) => b.record - a.record);
        for (const level of numericLevels) {
          if (studentValueNum >= level.record) return String(level.grade);
        }
        if (studentValueNum < numericLevels[numericLevels.length - 1].record) {
          return String(numericLevels[numericLevels.length - 1].grade);
        }
      } else {
        numericLevels.sort((a, b) => b.record - a.record);
        for (const level of numericLevels) {
          if (studentValueNum >= level.record) return String(level.grade);
        }
        if (numericLevels.length > 0) {
          return String(numericLevels[numericLevels.length - 1].grade);
        }
      }
    }
  }

  // 4순위: 어디에도 안 맞는 경우
  if (outOfRangeRule === '최하점') {
    return findMinScore(scoreTable);
  } else {
    return '0';
  }
}

/** 배점 등급 → 최종 점수 환산 (P/PASS → 100, NP/FAIL → 0) */
export function convertGradeToScore(
  grade: string | number,
  _U_ID?: number,
  _eventName?: string
): number {
  const g = String(grade).toUpperCase();

  if (g === 'P' || g === 'PASS') return 100;
  if (g === 'NP' || g === 'N' || g === 'FAIL') return 0;

  const score = Number(grade);
  return Number.isNaN(score) ? 0 : score;
}

/** 학생 실기 기록을 배점표와 매칭하여 종목별 점수 배열 반환 */
export function buildPracticalScoreList(
  studentRecords: Array<{ event?: string; 종목명?: string; record?: string | number; value?: string | number }>,
  scoreTable: PracticalScoreRecord[],
  studentGender: string
): Array<{
  event: string;
  record: string | number;
  score: number;
  maxScore: number;
}> {
  const out: Array<{
    event: string;
    record: string | number;
    score: number;
    maxScore: number;
  }> = [];

  for (const rec of studentRecords) {
    const eventName = rec.event || rec.종목명;
    if (!eventName) continue;

    const tableForEvent = scoreTable.filter((row) => {
      if (studentGender && row.성별 && row.성별 !== studentGender && row.성별 !== '공통') {
        return false;
      }
      return row.종목명 === eventName;
    });

    const { method } = getEventRules(eventName);
    const studentRawRecord = rec.record !== undefined ? rec.record : rec.value;

    const score = lookupScore(studentRawRecord, method, tableForEvent, '0점');
    const maxScore = findMaxScore(tableForEvent);

    out.push({
      event: eventName,
      record: studentRawRecord ?? '',
      score: Number(score || 0),
      maxScore: Number(maxScore || 100),
    });
  }

  return out;
}
