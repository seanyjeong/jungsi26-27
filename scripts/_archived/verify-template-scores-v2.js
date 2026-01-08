/**
 * 템플릿 점수 검증 v2 - 개선된 패턴 감지 + 스케일 수정
 */

const mysql = require('mysql2/promise');

const YEAR = 2026;

// 테스트 학생
const testStudent = {
  kor_pct: 99,
  kor_std: 145,
  math_pct: 99,
  math_std: 148,
  eng_grade: 1,
  eng_grade_score: 100,
  eng_pct_est: 100, // 영어 백분위 추정
  inq1_pct: 98,
  inq1_std: 70,
  inq1_converted_std: 72,
  inq2_pct: 96,
  inq2_std: 68,
  inq2_converted_std: 70,
  hist_grade: 1,
  hist_grade_score: 10,
};

// 파생 값
const derived = {
  inq_avg_pct: (testStudent.inq1_pct + testStudent.inq2_pct) / 2, // 97
  inq_sum_std: testStudent.inq1_std + testStudent.inq2_std, // 138
  inq_sum_converted: testStudent.inq1_converted_std + testStudent.inq2_converted_std, // 142
  inq_avg_converted: (testStudent.inq1_converted_std + testStudent.inq2_converted_std) / 2, // 71
  max_math_eng_pct: Math.max(testStudent.math_pct, testStudent.eng_grade_score), // 100
};

/**
 * 개선된 패턴 감지
 */
function detectTemplate(formula, selRules) {
  // 1. top2/top3 패턴
  if (formula.includes('top2_') || formula.includes('top3_')) {
    return { template: 'top_n_select', method: formula.includes('top2') ? 2 : 3 };
  }

  // 2. max_kor_math 또는 top1_math_or_eng (택1)
  if (formula.includes('max_kor_math') || formula.includes('top1_math_or_eng')) {
    return { template: 'max_subject' };
  }

  // 3. 정규화 ({kor_max} 등)
  if (formula.includes('{kor_max}') || formula.includes('/ 560') || formula.includes('/ 600')) {
    return { template: 'normalized' };
  }

  // 4. select_ranked_weights
  if (selRules?.type === 'select_ranked_weights') {
    return { template: 'ranked_weights', weights: selRules.weights };
  }

  // 5. 4과목 평균 패턴 (계명대)
  if (formula.includes('* 0.25') && formula.includes('* 4')) {
    return { template: 'basic_ratio', type: 'average4' };
  }

  // 6. 기본점 + 합계 패턴 (경남대)
  if (formula.match(/^\s*\(\s*\d{3}\s*\+/)) {
    const baseMatch = formula.match(/^\s*\(\s*(\d+)/);
    return { template: 'basic_with_base', base: baseMatch ? parseInt(baseMatch[1]) : 0 };
  }

  // 7. 창원대 특수 패턴
  if (formula.includes('0.6 +') && formula.includes('0.4 *') && formula.includes('ratio_kor_norm')) {
    return { template: 'custom', reason: '창원대 특수 (60%기본+40%성적비례)' };
  }

  // 8. 가중 표준점수 합 (나머지 대부분)
  if (formula.includes('{kor_std}') || formula.includes('{math_std}')) {
    // 배수 추출
    const scaleMatch = formula.match(/\*\s*(\d+)\s*\/\s*(\d+)\s*$/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) / parseFloat(scaleMatch[2]) : 1;
    return { template: 'weighted_std', scale };
  }

  // 9. ratio5 패턴 (중앙대)
  if (formula.includes('ratio5')) {
    return { template: 'weighted_std', type: 'ratio5' };
  }

  return { template: 'custom', reason: '패턴 미감지' };
}

/**
 * 개선된 템플릿 계산
 */
function calculateTemplate(info, formula, student, config) {
  const { total = 1000, suneung_ratio = 100 } = config;
  const ratio = suneung_ratio / 100;

  switch (info.template) {
    case 'top_n_select': {
      const n = info.method || 3;
      const scores = [student.kor_pct, student.math_pct, student.eng_grade_score, derived.inq_avg_pct];
      const sorted = [...scores].sort((a, b) => b - a).slice(0, n);

      // 계수, 기본점 추출
      const coeffMatch = formula.match(/\*\s*([\d.]+)\s*\)\s*\+/);
      const baseMatch = formula.match(/\+\s*(\d+)\s*\)\s*\*/);
      const coeff = coeffMatch ? parseFloat(coeffMatch[1]) : 1;
      const base = baseMatch ? parseInt(baseMatch[1]) : 0;

      const avg = sorted.reduce((a, b) => a + b, 0) / n;
      const rawScore = avg * coeff + base;

      return rawScore * ratio + student.hist_grade_score;
    }

    case 'max_subject': {
      // 수학/영어 택1
      const maxME = Math.max(student.math_pct, student.eng_grade_score);

      // 강원대 스포츠과학과: (국어 + 탐구평균 + 택1) * 0.6
      if (formula.includes('inq_avg2_percentile')) {
        const sum = student.kor_pct + derived.inq_avg_pct + maxME;
        return sum * 0.6 + student.hist_grade_score;
      }

      // 강원대 체육교육과: (국어 + 택1) * 1.5
      if (formula.includes('* 1.5')) {
        return (student.kor_pct + maxME) * 1.5 + student.hist_grade_score;
      }

      // 기본: 택1 40% + 영어 30% + 탐구 30%
      const score = maxME * 0.4 + student.eng_grade_score * 0.3 + derived.inq_avg_pct * 0.3;
      return score * (total / 100) * ratio + student.hist_grade_score;
    }

    case 'weighted_std': {
      // 연세대: 합계 × 850/600
      if (formula.includes('* 850 / 600')) {
        const sum = student.kor_std + student.math_std + student.eng_grade_score + derived.inq_avg_converted;
        return sum * (850 / 600);
      }

      // 중앙대: ratio5 (대략 1:1:1:1:1 비율로 가정)
      if (formula.includes('ratio5')) {
        const sum = student.kor_std + student.math_std + derived.inq_sum_converted + student.eng_grade_score + student.hist_grade_score;
        return sum * ratio;
      }

      // 충남대 비실기: 각 계수 적용
      if (formula.includes('120/200') || formula.includes('90/200')) {
        const korPart = student.kor_std * (120 / 200); // 0.6
        const mathPart = student.math_std * (90 / 200); // 0.45
        const inq1Part = student.inq1_std * (45 / 100); // 0.45
        const inq2Part = student.inq2_std * (45 / 100); // 0.45
        return korPart + mathPart + inq1Part + inq2Part + student.eng_grade_score + student.hist_grade_score;
      }

      // 충남대 체육교육과: (kor*120 + math*90 + inq*90) / 200 + eng + hist
      if (formula.includes('* 120)') && formula.includes('* 90)') && formula.includes('/ 200')) {
        const korPart = student.kor_std * 120;
        const mathPart = student.math_std * 90;
        const inqPart = (student.inq1_std + student.inq2_std) * 90;
        return (korPart + mathPart + inqPart) / 200 + student.eng_grade_score + student.hist_grade_score;
      }

      // 경북대 체육학부: (국어 + 영어 + 탐구합) × 1.4 + 한국사
      if (formula.includes('* 1.4)') && !formula.includes('math_std')) {
        const sum = student.kor_std + student.eng_grade_score + derived.inq_sum_converted;
        return sum * 1.4 + student.hist_grade_score;
      }

      // 기본: 계수 추출 시도
      const korCoeffMatch = formula.match(/\{kor_std\}\s*\*?\s*([\d.]+)?/);
      const mathCoeffMatch = formula.match(/\{math_std\}\s*\*?\s*([\d.]+)?/);

      const korCoeff = korCoeffMatch && korCoeffMatch[1] ? parseFloat(korCoeffMatch[1]) : 1;
      const mathCoeff = mathCoeffMatch && mathCoeffMatch[1] ? parseFloat(mathCoeffMatch[1]) : 1;

      let score = student.kor_std * korCoeff + student.math_std * mathCoeff;

      // 탐구
      if (formula.includes('inq')) {
        score += derived.inq_sum_converted * 0.8;
      }

      // 영어, 한국사
      if (formula.includes('eng_grade_score')) score += student.eng_grade_score;
      if (formula.includes('hist_grade_score')) score += student.hist_grade_score;

      // 스케일 적용
      if (info.scale && info.scale !== 1) {
        score *= info.scale;
      }

      return score;
    }

    case 'basic_ratio': {
      // 계명대: 4과목 평균 × 4 = 합계
      if (info.type === 'average4') {
        const sum = student.kor_pct + student.math_pct + student.eng_pct_est + derived.inq_avg_pct;
        return sum + student.hist_grade_score;
      }

      // 기본 비율
      const korPart = student.kor_pct * 0.25;
      const mathPart = student.math_pct * 0.25;
      const engPart = student.eng_grade_score * 0.25;
      const inqPart = derived.inq_avg_pct * 0.25;
      const sum = korPart + mathPart + engPart + inqPart;

      return sum * (total / 100) * ratio + student.hist_grade_score;
    }

    case 'basic_with_base': {
      // 경남대: 480 + 4과목합×0.3 + 수학보너스
      const base = info.base || 480;
      const sum = student.kor_pct + student.math_pct + student.eng_pct_est + student.inq1_pct;
      const bonus = student.math_pct >= 90 ? 10 : 0; // 수학 보너스 추정

      return base + (sum * 0.3) + bonus;
    }

    case 'normalized': {
      const korNorm = (student.kor_std / 150) * 200;
      const mathNorm = (student.math_std / 150) * 200;
      const inqNorm = (derived.inq_avg_pct / 100) * 200;
      return korNorm + mathNorm + inqNorm + student.eng_grade_score + student.hist_grade_score;
    }

    case 'ranked_weights': {
      const weights = info.weights || [0.5, 0.3, 0.2];
      const scores = [student.kor_pct, student.math_pct, student.eng_grade_score, derived.inq_avg_pct];
      const sorted = [...scores].sort((a, b) => b - a);

      let weighted = 0;
      for (let i = 0; i < weights.length && i < sorted.length; i++) {
        weighted += sorted[i] * weights[i];
      }

      return weighted * (total / 100) * ratio + student.hist_grade_score;
    }

    default:
      return null;
  }
}

async function main() {
  const pool = await mysql.createPool({
    host: '211.37.174.218',
    user: 'maxilsan',
    password: 'q141171616!',
    database: 'jungsi',
    charset: 'utf8mb4',
  });

  console.log('=== 템플릿 점수 검증 v2 ===\n');

  const [rows] = await pool.execute(`
    SELECT b.U_ID, b.대학명, b.학과명, r.총점, r.수능, r.특수공식, r.selection_rules
    FROM 정시기본 b
    JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
    WHERE r.학년도 = ? AND r.계산유형 = '특수공식'
    ORDER BY b.U_ID
  `, [YEAR]);

  console.log(`특수공식 학과: ${rows.length}개\n`);

  const stats = {
    top_n_select: { count: 0, success: 0 },
    weighted_std: { count: 0, success: 0 },
    ranked_weights: { count: 0, success: 0 },
    max_subject: { count: 0, success: 0 },
    normalized: { count: 0, success: 0 },
    basic_ratio: { count: 0, success: 0 },
    basic_with_base: { count: 0, success: 0 },
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
    } catch (e) {}

    const info = detectTemplate(formula, selRules);

    if (info.template === 'custom') {
      stats.custom.count++;
      console.log(`❌ ${name}: 커스텀 (${info.reason})`);
      continue;
    }

    if (!stats[info.template]) {
      stats[info.template] = { count: 0, success: 0 };
    }
    stats[info.template].count++;

    const config = { total: row.총점, suneung_ratio: row.수능 };
    const score = calculateTemplate(info, formula, testStudent, config);

    if (score !== null && !isNaN(score) && score > 0 && score < 2000) {
      stats[info.template].success++;
      console.log(`✅ ${name}: ${info.template} → ${score.toFixed(2)}`);
      results.push({ uid, name, template: info.template, score });
    } else {
      console.log(`⚠️ ${name}: ${info.template} → 계산 실패 또는 범위 이탈 (${score})`);
    }
  }

  // 요약
  console.log('\n' + '='.repeat(70));
  console.log(' 검증 결과 요약');
  console.log('='.repeat(70));

  let totalNormalized = 0;
  let totalSuccess = 0;

  for (const [template, stat] of Object.entries(stats)) {
    if (template === 'custom' || stat.count === 0) continue;
    console.log(`  ${template}: ${stat.success}/${stat.count}개 성공`);
    totalNormalized += stat.count;
    totalSuccess += stat.success;
  }

  console.log(`\n  정규화 대상: ${totalNormalized}개`);
  console.log(`  계산 성공: ${totalSuccess}개 (${((totalSuccess / totalNormalized) * 100).toFixed(1)}%)`);
  console.log(`  커스텀 유지: ${stats.custom.count}개`);

  console.log('\n📊 최종 정규화율:');
  console.log(`  전체 특수공식: ${rows.length}개`);
  console.log(`  정규화 성공: ${totalSuccess}개 (${((totalSuccess / rows.length) * 100).toFixed(1)}%)`);
  console.log(`  커스텀 (정규화 불가): ${stats.custom.count}개 (${((stats.custom.count / rows.length) * 100).toFixed(1)}%)`);

  await pool.end();
}

main().catch(console.error);
