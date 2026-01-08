const mysql = require('mysql2/promise');
const { execSync } = require('child_process');

(async () => {
  const cafe24 = mysql.createPool({
    host: '211.37.174.218',
    user: 'maxilsan',
    password: 'q141171616!',
    database: 'jungsi',
  });

  console.log('cafe24에서 표시용 데이터 조회...');

  const [rows] = await cafe24.query(`
    SELECT b.대학명, b.학과명,
           r.반영방법, r.수능, r.내신, r.실기, r.실기총점,
           r.국어, r.수학, r.영어, r.탐구, r.탐구수, r.한국사,
           r.기타, r.선택형여부, r.선택조건, r.선택가중치,
           r.한국사방식, r.미달처리, r.기타설정
    FROM 정시반영비율 r
    JOIN 정시기본 b ON r.U_ID = b.U_ID AND r.학년도 = b.학년도
    WHERE r.학년도 = 2026
  `);

  console.log(`cafe24: ${rows.length}개 학과\n`);

  // 로컬 dept_id 매핑
  const deptResult = execSync(
    `mysql -u paca univjungsi -N -e "SELECT d.dept_id, u.univ_name, d.dept_name FROM departments d JOIN universities u ON d.univ_id = u.univ_id WHERE d.year_id = 2026"`,
    { encoding: 'utf8' }
  );

  const deptMap = new Map();
  deptResult.trim().split('\n').forEach(line => {
    const [deptId, univ, dept] = line.split('\t');
    deptMap.set(univ + '|' + dept, parseInt(deptId));
  });

  let updated = 0;
  let notFound = 0;

  for (const row of rows) {
    const key = row.대학명 + '|' + row.학과명;
    const deptId = deptMap.get(key);

    if (!deptId) {
      notFound++;
      continue;
    }

    // display_config JSON 구성
    const displayConfig = {
      반영방법: row.반영방법 || '',
      비율: {
        수능: row.수능 || '',
        내신: row.내신 || '',
        실기: row.실기 || ''
      },
      실기총점: row.실기총점 || 0,
      과목: {
        국어: row.국어 || '',
        수학: row.수학 || '',
        영어: row.영어 || '',
        탐구: row.탐구 || '',
        탐구수: row.탐구수 || '',
        한국사: row.한국사 || ''
      },
      한국사방식: row.한국사방식 || '',
      미달처리: row.미달처리 || '',
      선택: {
        선택형: row.선택형여부 ? true : false,
        조건: row.선택조건 || '',
        가중치: row.선택가중치 || ''
      },
      기타: row.기타 || ''
    };

    // 기타설정 병합
    if (row.기타설정) {
      try {
        const extra = typeof row.기타설정 === 'string' ? JSON.parse(row.기타설정) : row.기타설정;
        displayConfig.기타설정 = extra;
      } catch (e) {}
    }

    const configJson = JSON.stringify(displayConfig).replace(/'/g, "''").replace(/\\/g, '\\\\');
    const sql = `UPDATE formula_configs SET display_config = '${configJson}' WHERE dept_id = ${deptId}`;

    try {
      execSync(`mysql -u paca univjungsi -e "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
      updated++;
    } catch (e) {
      console.log(`Error: ${row.대학명} - ${row.학과명}: ${e.message}`);
    }
  }

  console.log('=== 완료 ===');
  console.log(`업데이트: ${updated}개`);
  console.log(`매칭 실패: ${notFound}개`);

  // 결과 확인
  const checkResult = execSync(
    `mysql -u paca univjungsi -N -e "SELECT COUNT(*) FROM formula_configs WHERE display_config IS NOT NULL"`,
    { encoding: 'utf8' }
  );
  console.log(`\nDB display_config 있음: ${checkResult.trim()}개`);

  await cafe24.end();
})();
