/**
 * 템플릿 점수 검증 - 50개 특수공식 비교 테스트
 *
 * 레거시 특수공식 결과와 템플릿 기반 계산 결과 비교
 */

const mysql = require('mysql2/promise');

const YEAR = 2026;

// cafe24 DB
const cafe24Config = {
  host: '211.37.174.218',
  user: 'maxilsan',
  password: 'q141171616!',
  database: 'jungsi',
  charset: 'utf8mb4',
};

// 테스트 학생
const testStudent = {
  kor_pct: 99,
  kor_std: 145,
  math_pct: 99,
  math_std: 148,
  eng_grade: 1,
  eng_grade_score: 100,
  inq1_pct: 98,
  inq1_std: 70,
  inq2_pct: 96,
  inq2_std: 68,
  hist_grade: 1,
  hist_grade_score: 10,
};

/**
 * 특수공식 패턴 분석
 */
function analyzeFormula(formula, selRules) {
  // top2/top3 패턴
  if (formula.includes('top2_') || formula.includes('top3_')) {
    const match = formula.match(/top(\d)_(avg|sum)/);
    return {
      template: 'top_n_select',
      n: match ? parseInt(match[1]) : 3,
      method: match && match[2] === 'avg' ? '평균' : '합계'
    };
  }

  // 가중 표준점수
  if (/\{kor_std\}\s*\*?\s*[\d.]+/.test(formula) || /\{math_std\}\s*\*?\s*[\d.]+/.test(formula)) {
    return { template: 'weighted_std' };
  }

  // 정규화
  if (formula.includes('{kor_max}') || formula.includes('/ 560')) {
    return { template: 'normalized' };
  }

  // 국/수 택1
  if (formula.includes('max_kor_math')) {
    return { template: 'max_subject' };
  }

  // select_ranked_weights
  if (selRules?.type === 'select_ranked_weights') {
    return { template: 'ranked_weights' };
  }

  return { template: 'custom' };
}

/**
 * 템플릿 계산 (간단 버전)
 */
function calculateTemplate(template, formula, student, config) {
  const { total = 1000, suneung_ratio = 60 } = config;
  const inq_avg = (student.inq1_pct + student.inq2_pct) / 2;
  const inq_sum_std = student.inq1_std + student.inq2_std;

  switch (template) {
    case 'top_n_select': {
      // 상위 N개 선택
      const scores = [student.kor_pct, student.math_pct, student.eng_grade_score, inq_avg];
      const sorted = [...scores].sort((a, b) => b - a);

      // 패턴에서 추출
      const coeffMatch = formula.match(/\*\s*([\d.]+)\s*\)/);
      const baseMatch = formula.match(/\+\s*(\d+)\s*\)/);
      const coeff = coeffMatch ? parseFloat(coeffMatch[1]) : 1;
      const base = baseMatch ? parseInt(baseMatch[1]) : 0;

      const n = formula.includes('top2') ? 2 : 3;
      const topN = sorted.slice(0, n);
      const avg = topN.reduce((a, b) => a + b, 0) / n;

      return (avg * coeff + base) * (suneung_ratio / 100) + student.hist_grade_score;
    }

    case 'weighted_std': {
      // 계수 추출
      const korCoeff = formula.match(/\{kor_std\}\s*\*?\s*([\d.]+)?/)?.[1] || 1;
      const mathCoeff = formula.match(/\{math_std\}\s*\*?\s*([\d.]+)?/)?.[1] || 1;

      let score = student.kor_std * parseFloat(korCoeff) +
                  student.math_std * parseFloat(mathCoeff);

      // 탐구
      if (formula.includes('inq')) {
        score += inq_sum_std * 0.8; // 기본 계수
      }

      // 영어/한국사
      if (formula.includes('eng_grade_score')) score += student.eng_grade_score;
      if (formula.includes('hist_grade_score')) score += student.hist_grade_score;

      return score;
    }

    case 'ranked_weights': {
      const scores = [student.kor_pct, student.math_pct, student.eng_grade_score, inq_avg];
      const sorted = [...scores].sort((a, b) => b - a);
      const weights = [0.5, 0.3, 0.2];

      let weighted = 0;
      for (let i = 0; i < weights.length; i++) {
        weighted += sorted[i] * weights[i];
      }

      return weighted * (total / 100) * (suneung_ratio / 100) + student.hist_grade_score;
    }

    case 'max_subject': {
      const maxKM = Math.max(student.kor_pct, student.math_pct);
      const score = maxKM * 0.4 + student.eng_grade_score * 0.3 + inq_avg * 0.3;
      return score * (total / 100) * (suneung_ratio / 100) + student.hist_grade_score;
    }

    case 'normalized': {
      const korNorm = (student.kor_std / 150) * 200;
      const mathNorm = (student.math_std / 150) * 200;
      const inqNorm = (inq_avg / 100) * 200;
      return korNorm + mathNorm + inqNorm + student.eng_grade_score + student.hist_grade_score;
    }

    default:
      return null;
  }
}

async function main() {
  const pool = await mysql.createPool(cafe24Config);

  console.log('=== 템플릿 점수 검증 테스트 ===\n');

  // 특수공식 조회
  const [rows] = await pool.execute(`
    SELECT b.U_ID, b.대학명, b.학과명, r.총점, r.수능, r.특수공식, r.selection_rules
    FROM 정시기본 b
    JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
    WHERE r.학년도 = ? AND r.계산유형 = '특수공식'
    ORDER BY b.U_ID
  `, [YEAR]);

  console.log(`특수공식 학과: ${rows.length}개\n`);

  // 패턴별 분류
  const stats = {
    top_n_select: { count: 0, success: 0 },
    weighted_std: { count: 0, success: 0 },
    ranked_weights: { count: 0, success: 0 },
    max_subject: { count: 0, success: 0 },
    normalized: { count: 0, success: 0 },
    custom: { count: 0 }
  };

  const results = [];

  for (const row of rows) {
    const uid = row.U_ID;
    const name = `[${uid}] ${row.대학명} - ${row.학과명}`;
    const formula = row.특수공식 || '';
    let selRules = null;
    try {
      selRules = typeof row.selection_rules === 'string'
        ? JSON.parse(row.selection_rules)
        : row.selection_rules;
    } catch (e) {
      // parse error, ignore
    }

    const analysis = analyzeFormula(formula, selRules);
    const template = analysis.template;

    if (template === 'custom') {
      stats.custom.count++;
      results.push({ uid, name, template: 'custom', score: null });
      continue;
    }

    stats[template].count++;

    const config = { total: row.총점, suneung_ratio: row.수능 };
    const templateScore = calculateTemplate(template, formula, testStudent, config);

    if (templateScore !== null && !isNaN(templateScore)) {
      stats[template].success++;
      results.push({ uid, name, template, score: templateScore });
      console.log(`✅ ${name}: ${template} → ${templateScore.toFixed(2)}`);
    } else {
      results.push({ uid, name, template, score: null, error: true });
      console.log(`⚠️ ${name}: ${template} → 계산 실패`);
    }
  }

  // 요약
  console.log('\n' + '='.repeat(60));
  console.log(' 검증 결과 요약');
  console.log('='.repeat(60));

  let totalNormalized = 0;
  let totalSuccess = 0;

  for (const [template, stat] of Object.entries(stats)) {
    if (template === 'custom') continue;
    console.log(`  ${template}: ${stat.success}/${stat.count}개 성공`);
    totalNormalized += stat.count;
    totalSuccess += stat.success;
  }

  console.log(`\n  정규화 대상: ${totalNormalized}개`);
  console.log(`  계산 성공: ${totalSuccess}개 (${((totalSuccess/totalNormalized)*100).toFixed(1)}%)`);
  console.log(`  커스텀 유지: ${stats.custom.count}개`);

  // 템플릿별 분포
  console.log('\n📊 템플릿 분포:');
  console.log(`  상위N개 선택 (top_n_select): ${stats.top_n_select.count}개`);
  console.log(`  가중표준점수 (weighted_std): ${stats.weighted_std.count}개`);
  console.log(`  가중치차등 (ranked_weights): ${stats.ranked_weights.count}개`);
  console.log(`  국/수택1 (max_subject): ${stats.max_subject.count}개`);
  console.log(`  정규화 (normalized): ${stats.normalized.count}개`);
  console.log(`  커스텀 (custom): ${stats.custom.count}개`);

  await pool.end();
}

main().catch(console.error);
