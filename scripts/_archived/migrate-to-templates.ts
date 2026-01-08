/**
 * cafe24 데이터를 템플릿 기반으로 변환하는 마이그레이션 스크립트
 *
 * 목표: 기존 특수공식/기본비율 → 템플릿 + 파라미터 형태로 변환
 */

import mysql from 'mysql2/promise';

const YEAR = 2026;

// cafe24 DB
const cafe24Pool = mysql.createPool({
  host: '211.37.174.218',
  user: 'maxilsan',
  password: 'q141171616!',
  database: 'jungsi',
  charset: 'utf8mb4',
});

// 로컬 DB
const localPool = mysql.createPool({
  host: 'localhost',
  user: 'paca',
  database: 'univjungsi',
  charset: 'utf8mb4',
});

// 템플릿 ID 매핑
const TEMPLATE_IDS = {
  basic_ratio: 1,
  top_n_select: 2,
  ranked_weights: 3,
  max_subject: 4,
  normalized: 5,
  weighted_std: 6,
  custom: 7,
};

interface CafeRow {
  U_ID: number;
  대학명: string;
  학과명: string;
  총점: number;
  수능: number;
  국어: string;
  수학: string;
  영어: string;
  탐구: string;
  탐구수: number;
  계산유형: string;
  특수공식: string | null;
  selection_rules: string | object | null;
  score_config: string | object | null;
}

/**
 * selection_rules 분석해서 적절한 템플릿 결정
 */
function detectTemplate(row: CafeRow): { templateId: number; params: object } {
  const selRules = typeof row.selection_rules === 'string'
    ? JSON.parse(row.selection_rules || '{}')
    : row.selection_rules || {};

  // 1. select_ranked_weights 패턴
  if (selRules?.type === 'select_ranked_weights') {
    return {
      templateId: TEMPLATE_IDS.ranked_weights,
      params: {
        선택대상: selRules.from || ['국어', '수학', '영어', '탐구'],
        가중치: selRules.weights || [0.5, 0.3, 0.2],
        점수유형: '백분위',
      },
    };
  }

  // 2. select_n 패턴
  if (selRules?.type === 'select_n') {
    return {
      templateId: TEMPLATE_IDS.top_n_select,
      params: {
        선택대상: selRules.from || ['국어', '수학', '영어', '탐구'],
        선택개수: selRules.count || 3,
        계산방식: '합계',
        배수: 1,
        기본점: 0,
      },
    };
  }

  // 3. 특수공식이면 custom
  if (row.계산유형 === '특수공식' && row.특수공식) {
    return {
      templateId: TEMPLATE_IDS.custom,
      params: {
        수식: row.특수공식,
        설명: `${row.대학명} ${row.학과명} 특수공식`,
      },
    };
  }

  // 4. 기본비율
  const parseRatio = (val: string | number) => {
    if (typeof val === 'number') return val;
    // "50/30/20" 형식 → 첫 번째 값 사용 (예체능 기준)
    const parts = String(val).split('/');
    return Number(parts[parts.length - 1]) || 0;
  };

  return {
    templateId: TEMPLATE_IDS.basic_ratio,
    params: {
      국어: parseRatio(row.국어),
      수학: parseRatio(row.수학),
      영어: parseRatio(row.영어),
      탐구: parseRatio(row.탐구),
      탐구수: row.탐구수 || 2,
      점수유형: detectScoreType(row),
    },
  };
}

/**
 * score_config에서 점수 유형 추출
 */
function detectScoreType(row: CafeRow): string {
  const cfg = typeof row.score_config === 'string'
    ? JSON.parse(row.score_config || '{}')
    : row.score_config || {};

  const kmType = cfg?.korean_math?.type;
  if (kmType === '표준점수') return '표준점수';
  if (kmType === '변환표준점수') return '변환표준점수';
  return '백분위';
}

/**
 * 표시용 설정 생성
 */
function createDisplayConfig(row: CafeRow): object {
  const parseRatioDisplay = (val: string | number): string | number => {
    if (typeof val === 'number') return val;
    // 슬래시 형식은 그대로 표시
    if (String(val).includes('/')) return val;
    return Number(val) || 0;
  };

  return {
    반영비율표시: {
      국어: parseRatioDisplay(row.국어),
      수학: parseRatioDisplay(row.수학),
      영어: parseRatioDisplay(row.영어),
      탐구: parseRatioDisplay(row.탐구),
    },
    점수유형표시: detectScoreType(row),
    총점: row.총점,
    수능반영비율: row.수능,
  };
}

async function main() {
  console.log('=== 템플릿 마이그레이션 시작 ===\n');

  // 1. cafe24에서 데이터 가져오기
  const [rows] = await cafe24Pool.execute<mysql.RowDataPacket[]>(`
    SELECT b.U_ID, b.대학명, b.학과명, r.*
    FROM 정시기본 b
    JOIN 정시반영비율 r ON b.U_ID = r.U_ID AND b.학년도 = r.학년도
    WHERE b.학년도 = ?
    ORDER BY b.U_ID
  `, [YEAR]);

  console.log(`총 ${rows.length}개 학과 처리 예정\n`);

  // 2. 템플릿 분류 통계
  const stats: Record<number, number> = {};
  const converted: Array<{
    U_ID: number;
    대학명: string;
    학과명: string;
    templateId: number;
    params: object;
    displayConfig: object;
  }> = [];

  for (const row of rows as CafeRow[]) {
    const { templateId, params } = detectTemplate(row);
    const displayConfig = createDisplayConfig(row);

    stats[templateId] = (stats[templateId] || 0) + 1;
    converted.push({
      U_ID: row.U_ID,
      대학명: row.대학명,
      학과명: row.학과명,
      templateId,
      params,
      displayConfig,
    });
  }

  // 3. 통계 출력
  console.log('=== 템플릿 분류 결과 ===');
  const templateNames: Record<number, string> = {
    1: 'basic_ratio (기본비율)',
    2: 'top_n_select (상위N개)',
    3: 'ranked_weights (가중치차등)',
    4: 'max_subject (국/수택1)',
    5: 'normalized (정규화)',
    6: 'weighted_std (가중표준점수)',
    7: 'custom (커스텀)',
  };

  for (const [tid, count] of Object.entries(stats).sort((a, b) => Number(b[1]) - Number(a[1]))) {
    console.log(`  ${templateNames[Number(tid)]}: ${count}개`);
  }

  // 4. 샘플 출력
  console.log('\n=== 변환 샘플 (각 템플릿별 1개) ===');
  const shown = new Set<number>();
  for (const item of converted) {
    if (shown.has(item.templateId)) continue;
    shown.add(item.templateId);

    console.log(`\n[${item.대학명} - ${item.학과명}]`);
    console.log(`템플릿: ${templateNames[item.templateId]}`);
    console.log(`파라미터:`, JSON.stringify(item.params, null, 2));
  }

  // 5. JSON 파일로 저장
  const { writeFileSync } = await import('fs');
  writeFileSync(
    './scripts/migration-preview.json',
    JSON.stringify(converted, null, 2),
    'utf8'
  );
  console.log('\n\n변환 결과 저장: ./scripts/migration-preview.json');

  await cafe24Pool.end();
  await localPool.end();

  console.log('\n=== 마이그레이션 프리뷰 완료 ===');
  console.log('실제 적용하려면: npm run migrate:apply');
}

main().catch(console.error);
