/**
 * 영어/한국사 등급표 데이터 임포트
 *
 * 사용법:
 * 1. cafe24에서 cafe24-export.sh 실행하여 grade_tables_export.json 생성
 * 2. 해당 파일을 이 디렉토리로 복사
 * 3. npx ts-node scripts/migrations/import-grade-tables.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

interface GradeExportRow {
  U_ID: number;
  univ: string;
  dept: string;
  year: number;
  english_scores: string;
  history_scores: string;
}

const LOCAL_DB = {
  host: 'localhost',
  user: 'paca',
  database: 'univjungsi',
  charset: 'utf8mb4',
};

async function main() {
  const exportFile = path.join(__dirname, 'grade_tables_export.json');

  if (!fs.existsSync(exportFile)) {
    console.error('❌ grade_tables_export.json 파일이 없습니다.');
    console.log('');
    console.log('cafe24에서 먼저 데이터를 추출하세요:');
    console.log('  1. cafe24 SSH 접속');
    console.log('  2. bash cafe24-export.sh 실행');
    console.log('  3. grade_tables_export.json을 이 폴더로 복사');
    process.exit(1);
  }

  console.log('📂 grade_tables_export.json 읽는 중...');
  const rawData = fs.readFileSync(exportFile, 'utf-8');
  const data: GradeExportRow[] = JSON.parse(rawData);

  console.log(`📊 ${data.length}개 학과 데이터 발견`);

  const pool = mysql.createPool(LOCAL_DB);

  // 대학명+학과명 → dept_id 매핑 조회
  const [depts] = await pool.query<mysql.RowDataPacket[]>(`
    SELECT d.dept_id, u.univ_name, d.dept_name, d.year_id
    FROM departments d
    JOIN universities u ON d.univ_id = u.univ_id
    WHERE d.year_id = 2026
  `);

  // 매핑 테이블 생성
  const deptMap = new Map<string, number>();
  for (const row of depts) {
    const key = `${row.univ_name}|${row.dept_name}`;
    deptMap.set(key, row.dept_id);
  }

  console.log(`🗃️  로컬 DB에 ${deptMap.size}개 학과 존재`);

  let updated = 0;
  let notFound = 0;
  let noScores = 0;
  const notFoundList: string[] = [];

  for (const row of data) {
    const key = `${row.univ}|${row.dept}`;
    const deptId = deptMap.get(key);

    if (!deptId) {
      notFound++;
      if (notFoundList.length < 10) {
        notFoundList.push(`${row.univ} - ${row.dept}`);
      }
      continue;
    }

    const engScores = row.english_scores && row.english_scores !== '{}' ? row.english_scores : null;
    const histScores = row.history_scores && row.history_scores !== '{}' ? row.history_scores : null;

    if (!engScores && !histScores) {
      noScores++;
      continue;
    }

    await pool.query(`
      UPDATE formula_configs
      SET english_scores = ?, history_scores = ?
      WHERE dept_id = ?
    `, [engScores, histScores, deptId]);

    updated++;
  }

  console.log('');
  console.log('=== 결과 ===');
  console.log(`✅ 업데이트 완료: ${updated}개`);
  console.log(`⚠️  매칭 실패: ${notFound}개`);
  console.log(`⏭️  스코어 없음: ${noScores}개`);

  if (notFoundList.length > 0) {
    console.log('');
    console.log('매칭 실패 샘플:');
    notFoundList.forEach(item => console.log(`  - ${item}`));
  }

  // 결과 확인
  const [check] = await pool.query<mysql.RowDataPacket[]>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN english_scores IS NOT NULL THEN 1 ELSE 0 END) as with_english,
      SUM(CASE WHEN history_scores IS NOT NULL THEN 1 ELSE 0 END) as with_history
    FROM formula_configs
  `);

  console.log('');
  console.log('=== 현재 DB 상태 ===');
  console.log(`총 formula_configs: ${check[0].total}개`);
  console.log(`영어 등급표 있음: ${check[0].with_english}개`);
  console.log(`한국사 등급표 있음: ${check[0].with_history}개`);

  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
