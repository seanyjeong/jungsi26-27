/**
 * 수능 계산 모듈 통합 export
 */

// 메인 계산 함수
export { calculateScore, calculateScoreWithConv } from './calculator';

// 정규화 유틸리티
export {
  pickByType,
  kmSubjectNameForKorean,
  kmSubjectNameForMath,
  inquirySubjectName,
  resolveTotal,
  detectEnglishAsBonus,
  isSubjectUsedInRules,
  calcInquiryRepresentative,
  resolveMaxScores,
  readConvertedStd,
  guessInquiryGroup,
} from './normalizer';

// 특수공식
export { buildSpecialContext } from './special-context';
export {
  evaluateSpecialFormula,
  validateSpecialFormula,
  extractFormulaVariables,
} from './formula-eval';
