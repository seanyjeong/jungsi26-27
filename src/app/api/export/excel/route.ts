/**
 * GET /api/export/excel?year=2026
 * 연도별 데이터를 엑셀로 내보내기
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import * as XLSX from 'xlsx';

interface DeptRow {
  dept_id: number;
  univ_name: string;
  dept_name: string;
  모집군: string;
  모집인원: number;
  total_score: number;
  suneung_ratio: number;
  subjects_config: string | object | null;
  selection_rules: string | object | null;
  bonus_rules: string | object | null;
  legacy_formula: string | null;
  legacy_uid: number | null;
  english_scores: string | object | null;
  history_scores: string | object | null;
}

interface SubjectsConfig {
  korean?: { ratio?: number; source_type?: string };
  math?: { ratio?: number; source_type?: string };
  english?: { ratio?: number; source_type?: string };
  inquiry?: { ratio?: number; count?: number; source_type?: string };
  history?: { ratio?: number; mode?: string };
}

interface GradeRow {
  dept_id: number;
  grade: number;
  score: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || '2026');

  try {
    // 1. 기본정보 + 과목비율 + 등급표 조회
    const deptRows = await query(`
      SELECT
        d.dept_id, u.univ_name, d.dept_name, d.모집군, d.모집인원,
        f.total_score, f.suneung_ratio, f.subjects_config,
        f.selection_rules, f.bonus_rules, f.legacy_formula, f.legacy_uid,
        f.english_scores, f.history_scores
      FROM departments d
      JOIN universities u ON d.univ_id = u.univ_id
      JOIN formula_configs f ON d.dept_id = f.dept_id
      WHERE d.year_id = ?
      ORDER BY u.univ_name, d.dept_name
    `, [year]) as DeptRow[];

    // 2. 영어 등급표 (formula_configs.english_scores JSON에서 추출)
    const engByDept = deptRows
      .filter(row => row.english_scores)
      .map(row => {
        const scores = parseJson(row.english_scores);
        return {
          'dept_id': row.dept_id,
          '대학명': row.univ_name,
          '학과명': row.dept_name,
          '1등급': scores['1'] ?? null,
          '2등급': scores['2'] ?? null,
          '3등급': scores['3'] ?? null,
          '4등급': scores['4'] ?? null,
          '5등급': scores['5'] ?? null,
          '6등급': scores['6'] ?? null,
          '7등급': scores['7'] ?? null,
          '8등급': scores['8'] ?? null,
          '9등급': scores['9'] ?? null,
        };
      });

    // 3. 한국사 등급표 (formula_configs.history_scores JSON에서 추출)
    const histByDept = deptRows
      .filter(row => row.history_scores)
      .map(row => {
        const scores = parseJson(row.history_scores);
        return {
          'dept_id': row.dept_id,
          '대학명': row.univ_name,
          '학과명': row.dept_name,
          '1등급': scores['1'] ?? null,
          '2등급': scores['2'] ?? null,
          '3등급': scores['3'] ?? null,
          '4등급': scores['4'] ?? null,
          '5등급': scores['5'] ?? null,
          '6등급': scores['6'] ?? null,
          '7등급': scores['7'] ?? null,
          '8등급': scores['8'] ?? null,
          '9등급': scores['9'] ?? null,
        };
      });

    // 4. 실기 배점 조회
    const practRows = await query(`
      SELECT p.dept_id, u.univ_name, d.dept_name,
             p.종목명, p.성별, p.기록, p.점수
      FROM practical_score_tables p
      JOIN departments d ON p.dept_id = d.dept_id
      JOIN universities u ON d.univ_id = u.univ_id
      WHERE d.year_id = ?
      ORDER BY u.univ_name, d.dept_name, p.종목명, p.성별
    `, [year]);

    // 시트 1: 기본정보 + 과목비율 (JSON 펼침)
    // 학과명, 모집군, 모집인원 수정 가능 / 삭제 컬럼으로 삭제 표시
    const sheet1Data = deptRows.map(row => {
      const config = parseConfig(row.subjects_config);
      return {
        'dept_id': row.dept_id,
        '대학명': row.univ_name,
        '학과명': row.dept_name,          // 수정 가능
        '모집군': row.모집군,              // 수정 가능
        '모집인원': row.모집인원,          // 수정 가능
        '삭제': '',                        // 'Y' 입력 시 삭제
        '총점': row.total_score,
        '수능비율': row.suneung_ratio,
        '국어비율': config.korean?.ratio ?? 0,
        '국어유형': config.korean?.source_type ?? 'pct',
        '수학비율': config.math?.ratio ?? 0,
        '수학유형': config.math?.source_type ?? 'pct',
        '영어비율': config.english?.ratio ?? 0,
        '영어유형': config.english?.source_type ?? 'grade_conv',
        '탐구비율': config.inquiry?.ratio ?? 0,
        '탐구개수': config.inquiry?.count ?? 2,
        '탐구유형': config.inquiry?.source_type ?? 'pct',
        '한국사비율': config.history?.ratio ?? 0,
        '한국사모드': config.history?.mode ?? 'bonus',
        'legacy_uid': row.legacy_uid,
      };
    });

    // 시트 2: 특수공식 (legacy_formula 있는 것만)
    const sheet2Data = deptRows
      .filter(row => row.legacy_formula)
      .map(row => ({
        'dept_id': row.dept_id,
        '대학명': row.univ_name,
        '학과명': row.dept_name,
        '특수공식': row.legacy_formula,
        'legacy_uid': row.legacy_uid,
      }));

    // 시트 3: 영어 등급표 (pivot된 데이터)
    const sheet3Data = engByDept;

    // 시트 4: 한국사 등급표 (pivot된 데이터)
    const sheet4Data = histByDept;

    // 시트 5: 실기 배점
    const sheet5Data = (practRows as Record<string, unknown>[]).map(row => ({
      'dept_id': row.dept_id,
      '대학명': row.univ_name,
      '학과명': row.dept_name,
      '종목명': row.종목명,
      '성별': row.성별,
      '기록': row.기록,
      '점수': row.점수,
    }));

    // 엑셀 워크북 생성
    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(wb, ws1, '기본정보_과목비율');

    if (sheet2Data.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
      XLSX.utils.book_append_sheet(wb, ws2, '특수공식');
    }

    if (sheet3Data.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(sheet3Data);
      XLSX.utils.book_append_sheet(wb, ws3, '영어등급표');
    }

    if (sheet4Data.length > 0) {
      const ws4 = XLSX.utils.json_to_sheet(sheet4Data);
      XLSX.utils.book_append_sheet(wb, ws4, '한국사등급표');
    }

    if (sheet5Data.length > 0) {
      const ws5 = XLSX.utils.json_to_sheet(sheet5Data);
      XLSX.utils.book_append_sheet(wb, ws5, '실기배점');
    }

    // 엑셀 파일 생성
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 한글 파일명 인코딩
    const filename = `${year}학년도_정시데이터.xlsx`;
    const encodedFilename = encodeURIComponent(filename);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
      },
    });

  } catch (error) {
    console.error('Export excel error:', error);
    return NextResponse.json(
      { error: '엑셀 내보내기 중 오류가 발생했습니다.', details: String(error) },
      { status: 500 }
    );
  }
}

function parseConfig(config: string | object | null): SubjectsConfig {
  if (!config) return {};
  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  }
  return config as SubjectsConfig;
}

function parseJson(data: string | object | null): Record<string, number> {
  if (!data) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return data as Record<string, number>;
}

/**
 * 행 단위 등급 데이터를 dept_id별로 pivot
 */
function pivotGrades(
  rows: GradeRow[],
  deptMap: Map<number, { univ_name: string; dept_name: string }>
): Record<string, unknown>[] {
  const byDept = new Map<number, Record<string, unknown>>();

  for (const row of rows) {
    if (!byDept.has(row.dept_id)) {
      const info = deptMap.get(row.dept_id);
      byDept.set(row.dept_id, {
        'dept_id': row.dept_id,
        '대학명': info?.univ_name ?? '',
        '학과명': info?.dept_name ?? '',
        '1등급': null,
        '2등급': null,
        '3등급': null,
        '4등급': null,
        '5등급': null,
        '6등급': null,
        '7등급': null,
        '8등급': null,
        '9등급': null,
      });
    }
    const entry = byDept.get(row.dept_id)!;
    entry[`${row.grade}등급`] = row.score;
  }

  return Array.from(byDept.values());
}
