/**
 * 정시엔진 v2 - 타입 정의
 *
 * 기존 jungsical.js, silgical.js의 데이터 구조를 TypeScript로 정의
 */

// ============================================
// 학생 성적 관련 타입
// ============================================

/** 과목명 */
export type SubjectName = '국어' | '수학' | '영어' | '한국사' | '탐구';

/** 탐구 계열 */
export type InquiryGroup = '사탐' | '과탐';

/** 점수 소스 타입 */
export type ScoreSourceType = 'std' | 'pct' | 'grade_conv' | 'conv_std';

/** 개별 과목 성적 */
export interface SubjectScore {
  name: SubjectName;
  subject?: string;           // 선택과목명 (예: "미적분", "생명과학I")
  std?: number;               // 표준점수
  percentile?: number;        // 백분위
  grade?: number;             // 등급 (1-9)
  converted_std?: number;     // 변환표준점수 (탐구용)
  vstd?: number;              // 변환표준점수 별칭
  conv_std?: number;          // 변환표준점수 별칭
  group?: InquiryGroup;       // 탐구 계열
  type?: InquiryGroup;        // 탐구 계열 별칭
}

/** 학생 전체 성적 */
export interface StudentScores {
  subjects: SubjectScore[];
}

/** 파싱된 학생 성적 (내부 사용) */
export interface ParsedStudentScores {
  국어: SubjectScore;
  수학: SubjectScore;
  영어: SubjectScore;
  한국사: SubjectScore;
  탐구: SubjectScore[];
}

// ============================================
// 계산 공식 관련 타입
// ============================================

/** 정규화 방법 */
export type NormalizationMethod = 'fixed_100' | 'fixed_200' | 'highest_of_year';

/** 과목별 설정 */
export interface SubjectConfig {
  enabled: boolean;
  ratio: number;              // 반영비율 (0-100)
  source_type: ScoreSourceType;
  normalization?: {
    method: NormalizationMethod;
  };
}

/** 탐구 과목 설정 */
export interface InquiryConfig extends SubjectConfig {
  count: number;              // 반영 과목 수 (1-2)
}

/** 한국사 설정 */
export interface HistoryConfig {
  mode: 'subject' | 'bonus'; // 과목 반영 또는 가산점
  ratio: number;
}

/** 전체 과목 설정 */
export interface SubjectsConfig {
  korean: SubjectConfig;
  math: SubjectConfig;
  english: SubjectConfig;
  inquiry: InquiryConfig;
  history: HistoryConfig;
}

/** 선택과목 규칙 타입 */
export type SelectionRuleType = 'select_n' | 'select_ranked_weights';

/** 선택과목 규칙 */
export interface SelectionRule {
  type: SelectionRuleType;
  from: SubjectName[];        // 선택 대상 과목
  count?: number;             // select_n용: 선택 개수
  weights?: number[];         // select_ranked_weights용: 가중치 배열
}

/** 가산점 규칙 타입 */
export type BonusRuleType = 'percent_bonus' | 'fixed_bonus';

/** 가산점 규칙 */
export interface BonusRule {
  type: BonusRuleType;
  subjects: string[];         // 적용 과목명 (예: ["미적분", "기하"])
  value: number;              // 가산점 값 (percent_bonus: 0.1 = 10%, fixed_bonus: 절대값)
}

/** score_config (DB JSON) */
export interface ScoreConfig {
  korean_math?: {
    type: '표준점수' | '백분위';
    max_score_method?: NormalizationMethod;
  };
  inquiry?: {
    type: '표준점수' | '백분위' | '변환표준점수';
    max_score_method?: NormalizationMethod;
  };
  english?: {
    type?: 'fixed_max_score';
    max_score?: number;
  };
  math_bonus_cap_100?: boolean;
  highest_exam?: string;      // 최고표점 기준 모형 (예: "수능")
}

/** 기타 설정 */
export interface OtherSettings {
  한국사우선적용?: boolean;
}

/** 계산 공식 전체 데이터 (DB formula_configs + 정시반영비율) */
export interface FormulaData {
  // 기본 정보
  U_ID?: number;              // 레거시 ID (cafe24)
  dept_id?: number;           // 새 ID
  학년도: number;

  // 점수 설정
  총점: number;               // 총점 (기본 1000)
  수능: number;               // 수능 반영비율 (0-100)

  // 과목별 반영비율
  국어: number;
  수학: number;
  영어: number;
  탐구: number;
  탐구수: number | string;    // 탐구 반영 과목 수
  한국사: number;

  // JSON 설정
  score_config?: ScoreConfig | string;
  selection_rules?: SelectionRule[] | string;
  bonus_rules?: BonusRule[] | string;
  english_scores?: Record<string, number> | string;  // 등급별 환산점수
  history_scores?: Record<string, number> | string;  // 한국사 등급별 점수
  english_bonus_scores?: Record<string, number> | string;
  english_bonus_fixed?: number;
  기타설정?: OtherSettings | string;

  // 특수공식
  계산유형?: '기본비율' | '특수공식';
  특수공식?: string;          // 특수공식 문자열

  // 탐구 변환표 (런타임에 주입)
  탐구변표?: {
    사탐: Record<string, number>;
    과탐: Record<string, number>;
  };

  // 영어 처리 관련
  영어처리?: string;
  영어비고?: string;
}

// ============================================
// 특수 규칙 관련 타입 (신규 DB 테이블용)
// ============================================

/** 특수 수능 계산 규칙 타입 */
export type SpecialCalcRuleType =
  | 'grade_based'           // 등급 기반 (선문대)
  | 'grade_average_lookup'  // 등급 평균 → 환산 (경동대)
  | 'weighted_sum'          // 가중 합산
  | 'formula';              // 커스텀 공식

/** 등급 기반 규칙 설정 */
export interface GradeBasedRuleConfig {
  type: 'grade_based';
  subjects: ('korean' | 'math' | 'english' | 'inquiry')[];
  select_count: number;       // 상위 N개 선택
  grade_table: Record<string, number>;  // 등급 → 점수
  history_mode: 'add' | 'ignore';       // 한국사 처리
}

/** 등급 평균 환산 규칙 설정 */
export interface GradeAverageLookupConfig {
  type: 'grade_average_lookup';
  subjects: ('korean' | 'math' | 'english' | 'inquiry_top1')[];
  lookup_table: Record<string, number>; // 등급(반올림) → 점수
}

/** 특수 수능 계산 규칙 */
export interface SpecialCalcRule {
  id?: number;
  dept_id: number;
  rule_type: SpecialCalcRuleType;
  rule_config: GradeBasedRuleConfig | GradeAverageLookupConfig | Record<string, unknown>;
  priority: number;
}

// ============================================
// 실기 관련 타입
// ============================================

/** 실기 기록 방식 */
export type RecordMethod = 'lower_is_better' | 'higher_is_better';

/** 실기 모드 */
export type PracticalMode = 'basic' | 'special';

/** 실기 배점 레코드 */
export interface PracticalScoreRecord {
  종목명: string;
  성별: '남' | '여' | '공통';
  기록: string | number;
  배점: string | number;      // DB에서 문자열로 올 수 있음
  점수?: number;              // 별칭
  급간?: string | number;     // 감수 레벨
}

/** 학생 실기 기록 */
export interface StudentPracticalRecord {
  event: string;              // 종목명
  value?: string | number;    // 기록
  record?: string | number;   // 기록 별칭
  gender?: '남' | '여';       // 성별 (구형 포맷)
}

/** 학생 실기 데이터 */
export interface StudentPracticalData {
  gender: '남' | '여';
  practicals: StudentPracticalRecord[];
}

/** 실기 계산용 학교 데이터 */
export interface PracticalFormulaData {
  U_ID?: number;
  dept_id?: number;
  실기모드: PracticalMode;
  실기총점: number;
  기본점수: number;
  미달처리: '0점' | '최하점';
  실기배점: PracticalScoreRecord[];
  실기특수설정?: Record<string, unknown> | string;
}

/** 실기 특수 규칙 타입 */
export type PracticalRuleType =
  | 'weighted'      // 가중치 합산
  | 'top_n'         // 상위 N개
  | 'pass_count'    // 합격 개수
  | 'formula'       // 커스텀 공식
  | 'average';      // 평균

/** 실기 특수 규칙 */
export interface PracticalCalcRule {
  id?: number;
  dept_id: number;
  rule_type: PracticalRuleType;
  rule_config: Record<string, unknown>;
}

/** 종목별 계산 결과 */
export interface EventBreakdown {
  event: string;
  record: string | number;
  score: number | null;
  rawGrade?: string | number;
  deduction_level: number | null;  // 감수 (급간)
  maxScore?: number;
}

// ============================================
// 계산 결과 타입
// ============================================

/** 수능 계산 결과 breakdown */
export interface SuneungBreakdown {
  base?: number;              // 기본 점수
  select?: number;            // 선택과목 점수
  history?: number;           // 한국사 점수
  english_bonus?: number;     // 영어 보정
  special?: number;           // 특수공식 결과
}

/** 실기 계산 결과 breakdown */
export interface PracticalBreakdown {
  events: EventBreakdown[];
  practical_raw_sum: number;
  total_deduction_level: number;
}

/** 계산 결과 */
export interface CalculationResult {
  totalScore: string;         // 소수점 2자리 문자열
  breakdown: SuneungBreakdown | PracticalBreakdown | Record<string, unknown>;
  calculationLog: string[];
}

// ============================================
// 특수공식 컨텍스트 타입
// ============================================

/** 특수공식 변수 컨텍스트 */
export interface SpecialFormulaContext {
  // 기본
  total: number;
  suneung_ratio: number;

  // 국어/수학
  kor_std: number;
  kor_pct: number;
  kor_max: number;
  math_std: number;
  math_pct: number;
  math_max: number;

  // 반영비율
  ratio_kor: number;
  ratio_math: number;
  ratio_inq: number;
  ratio_kor_norm: number;
  ratio_math_norm: number;
  ratio_inq_norm: number;
  ratio5_kor: number;
  ratio5_math: number;
  ratio5_inq: number;

  // 영어
  eng_grade_score: number;
  eng_max: number;
  eng_pct_est: number;

  // 한국사
  hist_grade_score: number;

  // 탐구
  inq1_converted_std: number;
  inq2_converted_std: number;
  inq_sum2_converted_std: number;
  inq_avg2_converted_std: number;
  inq1_std: number;
  inq2_std: number;
  inq1_max_std: number;
  inq2_max_std: number;
  inq_sum2_std: number;
  inq_avg2_std: number;
  inq1_percentile: number;
  inq2_percentile: number;
  inq_sum2_percentile: number;
  inq_avg2_percentile: number;

  // 상위 N개 조합
  top3_avg_pct_kor_math_inq1: number;
  top3_avg_pct_kor_eng_math_inq1: number;
  top3_avg_pct: number;
  top2_avg_pct_kme: number;
  top3_avg_pct_kme_inqAvg: number;
  top3_avg_pct_kme_inqAvg_mathBonus: number;
  top1_math_or_eng_pct: number;
  top2_sum_scaled60_kme_inqAvg: number;
  top2_kmInq_scaled_80_x_6: number;
  top2_kmInq_scaled_80_x_7: number;
  top2_sum_norm_pct_kmi2: number;
  top2_sum_raw_pct_kmi2: number;
  top2_sum_raw_pct_kme: number;
  top2_sum_scaled_kme: number;
  top3_sum_std_kme_inq1_doubled: number;

  // 파생 변수
  math_bonus_pct_10: number;
  math_std_bonused: number;
  math_pct_bonused: number;
  max_kor_math_std: number;
  max_kor_math_pct: number;
  inq1_social_boost: number;
  inq2_social_boost: number;

  // 동적 추가 가능
  [key: string]: number;
}

// ============================================
// 최고표점/등급컷 타입
// ============================================

/** 최고표점 */
export interface HighestScore {
  year_id: number;
  모형: string;               // 예: "수능"
  과목명: string;
  최고점: number;
}

/** 최고표점 맵 (과목명 → 점수) */
export type HighestScoreMap = Record<string, number>;

/** 등급컷 */
export interface GradeCut {
  year_id: number;
  모형: string;
  선택과목명: string;
  등급: number;
  원점수: number | null;
  표준점수: number | null;
  백분위: number | null;
}

// ============================================
// DB 테이블 타입 (레거시 cafe24)
// ============================================

/** 정시기본 테이블 */
export interface JungsiBasic {
  U_ID: number;
  학년도: number;
  군: string;
  대학명: string;
  학과명: string;
  모집정원: string;
  형태?: string;
  교직?: string;
  단계별?: string;
}

/** 정시반영비율 테이블 */
export interface JungsiRatio {
  id: number;
  U_ID: number;
  학년도: number;
  계산방식: string;
  총점: number;
  계산유형: string;
  수능: string;
  국어: string;
  수학: string;
  영어: string;
  탐구: string;
  탐구수: string;
  한국사: string;
  english_scores?: string;
  history_scores?: string;
  selection_rules?: string;
  bonus_rules?: string;
  score_config?: string;
  특수공식?: string;
  기타설정?: string;
  실기모드: string;
  실기총점: number;
  기본점수: number;
  미달처리: string;
  실기특수설정?: string;
}
