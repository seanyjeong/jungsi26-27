const mysql = require('mysql2/promise');

// Legacy
const jungsical = require('../js/jungsical').helpers;

// New
const { calculateScoreWithConv } = require('../.build/index');

const YEAR = 2026;
const TEST_UID = process.argv[2] || '40';

// 테스트 학생 (만점형)
const testStudent = {
  subjects: [
    { name: '국어', std: 145, percentile: 99, grade: 1, subject: '화법과작문' },
    { name: '수학', std: 150, percentile: 99, grade: 1, subject: '미적분' },
    { name: '영어', grade: 1 },
    { name: '한국사', grade: 1 },
    { name: '탐구', subject: '생명과학I', std: 70, percentile: 98, grade: 1 },
    { name: '탐구', subject: '지구과학I', std: 68, percentile: 96, grade: 1 },
  ],
};

async function main() {
  const pool = mysql.createPool({
    host: '211.37.174.218',
    user: 'maxilsan',
    password: 'q141171616!',
    database: 'jungsi',
    charset: 'utf8mb4',
  });

  // 학교 데이터
  const [rows] = await pool.execute(`
    SELECT b.*, r.*
    FROM 정시기본 b
    JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
    WHERE b.학년도 = ? AND b.U_ID = ?
  `, [YEAR, TEST_UID]);

  if (rows.length === 0) {
    console.log('학교 데이터 없음');
    await pool.end();
    return;
  }

  const row = rows[0];
  console.log('=== 학교 정보 ===');
  console.log('대학:', row.대학명);
  console.log('학과:', row.학과명);
  console.log('selection_rules:', JSON.stringify(row.selection_rules, null, 2));
  console.log('score_config:', JSON.stringify(row.score_config, null, 2));
  console.log('반영비율: 국어=' + row.국어 + ', 수학=' + row.수학 + ', 영어=' + row.영어 + ', 탐구=' + row.탐구);
  console.log('');

  // 최고표점
  const [highestRows] = await pool.execute(`
    SELECT * FROM 정시최고표점 WHERE 학년도 = ? AND 모형 = '수능'
  `, [YEAR]);
  const highestMap = {};
  for (const hr of highestRows) {
    highestMap[hr.과목명] = Number(hr.최고점) || 0;
  }

  console.log('\n=== 최고표점 맵 ===');
  console.log('국어:', highestMap['국어'] || highestMap['화법과작문']);
  console.log('수학:', highestMap['수학'] || highestMap['미적분']);
  console.log('생명과학I:', highestMap['생명과학I']);

  console.log('\n=== 레거시 엔진 계산 ===');
  const legacyLogs = [];
  // Legacy returns the result differently - need to call the base function
  const legacyResult = jungsical.calculateScore(
    row,
    testStudent,
    highestMap
  );
  console.log('총점:', legacyResult?.totalScore);
  if (legacyResult?.calculationLog) {
    legacyResult.calculationLog.forEach(l => console.log('  ', l));
  }

  // 최고표점 맵 전체 출력
  console.log('\n=== 최고표점 맵 전체 ===');
  console.log(highestMap);

  console.log('\n=== 새 엔진 계산 ===');
  const formulaData = {
    U_ID: row.U_ID,
    학년도: row.학년도,
    총점: Number(row.총점) || 1000,
    수능: Number(row.수능) || 100,
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
  };
  const newResult = calculateScoreWithConv(formulaData, testStudent, null, null, highestMap);
  console.log('총점:', newResult?.totalScore);
  if (newResult?.calculationLog) {
    newResult.calculationLog.forEach(l => console.log('  ', l));
  }

  await pool.end();
}

main().catch(console.error);
