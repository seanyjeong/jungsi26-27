"use strict";
/**
 * JSON 안전 파싱 유틸리티
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeParse = safeParse;
exports.safeNumber = safeNumber;
exports.safeInt = safeInt;
exports.safeString = safeString;
exports.safeArray = safeArray;
/**
 * JSON 문자열을 안전하게 파싱
 * @param value - 파싱할 값 (문자열 또는 이미 객체)
 * @param fallback - 파싱 실패 시 반환값
 */
function safeParse(value, fallback = null) {
    if (value == null)
        return fallback;
    if (typeof value === 'object')
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
/**
 * 숫자로 안전하게 변환
 * @param value - 변환할 값
 * @param fallback - 변환 실패 시 반환값
 */
function safeNumber(value, fallback = 0) {
    if (value == null)
        return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}
/**
 * 정수로 안전하게 변환
 * @param value - 변환할 값
 * @param fallback - 변환 실패 시 반환값
 */
function safeInt(value, fallback = 0) {
    if (value == null)
        return fallback;
    const num = parseInt(String(value), 10);
    return Number.isFinite(num) ? num : fallback;
}
/**
 * 문자열로 안전하게 변환
 * @param value - 변환할 값
 * @param fallback - 변환 실패 시 반환값
 */
function safeString(value, fallback = '') {
    if (value == null)
        return fallback;
    return String(value);
}
/**
 * 배열인지 확인하고 반환
 * @param value - 확인할 값
 * @param fallback - 배열이 아닐 경우 반환값
 */
function safeArray(value, fallback = []) {
    return Array.isArray(value) ? value : fallback;
}
