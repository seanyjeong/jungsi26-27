const mysql = require('mysql2/promise');

const YEAR = 2026;

async function main() {
  const pool = mysql.createPool({
    host: '211.37.174.218',
    user: 'maxilsan',
    password: 'q141171616!',
    database: 'jungsi',
    charset: 'utf8mb4'
  });

  const [rows] = await pool.execute(`
    SELECT b.U_ID, b.대학명, b.학과명, r.특수공식, r.수능, r.국어, r.수학, r.영어, r.탐구
    FROM 정시기본 b
    JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
    WHERE r.학년도 = ? AND r.계산유형 = '특수공식'
    ORDER BY b.대학명, b.학과명
  `, [YEAR]);

  // 패턴별 분류
  const categories = {
    top_n_avg: [],           // 상위 N개 평균/합계
    weighted_std: [],        // 가중 표준점수 합
    normalized: [],          // 정규화 계산
    max_subject: [],         // 국/수 택1
    truly_custom: []         // 진짜 커스텀
  };

  for (const r of rows) {
    const f = r.특수공식 || '';
    const uni = `[${r.U_ID}] ${r.대학명} - ${r.학과명}`;

    // 패턴 매칭
    if (f.includes('top3_avg') || f.includes('top2_') || f.includes('top3_sum')) {
      // 상위 N개 계산
      const match = f.match(/top(\d)_(avg|sum)/);
      const n = match ? match[1] : '?';
      const type = match ? match[2] : '?';

      let params = { n: parseInt(n) || 3, type };

      // 계수와 기본점 추출
      const coeffMatch = f.match(/\*\s*([\d.]+)\s*\)/);
      if (coeffMatch) params.coeff = parseFloat(coeffMatch[1]);

      const baseMatch = f.match(/\+\s*(\d+)(?:\s*\)|$)/);
      if (baseMatch) params.base = parseInt(baseMatch[1]);

      categories.top_n_avg.push({ uni, formula: f.substring(0, 100), params });

    } else if (f.includes('max_kor_math') || f.includes('top1_math_or_eng')) {
      // 국/수 택1
      categories.max_subject.push({ uni, formula: f.substring(0, 100) });

    } else if (f.includes('{kor_max}') || f.includes('{math_max}') || f.includes('/ 560') || f.includes('/ 600')) {
      // 정규화 계산
      categories.normalized.push({ uni, formula: f.substring(0, 150) });

    } else if (/\{kor_std\}\s*\*\s*[\d.]+/.test(f) || /\{math_std\}\s*\*\s*[\d.]+/.test(f) || f.includes('ratio5')) {
      // 가중 표준점수 합 - 각 과목에 계수 곱하기
      const coeffs = {};
      const korMatch = f.match(/\{kor_std\}\s*\*?\s*([\d.]+)?/);
      const mathMatch = f.match(/\{math_std\}\s*\*?\s*([\d.]+)?/);

      if (korMatch) coeffs.kor = parseFloat(korMatch[1]) || 1;
      if (mathMatch) coeffs.math = parseFloat(mathMatch[1]) || 1;

      categories.weighted_std.push({ uni, formula: f.substring(0, 150), coeffs });

    } else {
      // 진짜 커스텀
      categories.truly_custom.push({ uni, formula: f.substring(0, 200) });
    }
  }

  // 결과 출력
  console.log('='.repeat(60));
  console.log(' 특수공식 정규화 분석 결과');
  console.log('='.repeat(60));

  console.log('\n📊 분류 요약:');
  console.log(`  상위 N개 평균/합계 (top_n_avg): ${categories.top_n_avg.length}개`);
  console.log(`  가중 표준점수 합 (weighted_std): ${categories.weighted_std.length}개`);
  console.log(`  정규화 계산 (normalized): ${categories.normalized.length}개`);
  console.log(`  국/수 택1 (max_subject): ${categories.max_subject.length}개`);
  console.log(`  진짜 커스텀 (truly_custom): ${categories.truly_custom.length}개`);

  const normalizable = rows.length - categories.truly_custom.length;
  console.log(`\n✅ 정규화 가능: ${normalizable}/${rows.length}개 (${(normalizable/rows.length*100).toFixed(1)}%)`);
  console.log(`❌ 커스텀 유지: ${categories.truly_custom.length}개\n`);

  // 상세 출력
  console.log('\n' + '='.repeat(60));
  console.log(' 1. 상위 N개 평균/합계 → top_n_select 템플릿');
  console.log('='.repeat(60));
  categories.top_n_avg.forEach(item => {
    console.log(`\n${item.uni}`);
    console.log(`  파라미터: ${JSON.stringify(item.params)}`);
    console.log(`  수식: ${item.formula}...`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(' 2. 가중 표준점수 합 → weighted_std 템플릿');
  console.log('='.repeat(60));
  categories.weighted_std.forEach(item => {
    console.log(`\n${item.uni}`);
    if (item.coeffs) console.log(`  계수: ${JSON.stringify(item.coeffs)}`);
    console.log(`  수식: ${item.formula}...`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(' 3. 정규화 계산 → normalized 템플릿');
  console.log('='.repeat(60));
  categories.normalized.forEach(item => {
    console.log(`\n${item.uni}`);
    console.log(`  수식: ${item.formula}...`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(' 4. 국/수 택1 → max_subject 템플릿');
  console.log('='.repeat(60));
  categories.max_subject.forEach(item => {
    console.log(`\n${item.uni}`);
    console.log(`  수식: ${item.formula}...`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(' 5. 진짜 커스텀 (정규화 불가)');
  console.log('='.repeat(60));
  categories.truly_custom.forEach(item => {
    console.log(`\n${item.uni}`);
    console.log(`  수식: ${item.formula}...`);
  });

  await pool.end();
}

main().catch(console.error);
