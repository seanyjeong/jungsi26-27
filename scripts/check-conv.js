const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: '211.37.174.218',
    user: 'maxilsan',
    password: 'q141171616!',
    database: 'jungsi',
    charset: 'utf8mb4',
  });

  // 변환표준점수가 있는 학교 목록
  const [rows] = await pool.execute(`
    SELECT DISTINCT c.U_ID, b.대학명
    FROM 정시탐구변환표준 c
    JOIN 정시기본 b ON c.U_ID = b.U_ID AND c.학년도 = b.학년도
    WHERE c.학년도 = 2026
  `);

  console.log('=== 변환표준점수 있는 학교 ===');
  console.log('총 ' + rows.length + '개 학교');
  rows.forEach(r => {
    console.log('  U_ID ' + r.U_ID + ': ' + r.대학명);
  });

  // 테이블 샘플 확인
  if (rows.length > 0) {
    const [sample] = await pool.execute(`
      SELECT * FROM 정시탐구변환표준
      WHERE 학년도 = 2026 AND U_ID = ?
      ORDER BY 백분위 DESC
      LIMIT 10
    `, [rows[0].U_ID]);

    console.log('\n=== 변환표 샘플 (U_ID ' + rows[0].U_ID + ') ===');
    console.log(sample);
  }

  await pool.end();
}

main().catch(console.error);
