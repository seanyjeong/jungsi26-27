const mysql = require('mysql2/promise');
const { execSync } = require('child_process');

// 특수 실기 규칙 정의 (special-rules.ts 기반)
const SPECIAL_RULES = {
  2: { type: 'lookup', config: { table: [[286, 700], [271, 691], [256, 682], [241, 673], [226, 664], [211, 655], [196, 646], [181, 637], [0, 630]] }},
  3: { type: 'simple_sum', config: { baseScore: 1 }},
  13: { type: 'formula', config: {
    formula: 'manual_standards',
    standards: {
      배근력: { 남: { min: 130, max: 220 }, 여: { min: 60, max: 151 }},
      좌전굴: { 남: { min: 11.9, max: 30 }, 여: { min: 13.9, max: 32 }},
      제자리멀리뛰기: { 남: { min: 254, max: 300 }, 여: { min: 199, max: 250 }},
      중량메고달리기: { 남: { min: 9.9, max: 7.19 }, 여: { min: 10.9, max: 7.6 }}
    }
  }},
  16: { type: 'weighted', config: { weights: { '10m왕복달리기': 9.8, '제자리멀리뛰기': 9.8, '윗몸일으키기': 8.4 }}},
  17: { type: 'weighted', config: { weights: { '10m왕복달리기': 5.6, '제자리멀리뛰기': 5.6, '윗몸일으키기': 4.8 }}},
  19: { type: 'simple_sum', config: { baseScore: 2 }},
  69: { type: 'average', config: { count: 3, multiplier: 4, baseScore: 400 }},
  70: { type: 'average', config: { count: 3, multiplier: 4, baseScore: 400 }},
  71: { type: 'simple_sum', config: { baseScore: 0 }},
  99: { type: 'top_n', config: { n: 3, maxScore: 800 }},
  121: { type: 'pass_count', config: { scorePerPass: 100, baseScore: 200 }},
  146: { type: 'top_n', config: { n: 3, maxScore: 400 }},
  147: { type: 'top_n', config: { n: 3, maxScore: 800 }},
  151: { type: 'formula', config: { formula: '((sum/3) - 80) * (7/6) + 560', events: 3 }},
  152: { type: 'formula', config: { formula: '((sum/3) - 80) * (7/6) + 560', events: 3 }},
  153: { type: 'formula', config: { formula: '((sum/2) - 80) + 480', events: 2 }},
  160: { type: 'weighted', config: { weights: { '20m왕복달리기': 4, '제자리멀리뛰기': 3, '메디신볼던지기': 3 }, maxScore: 1000, targetScore: 700 }},
  175: { type: 'average', config: { count: 3, multiplier: 1, baseScore: 0 }},
  184: { type: 'formula', config: { formula: '(sum/300) * 280', events: 3 }},
  186: { type: 'simple_sum', config: { baseScore: 300 }},
  189: { type: 'simple_sum', config: { baseScore: 20 }},
  194: { type: 'formula', config: { formula: 'sum * 0.5 * 0.8' }},
  197: { type: 'formula', config: { formula: 'sum * 0.5 * 0.8' }},
  199: { type: 'simple_sum', config: { baseScore: 20 }}
};

(async () => {
  const cafe24 = mysql.createPool({
    host: '211.37.174.218',
    user: 'maxilsan',
    password: 'q141171616!',
    database: 'jungsi',
  });

  console.log('1. cafe24에서 U_ID 매핑 조회...');

  const [rows] = await cafe24.query(`
    SELECT b.U_ID, b.대학명, b.학과명
    FROM 정시기본 b
    WHERE b.학년도 = 2026
  `);

  console.log(`   cafe24: ${rows.length}개 학과`);

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

  console.log(`   로컬: ${deptMap.size}개 학과`);

  // 2. legacy_uid 업데이트
  console.log('\n2. legacy_uid 매핑 업데이트...');
  let uidUpdated = 0;

  for (const row of rows) {
    const key = row.대학명 + '|' + row.학과명;
    const deptId = deptMap.get(key);
    if (!deptId) continue;

    try {
      execSync(
        `mysql -u paca univjungsi -e "UPDATE formula_configs SET legacy_uid = ${row.U_ID} WHERE dept_id = ${deptId}"`,
        { encoding: 'utf8' }
      );
      uidUpdated++;
    } catch (e) {}
  }

  console.log(`   ${uidUpdated}개 학과 legacy_uid 업데이트`);

  // 3. 특수 규칙 삽입
  console.log('\n3. 특수 실기 규칙 삽입...');
  let rulesInserted = 0;

  for (const [uid, rule] of Object.entries(SPECIAL_RULES)) {
    // 해당 U_ID의 대학 찾기
    const row = rows.find(r => r.U_ID === parseInt(uid));
    if (!row) {
      console.log(`   ⚠️ U_ID ${uid} 찾을 수 없음`);
      continue;
    }

    const key = row.대학명 + '|' + row.학과명;
    const deptId = deptMap.get(key);
    if (!deptId) {
      console.log(`   ⚠️ ${row.대학명} - ${row.학과명} dept_id 없음`);
      continue;
    }

    const configJson = JSON.stringify(rule.config).replace(/'/g, "''");
    const sql = `INSERT INTO practical_calc_rules (dept_id, rule_type, rule_config) VALUES (${deptId}, '${rule.type}', '${configJson}') ON DUPLICATE KEY UPDATE rule_type = '${rule.type}', rule_config = '${configJson}'`;

    try {
      execSync(`mysql -u paca univjungsi -e "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
      console.log(`   ✓ ${row.대학명} - ${row.학과명} (${rule.type})`);
      rulesInserted++;
    } catch (e) {
      console.log(`   ✗ ${row.대학명} - ${row.학과명}: ${e.message}`);
    }
  }

  console.log(`\n=== 완료 ===`);
  console.log(`legacy_uid: ${uidUpdated}개`);
  console.log(`special rules: ${rulesInserted}개`);

  // 결과 확인
  const checkResult = execSync(
    `mysql -u paca univjungsi -N -e "SELECT COUNT(*) FROM practical_calc_rules"`,
    { encoding: 'utf8' }
  );
  console.log(`\nDB practical_calc_rules: ${checkResult.trim()}개`);

  await cafe24.end();
})();
