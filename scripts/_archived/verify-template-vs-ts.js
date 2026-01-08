/**
 * 템플릿 vs TypeScript 엔진 비교
 *
 * 기존 TS 엔진과 템플릿 계산 결과 비교
 */

const mysql = require('mysql2/promise');
const { calculateScoreWithConv } = require('../.build/index');

const YEAR = 2026;

// cafe24 DB
const cafe24Pool = mysql.createPool({
  host: '211.37.174.218',
  user: 'maxilsan',
  password: 'q141171616!',
  database: 'jungsi',
  charset: 'utf8mb4',
});

// 테스트 학생 (만점형)
const testStudentTS = {
  subjects: [
    { name: '국어', std: 145, percentile: 99, grade: 1, subject: '화법과작문' },
    { name: '수학', std: 148, percentile: 99, grade: 1, subject: '미적분' },
    { name: '영어', grade: 1 },
    { name: '한국사', grade: 1 },
    { name: '탐구', subject: '물리학I', std: 70, percentile: 98, grade: 1 },
    { name: '탐구', subject: '화학I', std: 68, percentile: 96, grade: 1 },
  ],
};

// 템플릿 계산용 값
const tpl = {
  kor_pct: 99, kor_std: 145,
  math_pct: 99, math_std: 148,
  eng_grade_score: 100,
  inq1_pct: 98, inq1_std: 70, inq1_conv: 72,
  inq2_pct: 96, inq2_std: 68, inq2_conv: 70,
  hist_grade_score: 10,
  inq_avg_pct: 97,
  inq_sum_converted: 142,
  inq_avg_converted: 71,
};

/**
 * 템플릿 계산
 */
function calculateByTemplate(formula, selRules, config) {
  const { total, suneung_ratio } = config;
  const ratio = suneung_ratio / 100;

  // top2/top3
  if (formula.includes('top2_') || formula.includes('top3_')) {
    const n = formula.includes('top2') ? 2 : 3;
    const scores = [tpl.kor_pct, tpl.math_pct, tpl.eng_grade_score, tpl.inq_avg_pct];
    const sorted = [...scores].sort((a, b) => b - a).slice(0, n);
    const coeffMatch = formula.match(/\*\s*([\d.]+)\s*\)\s*\+/);
    const baseMatch = formula.match(/\+\s*(\d+)\s*\)\s*\*/);
    const coeff = coeffMatch ? parseFloat(coeffMatch[1]) : 1;
    const base = baseMatch ? parseInt(baseMatch[1]) : 0;
    const avg = sorted.reduce((a, b) => a + b, 0) / n;
    return (avg * coeff + base) * ratio + tpl.hist_grade_score;
  }

  // max_kor_math / top1_math_or_eng
  if (formula.includes('max_kor_math') || formula.includes('top1_math_or_eng')) {
    const maxME = Math.max(tpl.math_pct, tpl.eng_grade_score);
    if (formula.includes('inq_avg2_percentile') && formula.includes('* 0.6')) {
      return (tpl.kor_pct + tpl.inq_avg_pct + maxME) * 0.6 + tpl.hist_grade_score;
    }
    if (formula.includes('* 1.5')) {
      return (tpl.kor_pct + maxME) * 1.5 + tpl.hist_grade_score;
    }
    const score = maxME * 0.4 + tpl.eng_grade_score * 0.3 + tpl.inq_avg_pct * 0.3;
    return score * (total / 100) * ratio + tpl.hist_grade_score;
  }

  // 정규화 (kor_max)
  if (formula.includes('{kor_max}') || formula.includes('/ 560') || formula.includes('/ 600')) {
    return (tpl.kor_std / 150) * 200 + (tpl.math_std / 150) * 200 + (tpl.inq_avg_pct / 100) * 200 + tpl.eng_grade_score + tpl.hist_grade_score;
  }

  // select_ranked_weights
  if (selRules?.type === 'select_ranked_weights') {
    const weights = selRules.weights || [0.5, 0.3, 0.2];
    const scores = [tpl.kor_pct, tpl.math_pct, tpl.eng_grade_score, tpl.inq_avg_pct];
    const sorted = [...scores].sort((a, b) => b - a);
    let weighted = 0;
    for (let i = 0; i < weights.length && i < sorted.length; i++) {
      weighted += sorted[i] * weights[i];
    }
    return weighted * (total / 100) * ratio + tpl.hist_grade_score;
  }

  // 계명대 (4과목 평균 * 4 = 합계)
  if (formula.includes('* 0.25') && formula.includes('* 4')) {
    return tpl.kor_pct + tpl.math_pct + 100 + tpl.inq_avg_pct + tpl.hist_grade_score;
  }

  // 경남대 (기본점 + 합계)
  if (formula.match(/^\s*\(\s*\d{3}\s*\+/)) {
    const baseMatch = formula.match(/^\s*\(\s*(\d+)/);
    const base = baseMatch ? parseInt(baseMatch[1]) : 480;
    return base + ((tpl.kor_pct + tpl.math_pct + 100 + tpl.inq1_pct) * 0.3) + (tpl.math_pct >= 90 ? 10 : 0);
  }

  // 창원대 (커스텀)
  if (formula.includes('0.6 +') && formula.includes('0.4 *') && formula.includes('ratio_kor_norm')) {
    return null;
  }

  // 가중 표준점수 합
  if (formula.includes('{kor_std}') || formula.includes('{math_std}')) {
    // 연세대
    if (formula.includes('* 850 / 600')) {
      return (tpl.kor_std + tpl.math_std + tpl.eng_grade_score + tpl.inq_avg_converted) * (850 / 600);
    }
    // ratio5 (중앙대)
    if (formula.includes('ratio5')) {
      return (tpl.kor_std + tpl.math_std + tpl.inq_sum_converted + tpl.eng_grade_score + tpl.hist_grade_score) * ratio;
    }
    // 충남대 비실기
    if (formula.includes('120/200') || formula.includes('90/200')) {
      return tpl.kor_std * 0.6 + tpl.math_std * 0.45 + tpl.inq1_std * 0.45 + tpl.inq2_std * 0.45 + tpl.eng_grade_score + tpl.hist_grade_score;
    }
    // 충남대 체육교육과
    if (formula.includes('* 120)') && formula.includes('* 90)') && formula.includes('/ 200')) {
      return (tpl.kor_std * 120 + tpl.math_std * 90 + (tpl.inq1_std + tpl.inq2_std) * 90) / 200 + tpl.eng_grade_score + tpl.hist_grade_score;
    }
    // 경북대 체육학부
    if (formula.includes('* 1.4)') && !formula.includes('math_std')) {
      return (tpl.kor_std + tpl.eng_grade_score + tpl.inq_sum_converted) * 1.4 + tpl.hist_grade_score;
    }

    // 기본 가중합
    const korCoeffMatch = formula.match(/\{kor_std\}\s*\*?\s*([\d.]+)?/);
    const mathCoeffMatch = formula.match(/\{math_std\}\s*\*?\s*([\d.]+)?/);
    const korCoeff = korCoeffMatch && korCoeffMatch[1] ? parseFloat(korCoeffMatch[1]) : 1;
    const mathCoeff = mathCoeffMatch && mathCoeffMatch[1] ? parseFloat(mathCoeffMatch[1]) : 1;

    let score = tpl.kor_std * korCoeff + tpl.math_std * mathCoeff;
    if (formula.includes('inq')) score += tpl.inq_sum_converted * 0.8;
    if (formula.includes('eng_grade_score')) score += tpl.eng_grade_score;
    if (formula.includes('hist_grade_score')) score += tpl.hist_grade_score;
    return score;
  }

  return null;
}

async function main() {
  console.log('=== 템플릿 vs TypeScript 엔진 비교 ===\n');

  // 최고표점
  const [highestRows] = await cafe24Pool.execute(`
    SELECT * FROM 정시최고표점 WHERE 학년도 = ? AND 모형 = '수능'
  `, [YEAR]);

  const highestMap = {};
  for (const row of highestRows) {
    highestMap[row.과목명] = Number(row.최고점) || 0;
  }

  // 특수공식 조회
  const [rows] = await cafe24Pool.execute(`
    SELECT b.U_ID, b.대학명, b.학과명, r.*
    FROM 정시기본 b
    JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
    WHERE r.학년도 = ? AND r.계산유형 = '특수공식'
    ORDER BY b.U_ID
  `, [YEAR]);

  console.log(`특수공식 학과: ${rows.length}개\n`);

  let matched = 0, mismatched = 0, skipped = 0;
  const mismatches = [];

  for (const row of rows) {
    const uid = row.U_ID;
    const name = `[${uid}] ${row.대학명} - ${row.학과명}`;
    const formula = row.특수공식 || '';

    let selRules = null;
    try {
      selRules = typeof row.selection_rules === 'string'
        ? JSON.parse(row.selection_rules)
        : row.selection_rules;
    } catch (e) {}

    // 1. TypeScript 엔진 계산
    // 함수 시그니처: calculateScoreWithConv(formulaData, studentScores, convMap, options, highestMap)
    let tsScore;
    try {
      const result = calculateScoreWithConv(row, testStudentTS, null, null, highestMap);
      tsScore = typeof result === 'number' ? result : (result?.totalScore ?? 0);
      if (typeof tsScore !== 'number' || isNaN(tsScore)) {
        tsScore = 0;
      }
    } catch (err) {
      console.log(`⚠️ ${name}: TS 엔진 에러 - ${err.message}`);
      skipped++;
      continue;
    }

    // 2. 템플릿 계산
    const templateScore = calculateByTemplate(formula, selRules, {
      total: row.총점,
      suneung_ratio: row.수능
    });

    if (templateScore === null) {
      console.log(`⏭️ ${name}: 커스텀 (TS=${tsScore.toFixed(2)})`);
      skipped++;
      continue;
    }

    // 3. 비교
    const diff = Math.abs(tsScore - templateScore);
    const threshold = 5; // 5점 오차 허용 (변환표준점수 등 차이)

    if (diff <= threshold) {
      matched++;
      console.log(`✅ ${name}: TS=${tsScore.toFixed(2)}, TPL=${templateScore.toFixed(2)}, 차이=${diff.toFixed(2)}`);
    } else {
      mismatched++;
      mismatches.push({ uid, name, ts: tsScore, template: templateScore, diff });
      console.log(`❌ ${name}: TS=${tsScore.toFixed(2)}, TPL=${templateScore.toFixed(2)}, 차이=${diff.toFixed(2)}`);
    }
  }

  // 요약
  console.log('\n' + '='.repeat(70));
  console.log(' 비교 결과 요약');
  console.log('='.repeat(70));
  console.log(`  총 학과: ${rows.length}개`);
  console.log(`  일치 (5점 이내): ${matched}개`);
  console.log(`  불일치: ${mismatched}개`);
  console.log(`  스킵/커스텀: ${skipped}개`);
  console.log(`\n  일치율: ${((matched / (matched + mismatched)) * 100).toFixed(1)}%`);

  if (mismatches.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log(' 불일치 상세 (상위 10개)');
    console.log('='.repeat(70));
    for (const m of mismatches.slice(0, 10)) {
      console.log(`\n${m.name}`);
      console.log(`  TS: ${m.ts.toFixed(2)}`);
      console.log(`  TPL: ${m.template.toFixed(2)}`);
      console.log(`  차이: ${m.diff.toFixed(2)}`);
    }
  }

  await cafe24Pool.end();
}

main().catch(console.error);
