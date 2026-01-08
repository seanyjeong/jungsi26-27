/**
 * 실기 배점표만 이관하는 스크립트
 */
import mysql from 'mysql2/promise';

const YEAR = 2026;

const cafe24Pool = mysql.createPool({
  host: '211.37.174.218',
  user: 'maxilsan',
  password: 'q141171616!',
  database: 'jungsi',
  charset: 'utf8mb4',
});

const localPool = mysql.createPool({
  host: 'localhost',
  user: 'paca',
  password: 'q141171616!',
  database: 'univjungsi',
  charset: 'utf8mb4',
});

async function migrate() {
  console.log('실기 배점표 이관 시작...');

  // 1. 기존 U_ID → dept_id 매핑 생성
  const [deptRows] = await localPool.execute<any[]>(
    `SELECT d.dept_id, u.univ_name, d.dept_name, d.모집군
     FROM departments d
     JOIN universities u ON d.univ_id = u.univ_id
     WHERE d.year_id = ?`,
    [YEAR]
  );

  // cafe24에서 대학명/학과명/군으로 U_ID 찾기
  const [cafe24Depts] = await cafe24Pool.execute<any[]>(
    `SELECT U_ID, 대학명, 학과명, 군 FROM 정시기본 WHERE 학년도 = ?`,
    [YEAR]
  );

  // 매핑 테이블 생성
  const uidToDepId = new Map<number, number>();
  for (const c24 of cafe24Depts) {
    const local = deptRows.find(
      d => d.univ_name === c24.대학명 && d.dept_name === c24.학과명 && d.모집군 === (c24.군?.includes('가') ? '가' : c24.군?.includes('나') ? '나' : '다')
    );
    if (local) {
      uidToDepId.set(c24.U_ID, local.dept_id);
    }
  }

  console.log(`매핑된 학과: ${uidToDepId.size}개`);

  // 2. 실기배점 데이터 가져오기
  const [pracRows] = await cafe24Pool.execute<any[]>(
    `SELECT * FROM 정시실기배점 WHERE 학년도 = ?`,
    [YEAR]
  );

  console.log(`cafe24 실기배점: ${pracRows.length}개`);

  // 3. 이관
  let count = 0;
  for (const row of pracRows) {
    const deptId = uidToDepId.get(row.U_ID);
    if (!deptId) continue;
    if (!row.종목명 || row.기록 === undefined) continue;

    const score = row.점수 ?? row.배점 ?? 0;

    await localPool.execute(
      `INSERT INTO practical_score_tables (dept_id, 종목명, 성별, 기록, 점수) VALUES (?, ?, ?, ?, ?)`,
      [deptId, row.종목명 || '', row.성별 || '공통', String(row.기록 ?? ''), Number(score)]
    );
    count++;
  }

  console.log(`이관 완료: ${count}개`);

  await cafe24Pool.end();
  await localPool.end();
}

migrate().catch(console.error);
