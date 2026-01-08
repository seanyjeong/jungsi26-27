/**
 * 데이터 이관 스크립트
 * cafe24 jungsi DB → 로컬 univjungsi DB
 *
 * 실행: npx ts-node scripts/migrate-data.ts
 */

import mysql from 'mysql2/promise';

const YEAR = 2026; // 이관할 연도

// Cafe24 DB 연결
const cafe24Pool = mysql.createPool({
  host: '211.37.174.218',
  user: 'maxilsan',
  password: 'q141171616!',
  database: 'jungsi',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
});

// 로컬 DB 연결
const localPool = mysql.createPool({
  host: 'localhost',
  user: 'paca',
  password: 'q141171616!',
  database: 'univjungsi',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
});

async function migrate() {
  console.log(`\n========== ${YEAR}학년도 데이터 이관 시작 ==========\n`);

  const localConn = await localPool.getConnection();

  try {
    await localConn.beginTransaction();

    // 1. 대학 목록 이관
    console.log('1. 대학 목록 이관...');
    const [univRows] = await cafe24Pool.execute<any[]>(
      `SELECT DISTINCT 대학명 FROM 정시기본 WHERE 학년도 = ? ORDER BY 대학명`,
      [YEAR]
    );

    const univMap = new Map<string, number>(); // 대학명 → univ_id 매핑

    for (const row of univRows) {
      const [result] = await localConn.execute<any>(
        `INSERT INTO universities (univ_name) VALUES (?)
         ON DUPLICATE KEY UPDATE univ_id = LAST_INSERT_ID(univ_id)`,
        [row.대학명]
      );
      univMap.set(row.대학명, result.insertId);
    }
    console.log(`   → ${univRows.length}개 대학 완료`);

    // 2. 학과 + 반영비율 이관
    console.log('2. 학과 정보 이관...');
    const [deptRows] = await cafe24Pool.execute<any[]>(
      `SELECT b.*, r.*
       FROM 정시기본 b
       LEFT JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
       WHERE b.학년도 = ?`,
      [YEAR]
    );

    const deptMap = new Map<number, number>(); // 기존 U_ID → 새 dept_id 매핑

    for (const row of deptRows) {
      const univId = univMap.get(row.대학명);
      if (!univId) {
        console.warn(`   ⚠️ 대학 미발견: ${row.대학명}`);
        continue;
      }

      // 모집인원 파싱 (숫자가 아닌 경우 0으로)
      let moJipInwon = 0;
      if (row.모집정원) {
        const parsed = parseInt(String(row.모집정원).replace(/[^0-9]/g, ''));
        if (!isNaN(parsed)) moJipInwon = parsed;
      }

      // 모집군 정규화
      let moJipGun = '가';
      if (row.군) {
        const gunStr = String(row.군).trim();
        if (gunStr.includes('가')) moJipGun = '가';
        else if (gunStr.includes('나')) moJipGun = '나';
        else if (gunStr.includes('다')) moJipGun = '다';
      }

      // 학과 INSERT (중복 시 기존 ID 사용)
      let deptId: number;
      try {
        const [deptResult] = await localConn.execute<any>(
          `INSERT INTO departments (univ_id, year_id, dept_name, 모집군, 모집인원, 형태, 교직, 단계별)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            univId,
            YEAR,
            row.학과명 || '',
            moJipGun,
            moJipInwon,
            row.형태 || null,
            row.교직 || null,
            row.단계별 || null
          ]
        );
        deptId = deptResult.insertId;
      } catch (e: any) {
        if (e.code === 'ER_DUP_ENTRY') {
          // 중복인 경우 기존 ID 조회
          const [existing] = await localConn.execute<any[]>(
            `SELECT dept_id FROM departments WHERE univ_id = ? AND year_id = ? AND dept_name = ? AND 모집군 = ?`,
            [univId, YEAR, row.학과명 || '', moJipGun]
          );
          if (existing.length > 0) {
            deptId = existing[0].dept_id;
            // 기존 레코드가 있으면 매핑만 추가하고 다음으로
            deptMap.set(row.U_ID, deptId);
            continue;
          }
          throw e;
        }
        throw e;
      }
      deptMap.set(row.U_ID, deptId);

      // formula_configs INSERT (JSON 구조로 변환)
      const subjectsConfig = {
        korean: {
          enabled: true,
          ratio: Number(row.국어) || 0,
          source_type: 'pct',
          normalization: { method: 'fixed_100' }
        },
        math: {
          enabled: true,
          ratio: Number(row.수학) || 0,
          source_type: 'pct',
          normalization: { method: 'fixed_100' }
        },
        english: {
          enabled: true,
          ratio: Number(row.영어) || 0,
          source_type: 'grade_conv'
        },
        inquiry: {
          enabled: true,
          ratio: Number(row.탐구) || 0,
          count: parseInt(row.탐구수) || 2,
          source_type: 'pct'
        },
        history: {
          mode: Number(row.한국사) > 0 ? 'subject' : 'bonus',
          ratio: Number(row.한국사) || 0
        }
      };

      // score_config 파싱
      let scoreConfig = null;
      try {
        scoreConfig = row.score_config ? JSON.parse(row.score_config) : null;
        if (scoreConfig?.korean_math?.type === '표준점수') {
          subjectsConfig.korean.source_type = 'std';
          subjectsConfig.math.source_type = 'std';
        }
        if (scoreConfig?.korean_math?.max_score_method === 'highest_of_year') {
          subjectsConfig.korean.normalization = { method: 'highest_of_year' };
          subjectsConfig.math.normalization = { method: 'highest_of_year' };
        }
        if (scoreConfig?.inquiry?.type === '변환표준점수') {
          subjectsConfig.inquiry.source_type = 'conv_std';
        }
      } catch (e) {}

      // selection_rules 파싱
      let selectionRules = null;
      try {
        selectionRules = row.selection_rules ? JSON.parse(row.selection_rules) : null;
      } catch (e) {}

      // bonus_rules 파싱
      let bonusRules = null;
      try {
        bonusRules = row.bonus_rules ? JSON.parse(row.bonus_rules) : null;
      } catch (e) {}

      // 특수공식 처리
      let specialMode = null;
      let legacyFormula = null;
      if (row.계산유형 === '특수공식' && row.특수공식) {
        legacyFormula = row.특수공식;
      }

      await localConn.execute(
        `INSERT INTO formula_configs
         (dept_id, total_score, suneung_ratio, subjects_config, selection_rules, bonus_rules, special_mode, legacy_formula)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deptId,
          Number(row.총점) || 1000,
          Number(row.수능) || 100,
          JSON.stringify(subjectsConfig),
          selectionRules ? JSON.stringify(selectionRules) : null,
          bonusRules ? JSON.stringify(bonusRules) : null,
          specialMode ? JSON.stringify(specialMode) : null,
          legacyFormula
        ]
      );

      // 영어 등급표 INSERT
      if (row.english_scores) {
        try {
          const engScores = JSON.parse(row.english_scores);
          for (const [grade, score] of Object.entries(engScores)) {
            await localConn.execute(
              `INSERT INTO english_grade_tables (dept_id, grade, score) VALUES (?, ?, ?)`,
              [deptId, parseInt(grade), Number(score)]
            );
          }
        } catch (e) {}
      }

      // 한국사 등급표 INSERT
      if (row.history_scores) {
        try {
          const histScores = JSON.parse(row.history_scores);
          for (const [grade, score] of Object.entries(histScores)) {
            await localConn.execute(
              `INSERT INTO history_grade_tables (dept_id, grade, score) VALUES (?, ?, ?)`,
              [deptId, parseInt(grade), Number(score)]
            );
          }
        } catch (e) {}
      }
    }
    console.log(`   → ${deptRows.length}개 학과 완료`);

    // 3. 탐구 변환표준점수 이관
    console.log('3. 탐구 변환표준점수 이관...');
    const [convRows] = await cafe24Pool.execute<any[]>(
      `SELECT * FROM 정시탐구변환표준 WHERE 학년도 = ?`,
      [YEAR]
    );

    let convCount = 0;
    for (const row of convRows) {
      const deptId = deptMap.get(row.U_ID);
      if (!deptId) continue;

      await localConn.execute(
        `INSERT INTO inquiry_conv_tables (dept_id, 계열, 백분위, 변환표준점수) VALUES (?, ?, ?, ?)`,
        [deptId, row.계열, row.백분위, row.변환표준점수]
      );
      convCount++;
    }
    console.log(`   → ${convCount}개 변환표 완료`);

    // 4. 실기 배점표 이관
    console.log('4. 실기 배점표 이관...');
    const [pracRows] = await cafe24Pool.execute<any[]>(
      `SELECT * FROM 정시실기배점 WHERE 학년도 = ?`,
      [YEAR]
    );

    let pracCount = 0;
    for (const row of pracRows) {
      const deptId = deptMap.get(row.U_ID);
      if (!deptId) continue;
      if (!row.종목명 || row.기록 === undefined) continue;

      // 컬럼명이 '배점'일 수 있음
      const score = row.점수 ?? row.배점 ?? 0;

      await localConn.execute(
        `INSERT INTO practical_score_tables (dept_id, 종목명, 성별, 기록, 점수) VALUES (?, ?, ?, ?, ?)`,
        [deptId, row.종목명 || '', row.성별 || '공통', String(row.기록 ?? ''), Number(score)]
      );
      pracCount++;
    }
    console.log(`   → ${pracCount}개 실기배점 완료`);

    // 5. 최고표점 이관
    console.log('5. 최고표점 이관...');
    const [highRows] = await cafe24Pool.execute<any[]>(
      `SELECT * FROM 정시최고표점 WHERE 학년도 = ?`,
      [YEAR]
    );

    for (const row of highRows) {
      await localConn.execute(
        `INSERT INTO highest_scores (year_id, 모형, 과목명, 최고점) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 최고점 = VALUES(최고점)`,
        [YEAR, row.모형, row.과목명, row.최고점]
      );
    }
    console.log(`   → ${highRows.length}개 최고표점 완료`);

    // 6. 등급컷 이관
    console.log('6. 등급컷 이관...');
    const [cutRows] = await cafe24Pool.execute<any[]>(
      `SELECT * FROM 정시예상등급컷 WHERE 학년도 = ?`,
      [YEAR]
    );

    for (const row of cutRows) {
      await localConn.execute(
        `INSERT INTO grade_cuts (year_id, 모형, 선택과목명, 등급, 원점수, 표준점수, 백분위) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 원점수 = VALUES(원점수), 표준점수 = VALUES(표준점수), 백분위 = VALUES(백분위)`,
        [YEAR, row.모형, row.선택과목명, row.등급, row.원점수, row.표준점수, row.백분위]
      );
    }
    console.log(`   → ${cutRows.length}개 등급컷 완료`);

    // 커밋
    await localConn.commit();

    // 검증
    console.log('\n========== 이관 결과 검증 ==========');
    const [univCount] = await localConn.execute<any[]>('SELECT COUNT(*) as cnt FROM universities');
    const [deptCount] = await localConn.execute<any[]>('SELECT COUNT(*) as cnt FROM departments WHERE year_id = ?', [YEAR]);
    const [formulaCount] = await localConn.execute<any[]>('SELECT COUNT(*) as cnt FROM formula_configs');

    console.log(`대학: ${univCount[0].cnt}개`);
    console.log(`학과: ${deptCount[0].cnt}개`);
    console.log(`계산식 설정: ${formulaCount[0].cnt}개`);

    console.log('\n========== 이관 완료! ==========\n');

  } catch (error) {
    await localConn.rollback();
    console.error('❌ 이관 중 오류 발생:', error);
    throw error;
  } finally {
    localConn.release();
    await cafe24Pool.end();
    await localPool.end();
  }
}

migrate().catch(console.error);
