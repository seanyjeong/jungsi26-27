#!/usr/bin/env ts-node
/**
 * 연도 관리 CLI (Year Management CLI)
 *
 * 명령어:
 *   year:list              - 모든 연도 목록 조회
 *   year:create <연도>     - 이전 연도 데이터를 복사하여 새 연도 생성
 *   year:activate <연도>   - 특정 연도를 활성화
 *   year:delete <연도>     - 연도 삭제 (주의!)
 *   group:list <연도>      - 해당 연도의 군이동 목록 조회
 *   group:add              - 군이동 등록
 *   group:apply <연도>     - 군이동 적용
 *
 * 사용법:
 *   npx ts-node scripts/year-cli.ts year:list
 *   npx ts-node scripts/year-cli.ts year:create 2027
 */

import mysql from 'mysql2/promise';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.local 로드
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// DB Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'paca',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'univjungsi',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
});

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ ${message}`, 'cyan');
}

function logWarn(message: string) {
  log(`⚠ ${message}`, 'yellow');
}

// ============================================
// 유틸리티 함수
// ============================================

async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

async function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function confirm(message: string): Promise<boolean> {
  const answer = await askQuestion(`${message} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

// ============================================
// year:list - 연도 목록 조회
// ============================================

async function yearList() {
  log('\n📅 연도 목록', 'bright');
  log('─'.repeat(60));

  const years = await query<{
    year_id: number;
    is_active: number;
    data_copied_from: number | null;
    created_at: Date;
  }>(`
    SELECT year_id, is_active, data_copied_from, created_at
    FROM year_configs
    ORDER BY year_id DESC
  `);

  if (years.length === 0) {
    logWarn('등록된 연도가 없습니다.');
    return;
  }

  for (const year of years) {
    // 각 연도의 데이터 통계
    const [deptCount] = await query<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM departments WHERE year_id = ?',
      [year.year_id]
    );
    const [studentCount] = await query<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM students WHERE year_id = ?',
      [year.year_id]
    );

    const activeLabel = year.is_active ? `${colors.green}[활성]${colors.reset}` : '      ';
    const copiedLabel = year.data_copied_from
      ? `(${year.data_copied_from}에서 복사)`
      : '';

    console.log(
      `  ${year.year_id}학년도 ${activeLabel} - 학과: ${deptCount.cnt}개, 학생: ${studentCount.cnt}명 ${copiedLabel}`
    );
  }

  log('─'.repeat(60));
}

// ============================================
// year:create - 새 연도 생성 (데이터 복사)
// ============================================

async function yearCreate(targetYear: number) {
  log(`\n📦 ${targetYear}학년도 데이터 생성`, 'bright');
  log('─'.repeat(60));

  // 이미 존재하는지 확인
  const existing = await queryOne(
    'SELECT year_id FROM year_configs WHERE year_id = ?',
    [targetYear]
  );

  if (existing) {
    logError(`${targetYear}학년도 데이터가 이미 존재합니다.`);
    return;
  }

  // 이전 연도 찾기
  const prevYear = await queryOne<{ year_id: number }>(
    'SELECT year_id FROM year_configs WHERE year_id < ? ORDER BY year_id DESC LIMIT 1',
    [targetYear]
  );

  if (!prevYear) {
    logError('복사할 이전 연도 데이터가 없습니다.');
    return;
  }

  const sourceYear = prevYear.year_id;
  logInfo(`${sourceYear}학년도 데이터를 기반으로 복사합니다.`);

  // 소스 연도 통계
  const [sourceDeptCount] = await query<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM departments WHERE year_id = ?',
    [sourceYear]
  );

  logInfo(`복사할 학과: ${sourceDeptCount.cnt}개`);

  // 확인
  const proceed = await confirm('진행하시겠습니까?');
  if (!proceed) {
    logWarn('취소되었습니다.');
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. year_configs 생성
    await connection.execute(
      'INSERT INTO year_configs (year_id, is_active, data_copied_from) VALUES (?, FALSE, ?)',
      [targetYear, sourceYear]
    );
    logSuccess(`year_configs: ${targetYear}학년도 생성`);

    // 2. departments 복사 (dept_id 매핑 저장)
    const deptMapping: Map<number, number> = new Map();

    const sourceDepts = await query<{
      dept_id: number;
      univ_id: number;
      dept_name: string;
      모집군: string;
      모집인원: number;
      형태: string | null;
      교직: string | null;
      단계별: string | null;
    }>(
      `SELECT dept_id, univ_id, dept_name, 모집군, 모집인원, 형태, 교직, 단계별
       FROM departments WHERE year_id = ?`,
      [sourceYear]
    );

    let deptCopied = 0;
    for (const dept of sourceDepts) {
      const [result] = await connection.execute(
        `INSERT INTO departments (univ_id, year_id, dept_name, 모집군, 모집인원, 형태, 교직, 단계별)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dept.univ_id,
          targetYear,
          dept.dept_name,
          dept.모집군,
          dept.모집인원,
          dept.형태,
          dept.교직,
          dept.단계별,
        ]
      );
      const newDeptId = (result as any).insertId;
      deptMapping.set(dept.dept_id, newDeptId);
      deptCopied++;
    }
    logSuccess(`departments: ${deptCopied}개 복사`);

    // 3. formula_configs 복사
    let formulaCopied = 0;
    for (const [oldDeptId, newDeptId] of deptMapping) {
      const formula = await queryOne<{
        total_score: number;
        suneung_ratio: number;
        subjects_config: string | null;
        selection_rules: string | null;
        bonus_rules: string | null;
        special_mode: string | null;
        legacy_formula: string | null;
      }>(
        `SELECT total_score, suneung_ratio, subjects_config, selection_rules,
                bonus_rules, special_mode, legacy_formula
         FROM formula_configs WHERE dept_id = ?`,
        [oldDeptId]
      );

      if (formula) {
        await connection.execute(
          `INSERT INTO formula_configs
           (dept_id, total_score, suneung_ratio, subjects_config, selection_rules, bonus_rules, special_mode, legacy_formula)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newDeptId,
            formula.total_score,
            formula.suneung_ratio,
            formula.subjects_config,
            formula.selection_rules,
            formula.bonus_rules,
            formula.special_mode,
            formula.legacy_formula,
          ]
        );
        formulaCopied++;
      }
    }
    logSuccess(`formula_configs: ${formulaCopied}개 복사`);

    // 4. english_grade_tables 복사
    let engGradeCopied = 0;
    for (const [oldDeptId, newDeptId] of deptMapping) {
      const grades = await query<{ grade: number; score: number }>(
        'SELECT grade, score FROM english_grade_tables WHERE dept_id = ?',
        [oldDeptId]
      );

      for (const g of grades) {
        await connection.execute(
          'INSERT INTO english_grade_tables (dept_id, grade, score) VALUES (?, ?, ?)',
          [newDeptId, g.grade, g.score]
        );
        engGradeCopied++;
      }
    }
    logSuccess(`english_grade_tables: ${engGradeCopied}개 복사`);

    // 5. history_grade_tables 복사
    let histGradeCopied = 0;
    for (const [oldDeptId, newDeptId] of deptMapping) {
      const grades = await query<{ grade: number; score: number }>(
        'SELECT grade, score FROM history_grade_tables WHERE dept_id = ?',
        [oldDeptId]
      );

      for (const g of grades) {
        await connection.execute(
          'INSERT INTO history_grade_tables (dept_id, grade, score) VALUES (?, ?, ?)',
          [newDeptId, g.grade, g.score]
        );
        histGradeCopied++;
      }
    }
    logSuccess(`history_grade_tables: ${histGradeCopied}개 복사`);

    // 6. inquiry_conv_tables 복사
    let inquiryCopied = 0;
    for (const [oldDeptId, newDeptId] of deptMapping) {
      const convs = await query<{ 계열: string; 백분위: number; 변환표준점수: number }>(
        'SELECT 계열, 백분위, 변환표준점수 FROM inquiry_conv_tables WHERE dept_id = ?',
        [oldDeptId]
      );

      for (const c of convs) {
        await connection.execute(
          'INSERT INTO inquiry_conv_tables (dept_id, 계열, 백분위, 변환표준점수) VALUES (?, ?, ?, ?)',
          [newDeptId, c.계열, c.백분위, c.변환표준점수]
        );
        inquiryCopied++;
      }
    }
    logSuccess(`inquiry_conv_tables: ${inquiryCopied}개 복사`);

    // 7. practical_score_tables 복사
    let practicalCopied = 0;
    for (const [oldDeptId, newDeptId] of deptMapping) {
      const scores = await query<{
        종목명: string;
        성별: string;
        기록: string;
        점수: number;
      }>(
        'SELECT 종목명, 성별, 기록, 점수 FROM practical_score_tables WHERE dept_id = ?',
        [oldDeptId]
      );

      for (const s of scores) {
        await connection.execute(
          'INSERT INTO practical_score_tables (dept_id, 종목명, 성별, 기록, 점수) VALUES (?, ?, ?, ?, ?)',
          [newDeptId, s.종목명, s.성별, s.기록, s.점수]
        );
        practicalCopied++;
      }
    }
    logSuccess(`practical_score_tables: ${practicalCopied}개 복사`);

    // 8. highest_scores 복사 (연도별)
    const highestScores = await query<{
      모형: string;
      과목명: string;
      최고점: number;
    }>(
      'SELECT 모형, 과목명, 최고점 FROM highest_scores WHERE year_id = ?',
      [sourceYear]
    );

    let highestCopied = 0;
    for (const hs of highestScores) {
      await connection.execute(
        'INSERT INTO highest_scores (year_id, 모형, 과목명, 최고점) VALUES (?, ?, ?, ?)',
        [targetYear, hs.모형, hs.과목명, hs.최고점]
      );
      highestCopied++;
    }
    logSuccess(`highest_scores: ${highestCopied}개 복사`);

    // 9. grade_cuts 복사 (연도별)
    const gradeCuts = await query<{
      모형: string;
      선택과목명: string;
      등급: number;
      원점수: number | null;
      표준점수: number | null;
      백분위: number | null;
    }>(
      'SELECT 모형, 선택과목명, 등급, 원점수, 표준점수, 백분위 FROM grade_cuts WHERE year_id = ?',
      [sourceYear]
    );

    let cutsCopied = 0;
    for (const gc of gradeCuts) {
      await connection.execute(
        `INSERT INTO grade_cuts (year_id, 모형, 선택과목명, 등급, 원점수, 표준점수, 백분위)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [targetYear, gc.모형, gc.선택과목명, gc.등급, gc.원점수, gc.표준점수, gc.백분위]
      );
      cutsCopied++;
    }
    logSuccess(`grade_cuts: ${cutsCopied}개 복사`);

    await connection.commit();

    log('─'.repeat(60));
    logSuccess(`${targetYear}학년도 데이터 생성 완료!`);
    log('');
    logInfo('주의: 새 연도가 비활성 상태로 생성되었습니다.');
    logInfo(`활성화하려면: npm run year:activate ${targetYear}`);
    log('');
    logWarn('다음 단계:');
    log('  1. 모집요강 변경사항 확인');
    log('  2. 군이동 있는 학과 확인 및 등록');
    log('  3. 변환표 변경사항 반영');
    log('  4. 새 연도 활성화');

  } catch (error) {
    await connection.rollback();
    logError('데이터 생성 중 오류 발생');
    console.error(error);
  } finally {
    connection.release();
  }
}

// ============================================
// year:activate - 연도 활성화
// ============================================

async function yearActivate(targetYear: number) {
  log(`\n🔄 ${targetYear}학년도 활성화`, 'bright');
  log('─'.repeat(60));

  // 존재하는지 확인
  const existing = await queryOne(
    'SELECT year_id FROM year_configs WHERE year_id = ?',
    [targetYear]
  );

  if (!existing) {
    logError(`${targetYear}학년도 데이터가 존재하지 않습니다.`);
    return;
  }

  // 현재 활성 연도 확인
  const currentActive = await queryOne<{ year_id: number }>(
    'SELECT year_id FROM year_configs WHERE is_active = TRUE'
  );

  if (currentActive?.year_id === targetYear) {
    logInfo(`${targetYear}학년도는 이미 활성 상태입니다.`);
    return;
  }

  // 확인
  if (currentActive) {
    logWarn(`현재 활성 연도: ${currentActive.year_id}학년도`);
    logWarn(`변경 시 ${currentActive.year_id}학년도는 비활성화됩니다.`);
  }

  const proceed = await confirm('진행하시겠습니까?');
  if (!proceed) {
    logWarn('취소되었습니다.');
    return;
  }

  // 모든 연도 비활성화 후 대상 연도만 활성화
  await pool.execute('UPDATE year_configs SET is_active = FALSE');
  await pool.execute(
    'UPDATE year_configs SET is_active = TRUE WHERE year_id = ?',
    [targetYear]
  );

  logSuccess(`${targetYear}학년도가 활성화되었습니다.`);
}

// ============================================
// year:delete - 연도 삭제
// ============================================

async function yearDelete(targetYear: number) {
  log(`\n🗑️  ${targetYear}학년도 삭제`, 'bright');
  log('─'.repeat(60));

  // 존재하는지 확인
  const existing = await queryOne<{ year_id: number; is_active: number }>(
    'SELECT year_id, is_active FROM year_configs WHERE year_id = ?',
    [targetYear]
  );

  if (!existing) {
    logError(`${targetYear}학년도 데이터가 존재하지 않습니다.`);
    return;
  }

  if (existing.is_active) {
    logError('활성 연도는 삭제할 수 없습니다. 먼저 다른 연도를 활성화하세요.');
    return;
  }

  // 통계
  const [deptCount] = await query<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM departments WHERE year_id = ?',
    [targetYear]
  );
  const [studentCount] = await query<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM students WHERE year_id = ?',
    [targetYear]
  );

  logWarn(`삭제될 데이터:`);
  log(`  - 학과: ${deptCount.cnt}개`);
  log(`  - 학생: ${studentCount.cnt}명`);
  log(`  - 관련 모든 설정 및 점수 데이터`);

  // 이중 확인
  logError('⚠️  이 작업은 되돌릴 수 없습니다!');
  const confirm1 = await confirm('정말 삭제하시겠습니까?');
  if (!confirm1) {
    logWarn('취소되었습니다.');
    return;
  }

  const confirmText = await askQuestion(`확인을 위해 "${targetYear}"를 입력하세요: `);
  if (confirmText !== String(targetYear)) {
    logWarn('입력이 일치하지 않아 취소되었습니다.');
    return;
  }

  // CASCADE 삭제 (외래키 설정으로 관련 테이블 자동 삭제)
  await pool.execute('DELETE FROM year_configs WHERE year_id = ?', [targetYear]);

  logSuccess(`${targetYear}학년도 데이터가 삭제되었습니다.`);
}

// ============================================
// group:list - 군이동 목록 조회
// ============================================

async function groupList(targetYear?: number) {
  log('\n🔀 군이동 목록', 'bright');
  log('─'.repeat(60));

  let sql = `
    SELECT gc.*, u.univ_name
    FROM group_changes gc
    JOIN universities u ON gc.univ_id = u.univ_id
  `;
  const params: any[] = [];

  if (targetYear) {
    sql += ' WHERE gc.to_year = ?';
    params.push(targetYear);
  }

  sql += ' ORDER BY gc.to_year DESC, u.univ_name';

  const changes = await query<{
    id: number;
    univ_name: string;
    dept_name: string;
    from_year: number;
    to_year: number;
    from_group: string;
    to_group: string;
    applied: number;
  }>(sql, params);

  if (changes.length === 0) {
    logInfo('등록된 군이동이 없습니다.');
    return;
  }

  for (const c of changes) {
    const appliedLabel = c.applied
      ? `${colors.green}[적용완료]${colors.reset}`
      : `${colors.yellow}[미적용]${colors.reset}`;
    console.log(
      `  ${c.to_year}학년도: ${c.univ_name} ${c.dept_name} - ${c.from_group}군 → ${c.to_group}군 ${appliedLabel}`
    );
  }

  log('─'.repeat(60));
}

// ============================================
// group:add - 군이동 등록
// ============================================

async function groupAdd() {
  log('\n➕ 군이동 등록', 'bright');
  log('─'.repeat(60));

  // 대학 선택
  const univName = await askQuestion('대학명: ');
  const univ = await queryOne<{ univ_id: number }>(
    'SELECT univ_id FROM universities WHERE univ_name LIKE ?',
    [`%${univName}%`]
  );

  if (!univ) {
    logError(`"${univName}" 대학을 찾을 수 없습니다.`);
    return;
  }

  const deptName = await askQuestion('학과명: ');
  const fromYear = parseInt(await askQuestion('이동 전 연도 (예: 2026): '));
  const toYear = parseInt(await askQuestion('이동 후 연도 (예: 2027): '));
  const fromGroup = await askQuestion('이동 전 군 (가/나/다): ');
  const toGroup = await askQuestion('이동 후 군 (가/나/다): ');

  if (!['가', '나', '다'].includes(fromGroup) || !['가', '나', '다'].includes(toGroup)) {
    logError('군은 가/나/다 중 하나여야 합니다.');
    return;
  }

  // 확인
  log('');
  log(`등록 정보:`);
  log(`  대학: ${univName}`);
  log(`  학과: ${deptName}`);
  log(`  변경: ${fromYear}학년도 ${fromGroup}군 → ${toYear}학년도 ${toGroup}군`);

  const proceed = await confirm('등록하시겠습니까?');
  if (!proceed) {
    logWarn('취소되었습니다.');
    return;
  }

  await pool.execute(
    `INSERT INTO group_changes (univ_id, dept_name, from_year, to_year, from_group, to_group)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [univ.univ_id, deptName, fromYear, toYear, fromGroup, toGroup]
  );

  logSuccess('군이동이 등록되었습니다.');
  logInfo(`적용하려면: npm run group:apply ${toYear}`);
}

// ============================================
// group:apply - 군이동 적용
// ============================================

async function groupApply(targetYear: number) {
  log(`\n🔄 ${targetYear}학년도 군이동 적용`, 'bright');
  log('─'.repeat(60));

  // 미적용 군이동 목록
  const changes = await query<{
    id: number;
    univ_id: number;
    dept_name: string;
    from_group: string;
    to_group: string;
  }>(
    `SELECT id, univ_id, dept_name, from_group, to_group
     FROM group_changes
     WHERE to_year = ? AND applied = FALSE`,
    [targetYear]
  );

  if (changes.length === 0) {
    logInfo(`${targetYear}학년도에 적용할 군이동이 없습니다.`);
    return;
  }

  logInfo(`${changes.length}개의 군이동을 적용합니다.`);

  const proceed = await confirm('진행하시겠습니까?');
  if (!proceed) {
    logWarn('취소되었습니다.');
    return;
  }

  let applied = 0;
  let failed = 0;

  for (const c of changes) {
    // 해당 학과 찾기
    const dept = await queryOne<{ dept_id: number }>(
      `SELECT dept_id FROM departments
       WHERE univ_id = ? AND year_id = ? AND dept_name = ? AND 모집군 = ?`,
      [c.univ_id, targetYear, c.dept_name, c.from_group]
    );

    if (!dept) {
      logWarn(`학과를 찾을 수 없음: ${c.dept_name} (${c.from_group}군)`);
      failed++;
      continue;
    }

    // 군 변경
    await pool.execute('UPDATE departments SET 모집군 = ? WHERE dept_id = ?', [
      c.to_group,
      dept.dept_id,
    ]);

    // 적용 완료 표시
    await pool.execute('UPDATE group_changes SET applied = TRUE WHERE id = ?', [c.id]);

    logSuccess(`${c.dept_name}: ${c.from_group}군 → ${c.to_group}군`);
    applied++;
  }

  log('─'.repeat(60));
  logInfo(`적용: ${applied}개, 실패: ${failed}개`);
}

// ============================================
// 메인
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    log('\n정시 연도 관리 CLI', 'bright');
    log('─'.repeat(60));
    log('');
    log('사용법:', 'cyan');
    log('  npm run year:list                  연도 목록 조회');
    log('  npm run year:create <연도>         새 연도 생성');
    log('  npm run year:activate <연도>       연도 활성화');
    log('  npm run year:delete <연도>         연도 삭제');
    log('');
    log('  npm run group:list [연도]          군이동 목록 조회');
    log('  npm run group:add                  군이동 등록');
    log('  npm run group:apply <연도>         군이동 적용');
    log('');
    await pool.end();
    return;
  }

  try {
    switch (command) {
      case 'year:list':
        await yearList();
        break;

      case 'year:create': {
        const year = parseInt(args[1]);
        if (isNaN(year)) {
          logError('연도를 입력해주세요. 예: npm run year:create 2027');
          break;
        }
        await yearCreate(year);
        break;
      }

      case 'year:activate': {
        const year = parseInt(args[1]);
        if (isNaN(year)) {
          logError('연도를 입력해주세요. 예: npm run year:activate 2027');
          break;
        }
        await yearActivate(year);
        break;
      }

      case 'year:delete': {
        const year = parseInt(args[1]);
        if (isNaN(year)) {
          logError('연도를 입력해주세요. 예: npm run year:delete 2027');
          break;
        }
        await yearDelete(year);
        break;
      }

      case 'group:list': {
        const year = args[1] ? parseInt(args[1]) : undefined;
        await groupList(year);
        break;
      }

      case 'group:add':
        await groupAdd();
        break;

      case 'group:apply': {
        const year = parseInt(args[1]);
        if (isNaN(year)) {
          logError('연도를 입력해주세요. 예: npm run group:apply 2027');
          break;
        }
        await groupApply(year);
        break;
      }

      default:
        logError(`알 수 없는 명령어: ${command}`);
        log('사용 가능한 명령어는 --help를 참조하세요.');
    }
  } catch (error) {
    logError('오류 발생');
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
