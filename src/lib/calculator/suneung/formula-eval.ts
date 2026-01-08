/**
 * 특수공식 평가 모듈
 *
 * 문자열 형태의 수학 공식을 컨텍스트 변수로 치환 후 계산
 */

import type { SpecialFormulaContext } from '../types';

/**
 * 특수공식 문자열을 평가
 *
 * @param formulaText - 공식 문자열 (예: "{kor_std} * {ratio_kor_norm} + {math_std} * {ratio_math_norm}")
 * @param ctx - 변수 컨텍스트
 * @param log - 로그 배열 (변수 치환 내역 기록)
 * @returns 계산 결과 (숫자)
 * @throws 허용되지 않은 토큰 포함 시 에러
 */
export function evaluateSpecialFormula(
  formulaText: string | null | undefined,
  ctx: SpecialFormulaContext,
  log: string[]
): number {
  // 변수 치환: {변수명} → 숫자
  const replaced = String(formulaText || '').replace(
    /\{([a-z0-9_]+)\}/gi,
    (_, k: string) => {
      const v = Number(ctx[k] ?? 0);
      const safeVal = isFinite(v) ? v : 0;
      log.push(`[특수공식 변수] ${k} = ${safeVal}`);
      return String(safeVal);
    }
  );

  // 허용된 토큰만 포함하는지 검증 (숫자, 연산자, 괄호, 공백)
  if (!/^[0-9+\-*/().\s]+$/.test(replaced)) {
    throw new Error('특수공식에 허용되지 않은 토큰이 포함되어 있습니다.');
  }

  // 수식 평가 (안전한 범위 내에서만)
  // eslint-disable-next-line no-new-func
  const val = Function(`"use strict"; return (${replaced});`)();
  return Number(val) || 0;
}

/**
 * 특수공식 문자열 유효성 검사 (드라이런)
 *
 * @param formulaText - 검사할 공식 문자열
 * @returns 유효 여부와 에러 메시지
 */
export function validateSpecialFormula(
  formulaText: string | null | undefined
): { valid: boolean; error?: string } {
  if (!formulaText || typeof formulaText !== 'string') {
    return { valid: false, error: '공식이 비어있습니다.' };
  }

  // 변수를 더미값으로 치환
  const replaced = formulaText.replace(/\{([a-z0-9_]+)\}/gi, '1');

  if (!/^[0-9+\-*/().\s]+$/.test(replaced)) {
    return { valid: false, error: '허용되지 않은 토큰이 포함되어 있습니다.' };
  }

  try {
    // eslint-disable-next-line no-new-func
    Function(`"use strict"; return (${replaced});`)();
    return { valid: true };
  } catch (e) {
    return { valid: false, error: `수식 구문 오류: ${(e as Error).message}` };
  }
}

/**
 * 공식에서 사용되는 변수 목록 추출
 *
 * @param formulaText - 공식 문자열
 * @returns 변수명 배열
 */
export function extractFormulaVariables(formulaText: string | null | undefined): string[] {
  if (!formulaText) return [];

  const matches = formulaText.match(/\{([a-z0-9_]+)\}/gi);
  if (!matches) return [];

  // 중괄호 제거하고 고유한 변수명만 반환
  const vars = matches.map((m) => m.replace(/[{}]/g, ''));
  return Array.from(new Set(vars));
}
