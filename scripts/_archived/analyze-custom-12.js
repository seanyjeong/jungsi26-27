/**
 * 12개 커스텀 공식 상세 분석
 */

const mysql = require('mysql2/promise');

const YEAR = 2026;

async function main() {
  const pool = await mysql.createPool({
    host: '211.37.174.218',
    user: 'maxilsan',
    password: 'q141171616!',
    database: 'jungsi',
    charset: 'utf8mb4',
  });

  // 모든 특수공식 조회
  const [rows] = await pool.execute(`
    SELECT b.U_ID, b.대학명, b.학과명, r.총점, r.수능, r.특수공식, r.selection_rules
    FROM 정시기본 b
    JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
    WHERE r.학년도 = ? AND r.계산유형 = '특수공식'
    ORDER BY b.U_ID
  `, [YEAR]);

  console.log(`총 ${rows.length}개 특수공식\n`);

  // 현재 감지 못하는 패턴 찾기
  const customs = [];

  for (const row of rows) {
    const formula = row.특수공식 || '';
    const selRules = typeof row.selection_rules === 'string'
      ? JSON.parse(row.selection_rules || '{}')
      : row.selection_rules || {};

    // 현재 감지 로직
    let detected = false;

    if (formula.includes('top2_') || formula.includes('top3_')) detected = true;
    if (/\{kor_std\}\s*\*?\s*[\d.]+/.test(formula) || /\{math_std\}\s*\*?\s*[\d.]+/.test(formula)) detected = true;
    if (formula.includes('{kor_max}') || formula.includes('/ 560')) detected = true;
    if (formula.includes('max_kor_math')) detected = true;
    if (selRules?.type === 'select_ranked_weights') detected = true;

    if (!detected) {
      customs.push({
        uid: row.U_ID,
        name: `${row.대학명} - ${row.학과명}`,
        total: row.총점,
        suneung: row.수능,
        formula: formula,
        selRules: selRules
      });
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(` 커스텀으로 분류된 ${customs.length}개 공식 상세 분석`);
  console.log('='.repeat(70));

  for (const c of customs) {
    console.log(`\n[${c.uid}] ${c.name}`);
    console.log(`  총점: ${c.total}, 수능비율: ${c.suneung}%`);
    console.log(`  수식:\n${c.formula.substring(0, 400)}`);

    // 패턴 분석
    const patterns = [];

    // 1. select_n 패턴
    if (c.selRules?.type === 'select_n') {
      patterns.push(`→ select_n: ${c.selRules.count}개 from ${JSON.stringify(c.selRules.from)}`);
    }

    // 2. 기본점 + 합계 패턴
    if (c.formula.match(/\d{3}\s*\+/)) {
      patterns.push('→ 기본점 + 합계 패턴');
    }

    // 3. 평균 × 계수 패턴
    if (c.formula.includes('* 0.25') || c.formula.includes('/ 4')) {
      patterns.push('→ 4과목 평균 패턴');
    }

    // 4. {kor_std} 단순 합계
    if (c.formula.includes('{kor_std}') && !c.formula.match(/\{kor_std\}\s*\*/)) {
      patterns.push('→ 표준점수 단순 합계');
    }

    // 5. 탐구 합계
    if (c.formula.includes('inq_sum') || c.formula.includes('inq1_') && c.formula.includes('inq2_')) {
      patterns.push('→ 탐구 2과목 합계');
    }

    // 6. 복잡한 비율 구조
    if (c.formula.includes('0.6 +') && c.formula.includes('0.4 *')) {
      patterns.push('→ 60% 기본 + 40% 성적 비례 (창원대 패턴)');
    }

    // 7. ratio5 패턴
    if (c.formula.includes('ratio5')) {
      patterns.push('→ ratio5 (5과목 비율)');
    }

    if (patterns.length > 0) {
      console.log(`  분석: ${patterns.join(', ')}`);
    }

    // 정규화 제안
    let suggestion = '미정';
    if (c.selRules?.type === 'select_n') {
      suggestion = 'top_n_select';
    } else if (c.formula.includes('* 0.25') || c.formula.includes('/ 4')) {
      suggestion = 'basic_ratio (4과목 평균)';
    } else if (c.formula.match(/\{kor_std\}[^*]/) && c.formula.includes('{math_std}')) {
      suggestion = 'weighted_std (계수 1)';
    } else if (c.formula.includes('0.6 +') && c.formula.includes('0.4 *')) {
      suggestion = 'custom (창원대 특수)';
    }

    console.log(`  제안 템플릿: ${suggestion}`);
  }

  await pool.end();
}

main().catch(console.error);
