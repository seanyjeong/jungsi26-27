/**
 * 정시엔진 v2 - 계산 모듈 메인 진입점
 *
 * 수능/실기 점수 계산 및 관련 유틸리티 통합 export
 */

// ============================================
// 타입 정의
// ============================================
export type {
  // 학생 성적 관련
  SubjectName,
  InquiryGroup,
  ScoreSourceType,
  SubjectScore,
  StudentScores,
  ParsedStudentScores,

  // 계산 공식 관련
  NormalizationMethod,
  SubjectConfig,
  InquiryConfig,
  HistoryConfig,
  SubjectsConfig,
  SelectionRuleType,
  SelectionRule,
  BonusRuleType,
  BonusRule,
  ScoreConfig,
  OtherSettings,
  FormulaData,

  // 특수 규칙 관련
  SpecialCalcRuleType,
  GradeBasedRuleConfig,
  GradeAverageLookupConfig,
  SpecialCalcRule,

  // 실기 관련
  RecordMethod,
  PracticalMode,
  PracticalScoreRecord,
  StudentPracticalRecord,
  StudentPracticalData,
  PracticalFormulaData,
  PracticalRuleType,
  PracticalCalcRule,
  EventBreakdown,

  // 계산 결과 관련
  SuneungBreakdown,
  PracticalBreakdown,
  CalculationResult,

  // 특수공식 컨텍스트
  SpecialFormulaContext,

  // 최고표점/등급컷
  HighestScore,
  HighestScoreMap,
  GradeCut,

  // DB 테이블 타입 (레거시)
  JungsiBasic,
  JungsiRatio,
} from './types';

// ============================================
// 수능 계산
// ============================================
export {
  // 메인 계산 함수
  calculateScore,
  calculateScoreWithConv,

  // 정규화 유틸리티
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

  // 특수공식
  buildSpecialContext,
  evaluateSpecialFormula,
  validateSpecialFormula,
  extractFormulaVariables,
} from './suneung/index';

// ============================================
// 실기 계산
// ============================================
export {
  // 메인 계산 함수
  calculatePracticalScore,

  // 배점표 조회 유틸리티
  getEventRules,
  findMaxScore,
  findMinScore,
  lookupDeductionLevel,
  lookupScore,
  convertGradeToScore,
  buildPracticalScoreList,

  // 특수 규칙
  calcPracticalSpecial,
} from './practical/index';

// ============================================
// 공통 유틸리티
// ============================================
export {
  // 등급컷 보간
  interpolateScore,
  mapPercentileToConverted,
  getEnglishGrade,
  getHistoryGrade,

  // 안전 파싱
  safeParse,
  safeNumber,
  safeInt,
  safeString,
  safeArray,
} from './utils/index';
