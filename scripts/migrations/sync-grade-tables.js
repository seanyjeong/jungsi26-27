const mysql = require('mysql2/promise');
const { execSync } = require('child_process');

(async () => {
  // cafe24 연결
  const cafe24 = mysql.createPool({
    host: '211.37.174.218',
    user: 'maxilsan',
    password: 'q141171616!',
    database: 'jungsi',
    charset: 'utf8mb4',
  });

  console.log('cafe24에서 등급표 데이터 조회...');

  const [rows] = await cafe24.query(`
    SELECT b.대학명 as univ, b.학과명 as dept, r.english_scores, r.history_scores
    FROM 정시반영비율 r
    JOIN 정시기본 b ON r.U_ID = b.U_ID AND r.학년도 = b.학년도
    WHERE r.학년도 = 2026
      AND (r.english_scores IS NOT NULL OR r.history_scores IS NOT NULL)
  `);

  console.log('cafe24 조회:', rows.length, '개');

  // 로컬 dept_id 매핑 조회 (CLI 사용)
  const deptResult = execSync(
    `mysql -u paca univjungsi -N -e "SELECT d.dept_id, u.univ_name, d.dept_name FROM departments d JOIN universities u ON d.univ_id = u.univ_id WHERE d.year_id = 2026"`,
    { encoding: 'utf8' }
  );

  const deptMap = new Map();
  deptResult.trim().split('\n').forEach(line => {
    const [deptId, univ, dept] = line.split('\t');
    deptMap.set(univ + '|' + dept, parseInt(deptId));
  });

  console.log('로컬 학과:', deptMap.size, '개');

  let updated = 0;
  let notFound = 0;
  const notFoundSamples = [];

  for (const row of rows) {
    const key = row.univ + '|' + row.dept;
    const deptId = deptMap.get(key);

    if (!deptId) {
      notFound++;
      if (notFoundSamples.length < 5) notFoundSamples.push(key);
      continue;
    }

    let eng = row.english_scores;
    let hist = row.history_scores;

    // 객체면 stringify
    if (eng && typeof eng === 'object') eng = JSON.stringify(eng);
    if (hist && typeof hist === 'object') hist = JSON.stringify(hist);

    // 빈 값 체크
    if (eng === '{}' || eng === '') eng = null;
    if (hist === '{}' || hist === '') hist = null;

    if (!eng && !hist) continue;

    // SQL 직접 실행
    const engStr = eng ? eng.replace(/'/g, "''") : null;
    const histStr = hist ? hist.replace(/'/g, "''") : null;

    const sql = `UPDATE formula_configs SET english_scores = ${engStr ? `'${engStr}'` : 'NULL'}, history_scores = ${histStr ? `'${histStr}'` : 'NULL'} WHERE dept_id = ${deptId}`;

    try {
      execSync(`mysql -u paca univjungsi -e "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
      updated++;
    } catch (e) {
      console.error('Error updating dept_id', deptId, e.message);
    }
  }

  console.log('');
  console.log('=== 완료 ===');
  console.log('업데이트:', updated, '개');
  console.log('매칭 실패:', notFound, '개');

  if (notFoundSamples.length > 0) {
    console.log('매칭 실패 샘플:', notFoundSamples);
  }

  // 결과 확인
  const checkResult = execSync(
    `mysql -u paca univjungsi -N -e "SELECT COUNT(*), SUM(english_scores IS NOT NULL), SUM(history_scores IS NOT NULL) FROM formula_configs"`,
    { encoding: 'utf8' }
  );
  const [total, eng, hist] = checkResult.trim().split('\t');

  console.log('');
  console.log('DB 현황:');
  console.log('  총 학과:', total);
  console.log('  영어 등급표:', eng);
  console.log('  한국사 등급표:', hist);

  await cafe24.end();
})();
