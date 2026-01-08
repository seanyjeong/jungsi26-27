const mysql = require('mysql2/promise');

const uid = process.argv[2] || '40';

async function main() {
  const pool = mysql.createPool({
    host: '211.37.174.218',
    user: 'maxilsan',
    password: 'q141171616!',
    database: 'jungsi',
    charset: 'utf8mb4',
  });

  // 테이블 구조 확인
  const [cols] = await pool.execute('SHOW COLUMNS FROM 정시반영비율');
  console.log('=== 정시반영비율 컬럼 ===');
  console.log(cols.map(c => c.Field).join(', '));

  // 기본 데이터 조회
  const [rows] = await pool.execute(`
    SELECT b.U_ID, b.대학명, b.학과명, r.*
    FROM 정시기본 b
    JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
    WHERE b.학년도 = 2026 AND b.U_ID = ?
  `, [uid]);

  console.log('\n=== U_ID ' + uid + ' 데이터 ===');
  if (rows.length > 0) {
    const row = rows[0];
    for (const key of Object.keys(row)) {
      console.log(key + ':', row[key]);
    }
  }

  // 변환표준점수 테이블 확인
  const [convRows] = await pool.execute(`
    SELECT * FROM 정시탐구변환표준
    WHERE 학년도 = 2026 AND U_ID = ?
    LIMIT 10
  `, [uid]);

  console.log('\n=== 변환표준점수 (U_ID ' + uid + ') ===');
  if (convRows.length > 0) {
    console.log('총 ' + convRows.length + '개 행');
    console.log('샘플:', convRows.slice(0, 3));
  } else {
    console.log('변환표준점수 없음');
  }

  await pool.end();
}

main().catch(console.error);
