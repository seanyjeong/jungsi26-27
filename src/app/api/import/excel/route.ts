/**
 * POST /api/import/excel
 * 엑셀 파일로 데이터 업로드 (27학년도 등)
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import * as XLSX from 'xlsx';

interface ValidationError {
  sheet: string;
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  success: boolean;
  summary: {
    기본정보: { updated: number; inserted: number; deleted: number };
    특수공식: { updated: number };
    영어등급표: { updated: number; inserted: number };
    한국사등급표: { updated: number; inserted: number };
    실기배점: { updated: number; inserted: number; deleted: number };
  };
  errors: ValidationError[];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const yearId = parseInt(formData.get('year') as string || '2027');
    const dryRun = formData.get('dryRun') === 'true';
    const changedBy = formData.get('changedBy') as string || 'system';

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    // 엑셀 파일 읽기
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    const errors: ValidationError[] = [];
    const result: ImportResult = {
      success: true,
      summary: {
        기본정보: { updated: 0, inserted: 0, deleted: 0 },
        특수공식: { updated: 0 },
        영어등급표: { updated: 0, inserted: 0 },
        한국사등급표: { updated: 0, inserted: 0 },
        실기배점: { updated: 0, inserted: 0, deleted: 0 },
      },
      errors: [],
    };

    // 1. 기본정보_과목비율 시트 처리
    const sheet1 = wb.Sheets['기본정보_과목비율'];
    if (sheet1) {
      const data = XLSX.utils.sheet_to_json(sheet1) as Record<string, unknown>[];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2; // 헤더 제외

        // 검증
        const validationErrors = validateBasicInfo(row, rowNum);
        errors.push(...validationErrors);

        if (validationErrors.length === 0 && !dryRun) {
          await updateBasicInfo(row, yearId, changedBy, result);
        }
      }
    }

    // 2. 특수공식 시트 처리
    const sheet2 = wb.Sheets['특수공식'];
    if (sheet2) {
      const data = XLSX.utils.sheet_to_json(sheet2) as Record<string, unknown>[];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const deptId = row['dept_id'] as number;

        if (deptId && !dryRun) {
          await updateSpecialFormula(deptId, row['특수공식'] as string, changedBy, result);
        }
      }
    }

    // 3. 영어등급표 시트 처리
    const sheet3 = wb.Sheets['영어등급표'];
    if (sheet3) {
      const data = XLSX.utils.sheet_to_json(sheet3) as Record<string, unknown>[];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2;

        const validationErrors = validateGradeTable(row, rowNum, '영어등급표');
        errors.push(...validationErrors);

        if (validationErrors.length === 0 && !dryRun) {
          await updateEnglishGrades(row, changedBy, result);
        }
      }
    }

    // 4. 한국사등급표 시트 처리
    const sheet4 = wb.Sheets['한국사등급표'];
    if (sheet4) {
      const data = XLSX.utils.sheet_to_json(sheet4) as Record<string, unknown>[];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2;

        const validationErrors = validateGradeTable(row, rowNum, '한국사등급표');
        errors.push(...validationErrors);

        if (validationErrors.length === 0 && !dryRun) {
          await updateHistoryGrades(row, changedBy, result);
        }
      }
    }

    // 5. 실기배점 시트 처리
    const sheet5 = wb.Sheets['실기배점'];
    if (sheet5) {
      const data = XLSX.utils.sheet_to_json(sheet5) as Record<string, unknown>[];

      if (!dryRun) {
        await updatePracticalScores(data, changedBy, result);
      }
    }

    result.errors = errors;
    result.success = errors.length === 0;

    return NextResponse.json({
      ...result,
      dryRun,
      message: dryRun
        ? '검증 완료 (실제 저장되지 않음)'
        : errors.length === 0
          ? '업로드 완료'
          : '일부 오류 발생',
    });

  } catch (error) {
    console.error('Import excel error:', error);
    return NextResponse.json(
      { error: '엑셀 업로드 중 오류가 발생했습니다.', details: String(error) },
      { status: 500 }
    );
  }
}

// 검증 함수들
function validateBasicInfo(row: Record<string, unknown>, rowNum: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // dept_id가 없으면 신규 학과 - 대학명+학과명 필수
  if (!row['dept_id']) {
    if (!row['대학명'] || !row['학과명']) {
      errors.push({ sheet: '기본정보_과목비율', row: rowNum, field: 'dept_id/대학명/학과명', message: 'dept_id 또는 대학명+학과명 필수' });
    }
  }

  const ratios = ['국어비율', '수학비율', '영어비율', '탐구비율', '한국사비율'];
  for (const field of ratios) {
    const val = row[field] as number;
    if (val !== undefined && (val < 0 || val > 100)) {
      errors.push({ sheet: '기본정보_과목비율', row: rowNum, field, message: '0~100 사이여야 함' });
    }
  }

  // 비율 합계 검증 - 특수공식이나 가산점 모드가 있으면 100% 아닐 수 있음
  // 경고만 로그하고 오류로 처리하지 않음
  // const histMode = row['한국사모드'] as string;
  // const totalRatio = (row['국어비율'] as number || 0) +
  //                    (row['수학비율'] as number || 0) +
  //                    (row['영어비율'] as number || 0) +
  //                    (row['탐구비율'] as number || 0) +
  //                    (histMode !== 'bonus' ? (row['한국사비율'] as number || 0) : 0);
  // Note: 비율 합계 검증은 특수공식, 영어 가산점, 한국사 가산점 등으로 인해
  // 100%가 아닌 경우가 많아 오류로 처리하지 않음

  return errors;
}

function validateGradeTable(row: Record<string, unknown>, rowNum: number, sheet: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!row['dept_id']) {
    errors.push({ sheet, row: rowNum, field: 'dept_id', message: 'dept_id 필수' });
  }

  // 등급별 점수가 내림차순인지 검증 - 숫자값만 체크
  const grades: number[] = [];
  for (let i = 1; i <= 9; i++) {
    const val = row[`${i}등급`];
    if (typeof val === 'number' && !isNaN(val)) {
      grades.push(val);
    }
  }

  // 최소 2개 이상 등급이 있어야 검증
  if (grades.length >= 2) {
    for (let i = 1; i < grades.length; i++) {
      if (grades[i] > grades[i - 1]) {
        // 경고만 로그하고 오류로 처리하지 않음 (일부 대학은 특수 방식 사용)
        console.warn(`[${sheet}] row ${rowNum}: 등급 순서 경고 - 값들: ${grades.join(', ')}`);
        break;
      }
    }
  }

  return errors;
}

// 업데이트 함수들
async function updateBasicInfo(
  row: Record<string, unknown>,
  yearId: number,
  changedBy: string,
  result: ImportResult
) {
  const deptId = row['dept_id'] as number | undefined;
  const univName = row['대학명'] as string;
  const deptName = row['학과명'] as string;
  const deleteFlag = String(row['삭제'] || '').toUpperCase() === 'Y';

  // 1. 삭제 처리
  if (deleteFlag && deptId) {
    // departments와 formula_configs 삭제 (실기배점도 cascade 또는 별도 삭제)
    const existingDept = await query(
      'SELECT * FROM departments WHERE dept_id = ?',
      [deptId]
    ) as Record<string, unknown>[];

    if (existingDept.length > 0) {
      // 변경 이력 저장
      await query(`
        INSERT INTO change_logs (table_name, record_id, action, old_values, new_values, changed_by)
        VALUES ('departments', ?, 'DELETE', ?, NULL, ?)
      `, [deptId, JSON.stringify(existingDept[0]), changedBy]);

      // 관련 데이터 삭제 (실기배점, formula_configs)
      await query('DELETE FROM practical_score_tables WHERE dept_id = ?', [deptId]);
      await query('DELETE FROM formula_configs WHERE dept_id = ?', [deptId]);
      await query('DELETE FROM departments WHERE dept_id = ?', [deptId]);

      result.summary.기본정보.deleted++;
    }
    return;
  }

  // 2. 신규 학과 추가 (dept_id가 없는 경우)
  if (!deptId && univName && deptName) {
    // 대학 ID 조회
    const univRows = await query(
      'SELECT univ_id FROM universities WHERE univ_name = ?',
      [univName]
    ) as { univ_id: number }[];

    if (univRows.length === 0) {
      console.warn(`대학 없음: ${univName}`);
      return;
    }

    const univId = univRows[0].univ_id;

    // 새 학과 INSERT
    const insertResult = await query(`
      INSERT INTO departments (univ_id, year_id, dept_name, 모집군, 모집인원)
      VALUES (?, ?, ?, ?, ?)
    `, [univId, yearId, deptName, row['모집군'] || '가', row['모집인원'] || 0]) as unknown as { insertId: number };

    const newDeptId = insertResult.insertId;

    // formula_configs도 INSERT
    const subjectsConfig = buildSubjectsConfig(row);
    await query(`
      INSERT INTO formula_configs (dept_id, total_score, suneung_ratio, subjects_config)
      VALUES (?, ?, ?, ?)
    `, [newDeptId, row['총점'] || 1000, row['수능비율'] || 100, JSON.stringify(subjectsConfig)]);

    // 변경 이력
    await query(`
      INSERT INTO change_logs (table_name, record_id, action, old_values, new_values, changed_by)
      VALUES ('departments', ?, 'INSERT', NULL, ?, ?)
    `, [newDeptId, JSON.stringify({ univ_name: univName, dept_name: deptName, ...row }), changedBy]);

    result.summary.기본정보.inserted++;
    return;
  }

  // 3. 기존 학과 업데이트
  if (!deptId) return;

  // 학과 정보 업데이트 (학과명, 모집군, 모집인원)
  const existingDept = await query(
    'SELECT * FROM departments WHERE dept_id = ?',
    [deptId]
  ) as Record<string, unknown>[];

  if (existingDept.length > 0) {
    const oldDept = existingDept[0];
    const deptChanged =
      oldDept['dept_name'] !== deptName ||
      oldDept['모집군'] !== row['모집군'] ||
      oldDept['모집인원'] !== row['모집인원'];

    if (deptChanged) {
      await query(`
        INSERT INTO change_logs (table_name, record_id, action, old_values, new_values, changed_by)
        VALUES ('departments', ?, 'UPDATE', ?, ?, ?)
      `, [deptId, JSON.stringify({
        dept_name: oldDept['dept_name'],
        모집군: oldDept['모집군'],
        모집인원: oldDept['모집인원']
      }), JSON.stringify({
        dept_name: deptName,
        모집군: row['모집군'],
        모집인원: row['모집인원']
      }), changedBy]);

      await query(`
        UPDATE departments
        SET dept_name = ?, 모집군 = ?, 모집인원 = ?
        WHERE dept_id = ?
      `, [deptName, row['모집군'], row['모집인원'], deptId]);
    }
  }

  // formula_configs 업데이트
  const existing = await query(
    'SELECT * FROM formula_configs WHERE dept_id = ?',
    [deptId]
  );

  const subjectsConfig = buildSubjectsConfig(row);

  if ((existing as unknown[]).length > 0) {
    await query(`
      INSERT INTO change_logs (table_name, record_id, action, old_values, new_values, changed_by)
      VALUES ('formula_configs', ?, 'UPDATE', ?, ?, ?)
    `, [deptId, JSON.stringify((existing as unknown[])[0]), JSON.stringify(row), changedBy]);

    await query(`
      UPDATE formula_configs
      SET total_score = ?, suneung_ratio = ?, subjects_config = ?
      WHERE dept_id = ?
    `, [row['총점'], row['수능비율'], JSON.stringify(subjectsConfig), deptId]);

    result.summary.기본정보.updated++;
  } else {
    // formula_configs가 없으면 INSERT
    await query(`
      INSERT INTO formula_configs (dept_id, total_score, suneung_ratio, subjects_config)
      VALUES (?, ?, ?, ?)
    `, [deptId, row['총점'] || 1000, row['수능비율'] || 100, JSON.stringify(subjectsConfig)]);

    result.summary.기본정보.inserted++;
  }
}

function buildSubjectsConfig(row: Record<string, unknown>) {
  return {
    korean: { ratio: row['국어비율'] || 0, source_type: row['국어유형'] || 'pct' },
    math: { ratio: row['수학비율'] || 0, source_type: row['수학유형'] || 'pct' },
    english: { ratio: row['영어비율'] || 0, source_type: row['영어유형'] || 'grade_conv' },
    inquiry: {
      ratio: row['탐구비율'] || 0,
      count: row['탐구개수'] || 2,
      source_type: row['탐구유형'] || 'pct'
    },
    history: { ratio: row['한국사비율'] || 0, mode: row['한국사모드'] || 'bonus' },
  };
}

async function updateSpecialFormula(
  deptId: number,
  formula: string,
  changedBy: string,
  result: ImportResult
) {
  // 기존 값 조회
  const existing = await query(
    'SELECT legacy_formula FROM formula_configs WHERE dept_id = ?',
    [deptId]
  );

  if (existing.length > 0) {
    const oldFormula = (existing[0] as Record<string, unknown>).legacy_formula;

    if (oldFormula !== formula) {
      await query(`
        INSERT INTO change_logs (table_name, record_id, action, old_values, new_values, changed_by)
        VALUES ('formula_configs', ?, 'UPDATE', ?, ?, ?)
      `, [deptId, JSON.stringify({ legacy_formula: oldFormula }), JSON.stringify({ legacy_formula: formula }), changedBy]);

      await query(
        'UPDATE formula_configs SET legacy_formula = ? WHERE dept_id = ?',
        [formula, deptId]
      );

      result.summary.특수공식.updated++;
    }
  }
}

async function updateEnglishGrades(
  row: Record<string, unknown>,
  changedBy: string,
  result: ImportResult
) {
  const deptId = row['dept_id'] as number;

  // formula_configs.english_scores JSON 필드로 저장
  const existing = await query(
    'SELECT english_scores FROM formula_configs WHERE dept_id = ?',
    [deptId]
  ) as { english_scores: string | object | null }[];

  const grades: Record<string, number | null> = {
    '1': row['1등급'] as number ?? null,
    '2': row['2등급'] as number ?? null,
    '3': row['3등급'] as number ?? null,
    '4': row['4등급'] as number ?? null,
    '5': row['5등급'] as number ?? null,
    '6': row['6등급'] as number ?? null,
    '7': row['7등급'] as number ?? null,
    '8': row['8등급'] as number ?? null,
    '9': row['9등급'] as number ?? null,
  };

  if (existing.length > 0) {
    const oldScores = existing[0].english_scores;

    await query(`
      INSERT INTO change_logs (table_name, record_id, action, old_values, new_values, changed_by)
      VALUES ('formula_configs', ?, 'UPDATE', ?, ?, ?)
    `, [deptId, JSON.stringify({ english_scores: oldScores }), JSON.stringify({ english_scores: grades }), changedBy]);

    await query(
      'UPDATE formula_configs SET english_scores = ? WHERE dept_id = ?',
      [JSON.stringify(grades), deptId]
    );

    result.summary.영어등급표.updated++;
  } else {
    // formula_configs가 없으면 영어등급만 추가할 수 없음
    console.warn(`dept_id ${deptId}: formula_configs 없음, 영어등급표 건너뜀`);
  }
}

async function updateHistoryGrades(
  row: Record<string, unknown>,
  changedBy: string,
  result: ImportResult
) {
  const deptId = row['dept_id'] as number;

  // formula_configs.history_scores JSON 필드로 저장
  const existing = await query(
    'SELECT history_scores FROM formula_configs WHERE dept_id = ?',
    [deptId]
  ) as { history_scores: string | object | null }[];

  const grades: Record<string, number | null> = {
    '1': row['1등급'] as number ?? null,
    '2': row['2등급'] as number ?? null,
    '3': row['3등급'] as number ?? null,
    '4': row['4등급'] as number ?? null,
    '5': row['5등급'] as number ?? null,
    '6': row['6등급'] as number ?? null,
    '7': row['7등급'] as number ?? null,
    '8': row['8등급'] as number ?? null,
    '9': row['9등급'] as number ?? null,
  };

  if (existing.length > 0) {
    const oldScores = existing[0].history_scores;

    await query(`
      INSERT INTO change_logs (table_name, record_id, action, old_values, new_values, changed_by)
      VALUES ('formula_configs', ?, 'UPDATE', ?, ?, ?)
    `, [deptId, JSON.stringify({ history_scores: oldScores }), JSON.stringify({ history_scores: grades }), changedBy]);

    await query(
      'UPDATE formula_configs SET history_scores = ? WHERE dept_id = ?',
      [JSON.stringify(grades), deptId]
    );

    result.summary.한국사등급표.updated++;
  } else {
    // formula_configs가 없으면 한국사등급만 추가할 수 없음
    console.warn(`dept_id ${deptId}: formula_configs 없음, 한국사등급표 건너뜀`);
  }
}

async function updatePracticalScores(
  data: Record<string, unknown>[],
  changedBy: string,
  result: ImportResult
) {
  // dept_id별로 그룹화
  const byDept = new Map<number, Record<string, unknown>[]>();
  for (const row of data) {
    const deptId = row['dept_id'] as number;
    if (!byDept.has(deptId)) byDept.set(deptId, []);
    byDept.get(deptId)!.push(row);
  }

  for (const [deptId, rows] of byDept) {
    // 기존 데이터 삭제 후 새로 삽입 (전체 교체)
    const existing = await query(
      'SELECT * FROM practical_score_tables WHERE dept_id = ?',
      [deptId]
    );

    if (existing.length > 0) {
      await query(`
        INSERT INTO change_logs (table_name, record_id, action, old_values, new_values, changed_by)
        VALUES ('practical_score_tables', ?, 'UPDATE', ?, ?, ?)
      `, [deptId, JSON.stringify(existing), JSON.stringify(rows), changedBy]);

      await query('DELETE FROM practical_score_tables WHERE dept_id = ?', [deptId]);
      result.summary.실기배점.deleted += existing.length;
    }

    for (const row of rows) {
      await query(`
        INSERT INTO practical_score_tables (dept_id, 종목명, 성별, 기록, 점수)
        VALUES (?, ?, ?, ?, ?)
      `, [deptId, row['종목명'], row['성별'], row['기록'], row['점수']]);
      result.summary.실기배점.inserted++;
    }
  }
}
