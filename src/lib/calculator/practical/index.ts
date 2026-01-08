/**
 * 실기 계산 모듈 통합 export
 */

// 메인 계산 함수
export { calculatePracticalScore } from './calculator';

// 배점표 조회 유틸리티
export {
  getEventRules,
  findMaxScore,
  findMinScore,
  lookupDeductionLevel,
  lookupScore,
  convertGradeToScore,
  buildPracticalScoreList,
} from './lookup';

// 특수 규칙 (하드코딩)
export { calcPracticalSpecial } from './special-rules';
