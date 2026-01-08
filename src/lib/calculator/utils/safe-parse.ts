/**
 * JSON 안전 파싱 유틸리티
 */

/**
 * JSON 문자열을 안전하게 파싱
 * @param value - 파싱할 값 (문자열 또는 이미 객체)
 * @param fallback - 파싱 실패 시 반환값
 */
export function safeParse<T>(value: unknown, fallback: T | null = null): T | null {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;

  try {
    return JSON.parse(value as string) as T;
  } catch {
    return fallback;
  }
}

/**
 * 숫자로 안전하게 변환
 * @param value - 변환할 값
 * @param fallback - 변환 실패 시 반환값
 */
export function safeNumber(value: unknown, fallback: number = 0): number {
  if (value == null) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * 정수로 안전하게 변환
 * @param value - 변환할 값
 * @param fallback - 변환 실패 시 반환값
 */
export function safeInt(value: unknown, fallback: number = 0): number {
  if (value == null) return fallback;
  const num = parseInt(String(value), 10);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * 문자열로 안전하게 변환
 * @param value - 변환할 값
 * @param fallback - 변환 실패 시 반환값
 */
export function safeString(value: unknown, fallback: string = ''): string {
  if (value == null) return fallback;
  return String(value);
}

/**
 * 배열인지 확인하고 반환
 * @param value - 확인할 값
 * @param fallback - 배열이 아닐 경우 반환값
 */
export function safeArray<T>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value : fallback;
}
