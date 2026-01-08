/**
 * Phase 2: 점수 검증 스크립트
 *
 * 목적: 새 TypeScript 엔진과 기존 jungsical.js 결과가 100% 일치하는지 검증
 * 실행: npx ts-node scripts/verify-scores.ts
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const mysql = require('mysql2/promise');

// 새 TypeScript 계산 엔진 (컴파일된 JS 사용)
const {
  calculateScoreWithConv: calcTSWithConv,
  calculatePracticalScore: calcPracticalTS,
  safeParse,
} = require('../.build/index');

// 기존 JS 엔진 (helpers 모듈 사용)
const jungsical = require('../js/jungsical').helpers;
const silgical = require('../js/silgical');

// 타입 정의
interface FormulaData {
  U_ID?: number;
  학년도?: number;
  총점: number;
  수능: number;
  국어: number;
  수학: number;
  영어: number;
  탐구: number;
  탐구수: number;
  한국사: number;
  계산유형?: string;
  특수공식?: string;
  score_config?: string | object;
  selection_rules?: string | object;
  bonus_rules?: string | object;
  english_scores?: string | object;
  history_scores?: string | object;
  english_bonus_scores?: string | object;
  영어처리?: string;
  영어비고?: string;
}

interface SubjectScore {
  name: string;
  std?: number;
  percentile?: number;
  grade?: number;
  subject?: string;
}

interface StudentScores {
  subjects: SubjectScore[];
}

interface PracticalScoreRecord {
  종목명: string;
  성별: string;
  기록: string;
  배점: string | number;
}

interface PracticalFormulaData {
  U_ID?: number;
  실기모드: string;
  실기총점: number;
  기본점수: number;
  미달처리: string;
  실기배점: PracticalScoreRecord[];
  실기특수설정?: object | string;
}

interface StudentPracticalData {
  gender: string;
  practicals: Array<{ event: string; value: string }>;
}

const YEAR = 2026;

// DB 연결
const cafe24Pool = mysql.createPool({
  host: '211.37.174.218',
  user: 'maxilsan',
  password: 'q141171616!',
  database: 'jungsi',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
});

// 결과 저장
interface VerificationResult {
  U_ID: number;
  대학명: string;
  학과명: string;
  testCase: string;
  legacyScore: string;
  newScore: string;
  diff: number;
  match: boolean;
  error?: string;
}

const results: VerificationResult[] = [];
let passCount = 0;
let failCount = 0;
let errorCount = 0;

/**
 * 테스트용 학생 데이터 생성 (다양한 케이스)
 */
function generateTestStudents(): Array<{ name: string; data: StudentScores }> {
  return [
    {
      name: '만점형',
      data: {
        subjects: [
          { name: '국어', std: 145, percentile: 99, grade: 1, subject: '화법과작문' },
          { name: '수학', std: 150, percentile: 99, grade: 1, subject: '미적분' },
          { name: '영어', grade: 1 },
          { name: '한국사', grade: 1 },
          { name: '탐구', subject: '생명과학I', std: 70, percentile: 98, grade: 1 },
          { name: '탐구', subject: '지구과학I', std: 68, percentile: 96, grade: 1 },
        ],
      },
    },
    {
      name: '중위권',
      data: {
        subjects: [
          { name: '국어', std: 115, percentile: 70, grade: 4, subject: '언어와매체' },
          { name: '수학', std: 120, percentile: 75, grade: 3, subject: '확률과통계' },
          { name: '영어', grade: 3 },
          { name: '한국사', grade: 3 },
          { name: '탐구', subject: '사회문화', std: 55, percentile: 72, grade: 3 },
          { name: '탐구', subject: '생활과윤리', std: 52, percentile: 68, grade: 4 },
        ],
      },
    },
    {
      name: '하위권',
      data: {
        subjects: [
          { name: '국어', std: 90, percentile: 40, grade: 6, subject: '화법과작문' },
          { name: '수학', std: 85, percentile: 35, grade: 7, subject: '확률과통계' },
          { name: '영어', grade: 6 },
          { name: '한국사', grade: 5 },
          { name: '탐구', subject: '한국지리', std: 45, percentile: 45, grade: 5 },
          { name: '탐구', subject: '세계지리', std: 42, percentile: 40, grade: 6 },
        ],
      },
    },
    {
      name: '과탐전문',
      data: {
        subjects: [
          { name: '국어', std: 125, percentile: 85, grade: 2, subject: '화법과작문' },
          { name: '수학', std: 140, percentile: 95, grade: 1, subject: '기하' },
          { name: '영어', grade: 2 },
          { name: '한국사', grade: 2 },
          { name: '탐구', subject: '물리학I', std: 72, percentile: 99, grade: 1 },
          { name: '탐구', subject: '화학I', std: 70, percentile: 98, grade: 1 },
        ],
      },
    },
  ];
}

/**
 * 실기 테스트용 학생 데이터
 */
function generatePracticalTestStudents(): Array<{ name: string; data: StudentPracticalData }> {
  return [
    {
      name: '남학생_상위',
      data: {
        gender: '남',
        practicals: [
          { event: '100m', value: '11.5' },
          { event: '제자리멀리뛰기', value: '285' },
          { event: '윗몸일으키기', value: '55' },
          { event: '배근력', value: '180' },
        ],
      },
    },
    {
      name: '남학생_중위',
      data: {
        gender: '남',
        practicals: [
          { event: '100m', value: '12.5' },
          { event: '제자리멀리뛰기', value: '260' },
          { event: '윗몸일으키기', value: '45' },
          { event: '배근력', value: '150' },
        ],
      },
    },
    {
      name: '여학생_상위',
      data: {
        gender: '여',
        practicals: [
          { event: '100m', value: '14.0' },
          { event: '제자리멀리뛰기', value: '220' },
          { event: '윗몸일으키기', value: '45' },
          { event: '배근력', value: '100' },
        ],
      },
    },
  ];
}

/**
 * cafe24 DB에서 모든 학교 데이터 가져오기
 */
async function getAllFormulaData(): Promise<any[]> {
  const [rows] = await cafe24Pool.execute(
    `SELECT b.*, r.*, b.대학명, b.학과명
     FROM 정시기본 b
     LEFT JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
     WHERE b.학년도 = ?
     ORDER BY b.U_ID`,
    [YEAR]
  );
  return rows;
}

/**
 * cafe24 DB에서 최고표점 가져오기
 */
async function getHighestScores(): Promise<Record<string, number>> {
  const [rows] = await cafe24Pool.execute(
    `SELECT * FROM 정시최고표점 WHERE 학년도 = ? AND 모형 = '수능'`,
    [YEAR]
  );

  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.과목명] = Number(row.최고점) || 0;
  }
  return map;
}

/**
 * cafe24 DB에서 실기 배점 가져오기
 */
async function getPracticalScores(U_ID: number): Promise<any[]> {
  const [rows] = await cafe24Pool.execute(
    `SELECT * FROM 정시실기배점 WHERE 학년도 = ? AND U_ID = ?`,
    [YEAR, U_ID]
  );
  return rows;
}

/**
 * 탐구 변환표 가져오기
 */
async function getConversionTable(U_ID: number): Promise<Record<string, Record<number, number>>> {
  const [rows] = await cafe24Pool.execute(
    `SELECT * FROM 정시탐구변환표준 WHERE 학년도 = ? AND U_ID = ?`,
    [YEAR, U_ID]
  );

  const convMap: Record<string, Record<number, number>> = {};
  for (const row of rows) {
    const key = row.계열 || '자연';
    if (!convMap[key]) convMap[key] = {};
    convMap[key][Number(row.백분위)] = Number(row.변환표준점수);
  }
  return convMap;
}

/**
 * FormulaData 형식으로 변환 (새 엔진용)
 */
function toFormulaData(row: any): FormulaData {
  return {
    U_ID: row.U_ID,
    학년도: row.학년도,
    총점: Number(row.총점) || 1000,
    수능: Number(row.수능) || 0,
    국어: Number(row.국어) || 0,
    수학: Number(row.수학) || 0,
    영어: Number(row.영어) || 0,
    탐구: Number(row.탐구) || 0,
    탐구수: Number(row.탐구수) || 2,
    한국사: Number(row.한국사) || 0,
    계산유형: row.계산유형,
    특수공식: row.특수공식,
    score_config: row.score_config,
    selection_rules: row.selection_rules,
    bonus_rules: row.bonus_rules,
    english_scores: row.english_scores,
    history_scores: row.history_scores,
    english_bonus_scores: row.english_bonus_scores,
    영어처리: row.영어처리,
    영어비고: row.영어비고,
  };
}

/**
 * 수능 점수 비교
 */
async function verifySuneungScore(
  row: any,
  testStudent: { name: string; data: StudentScores },
  highestMap: Record<string, number>,
  convMap: Record<string, Record<number, number>> | null
) {
  const uid = row.U_ID;
  const univName = row.대학명;
  const deptName = row.학과명;

  try {
    // 기존 엔진 계산
    const legacyResult = jungsical.calculateScoreWithConv(
      row,
      testStudent.data,
      convMap, // 변환표준점수 테이블
      () => {}, // logHook
      highestMap
    );

    // 새 엔진 계산 (레거시와 동일하게 raw row 전달)
    const newResult = calcTSWithConv(row, testStudent.data, convMap, null, highestMap);

    const legacyScore = parseFloat(legacyResult?.totalScore || '0');
    const newScore = parseFloat(newResult?.totalScore || '0');
    const diff = Math.abs(legacyScore - newScore);
    // 소수점 2자리까지 일치 (반올림 오차 허용)
    // 둘 다 Infinity인 경우도 일치로 처리 (데이터 문제)
    const bothInfinity = !Number.isFinite(legacyScore) && !Number.isFinite(newScore) &&
                         Math.sign(1/legacyScore) === Math.sign(1/newScore);
    const match = diff < 0.005 || bothInfinity;

    if (match) {
      passCount++;
    } else {
      failCount++;
    }

    results.push({
      U_ID: uid,
      대학명: univName,
      학과명: deptName,
      testCase: `수능_${testStudent.name}`,
      legacyScore: legacyScore.toFixed(3),
      newScore: newScore.toFixed(3),
      diff,
      match,
    });

    return match;
  } catch (error: any) {
    errorCount++;
    results.push({
      U_ID: uid,
      대학명: univName,
      학과명: deptName,
      testCase: `수능_${testStudent.name}`,
      legacyScore: 'ERROR',
      newScore: 'ERROR',
      diff: -1,
      match: false,
      error: error.message,
    });
    return false;
  }
}

/**
 * 실기 점수 비교
 */
async function verifyPracticalScore(
  row: any,
  testStudent: { name: string; data: StudentPracticalData },
  practicalScores: any[]
) {
  const uid = row.U_ID;
  const univName = row.대학명;
  const deptName = row.학과명;

  if (!practicalScores || practicalScores.length === 0) {
    return true; // 실기 없는 학과는 스킵
  }

  try {
    // 실기 배점 데이터 변환
    const 실기배점 = practicalScores.map((p: any) => ({
      종목명: p.종목명,
      성별: p.성별 || '공통',
      기록: String(p.기록 ?? ''),
      배점: p.점수 ?? p.배점 ?? 0,
    }));

    // 기존 엔진 계산
    const legacyFormula = {
      ...row,
      실기배점,
      실기모드: row.실기모드 || 'basic',
      실기총점: Number(row.실기총점) || 100,
      기본점수: Number(row.기본점수) || 0,
      미달처리: row.미달처리 || '0점',
    };

    const legacyResult = silgical.calculateScore(
      legacyFormula,
      testStudent.data
    );

    // 새 엔진 계산
    const newFormula: PracticalFormulaData = {
      U_ID: uid,
      실기총점: Number(row.실기총점) || 100,
      기본점수: Number(row.기본점수) || 0,
      미달처리: row.미달처리 || '0점',
      실기모드: row.실기모드 || 'basic',
      실기배점,
      실기특수설정: row.실기특수설정,
    };

    const newResult = calcPracticalTS(newFormula, testStudent.data);

    const legacyScore = parseFloat(legacyResult?.totalScore || '0');
    const newScore = parseFloat(newResult?.totalScore || '0');
    const diff = Math.abs(legacyScore - newScore);
    const match = diff < 0.001;

    if (match) {
      passCount++;
    } else {
      failCount++;
    }

    results.push({
      U_ID: uid,
      대학명: univName,
      학과명: deptName,
      testCase: `실기_${testStudent.name}`,
      legacyScore: legacyScore.toFixed(3),
      newScore: newScore.toFixed(3),
      diff,
      match,
    });

    return match;
  } catch (error: any) {
    errorCount++;
    results.push({
      U_ID: uid,
      대학명: univName,
      학과명: deptName,
      testCase: `실기_${testStudent.name}`,
      legacyScore: 'ERROR',
      newScore: 'ERROR',
      diff: -1,
      match: false,
      error: error.message,
    });
    return false;
  }
}

/**
 * 메인 검증 실행
 */
async function main() {
  console.log('\n========================================');
  console.log('  점수 검증 시스템 - Phase 2');
  console.log('========================================\n');

  console.log(`대상 연도: ${YEAR}학년도`);
  console.log('테스트 케이스: 만점형, 중위권, 하위권, 과탐전문');
  console.log('');

  try {
    // 데이터 로드
    console.log('1. 데이터 로드 중...');
    const allFormulas = await getAllFormulaData();
    const highestMap = await getHighestScores();
    const testStudents = generateTestStudents();
    const practicalStudents = generatePracticalTestStudents();

    console.log(`   - 총 ${allFormulas.length}개 학과`);
    console.log(`   - 최고표점 ${Object.keys(highestMap).length}개 과목`);
    console.log('');

    // 수능 점수 검증
    console.log('2. 수능 점수 검증 중...');
    let processedCount = 0;

    // 변환표준점수 캐시 (U_ID별로 한 번만 로드)
    const convMapCache: Map<number, Record<string, Record<number, number>> | null> = new Map();

    for (const row of allFormulas) {
      // 변환표준점수 가져오기 (캐시 사용)
      let convMap = convMapCache.get(row.U_ID);
      if (convMap === undefined) {
        const fetched = await getConversionTable(row.U_ID);
        convMap = Object.keys(fetched).length > 0 ? fetched : null;
        convMapCache.set(row.U_ID, convMap);
      }

      for (const student of testStudents) {
        await verifySuneungScore(row, student, highestMap, convMap);
      }

      // 실기가 있는 학과면 실기도 검증
      const practicalScores = await getPracticalScores(row.U_ID);
      if (practicalScores.length > 0) {
        for (const student of practicalStudents) {
          await verifyPracticalScore(row, student, practicalScores);
        }
      }

      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`   - ${processedCount}/${allFormulas.length} 학과 완료`);
      }
    }

    // 결과 출력
    console.log('\n========================================');
    console.log('  검증 결과 요약');
    console.log('========================================\n');

    console.log(`총 테스트: ${passCount + failCount + errorCount}건`);
    console.log(`✅ 통과: ${passCount}건`);
    console.log(`❌ 불일치: ${failCount}건`);
    console.log(`⚠️ 에러: ${errorCount}건`);
    console.log(`일치율: ${((passCount / (passCount + failCount + errorCount)) * 100).toFixed(2)}%`);
    console.log('');

    // 불일치 케이스 상세
    if (failCount > 0) {
      console.log('========================================');
      console.log('  불일치 케이스 상세');
      console.log('========================================\n');

      const failures = results.filter(r => !r.match && !r.error);
      for (const f of failures.slice(0, 20)) { // 처음 20개만 출력
        console.log(`[U_ID ${f.U_ID}] ${f.대학명} - ${f.학과명}`);
        console.log(`  케이스: ${f.testCase}`);
        console.log(`  기존: ${f.legacyScore} / 신규: ${f.newScore} (차이: ${f.diff.toFixed(6)})`);
        console.log('');
      }

      if (failures.length > 20) {
        console.log(`... 외 ${failures.length - 20}건 더 있음\n`);
      }
    }

    // 에러 케이스 상세
    if (errorCount > 0) {
      console.log('========================================');
      console.log('  에러 케이스 상세');
      console.log('========================================\n');

      const errors = results.filter(r => r.error);
      for (const e of errors.slice(0, 10)) { // 처음 10개만 출력
        console.log(`[U_ID ${e.U_ID}] ${e.대학명} - ${e.학과명}`);
        console.log(`  케이스: ${e.testCase}`);
        console.log(`  에러: ${e.error}`);
        console.log('');
      }

      if (errors.length > 10) {
        console.log(`... 외 ${errors.length - 10}건 더 있음\n`);
      }
    }

    // 결과 파일 저장
    const fs = await import('fs');
    const resultPath = `./scripts/verify-results-${YEAR}.json`;
    fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
    console.log(`\n결과 파일 저장: ${resultPath}`);

  } catch (error) {
    console.error('검증 중 오류 발생:', error);
  } finally {
    await cafe24Pool.end();
  }
}

main().catch(console.error);
