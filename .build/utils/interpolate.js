"use strict";
/**
 * 보간(Interpolation) 유틸리티
 *
 * 원점수 → 표준점수/백분위 변환 등에 사용
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpolateScore = interpolateScore;
exports.mapPercentileToConverted = mapPercentileToConverted;
exports.getEnglishGrade = getEnglishGrade;
exports.getHistoryGrade = getHistoryGrade;
/**
 * 원점수에 해당하는 예상 표준점수와 백분위를 선형 보간법으로 계산
 *
 * @param rawScore - 학생의 원점수
 * @param gradeCutTable - 등급컷 테이블 (DB에서 가져온 것)
 * @returns 예상 표준점수, 백분위, 등급
 */
function interpolateScore(rawScore, gradeCutTable) {
    // 1. 유효성 검사 및 테이블 정렬 (원점수 내림차순)
    if (!gradeCutTable || gradeCutTable.length === 0) {
        return { std: 0, pct: 0, grade: 9 };
    }
    const sortedCuts = [...gradeCutTable]
        .map((c) => ({
        raw: Number(c.원점수 ?? 0),
        std: Number(c.표준점수 ?? 0),
        pct: Number(c.백분위 ?? 0),
        grade: Number(c.등급 ?? 9),
    }))
        .filter((c) => !Number.isNaN(c.raw))
        .sort((a, b) => b.raw - a.raw);
    if (sortedCuts.length === 0) {
        return { std: 0, pct: 0, grade: 9 };
    }
    // 2. 엣지 케이스 처리 (최고점, 최저점)
    const maxScore = sortedCuts[0];
    const minScore = sortedCuts[sortedCuts.length - 1];
    if (rawScore >= maxScore.raw) {
        return { std: maxScore.std, pct: maxScore.pct, grade: maxScore.grade };
    }
    if (rawScore <= minScore.raw) {
        return { std: minScore.std, pct: minScore.pct, grade: minScore.grade };
    }
    // 3. '샌드위치' 구간 찾기
    let upper = maxScore;
    let lower = maxScore;
    for (let i = 1; i < sortedCuts.length; i++) {
        if (sortedCuts[i].raw === rawScore) {
            // 컷 점수와 정확히 일치하는 경우
            const exactCut = sortedCuts[i];
            return { std: exactCut.std, pct: exactCut.pct, grade: exactCut.grade };
        }
        if (sortedCuts[i].raw < rawScore) {
            upper = sortedCuts[i - 1];
            lower = sortedCuts[i];
            break;
        }
    }
    // 4. 선형 보간법 (Linear Interpolation) 계산
    const rawRange = upper.raw - lower.raw;
    const rawOffset = rawScore - lower.raw;
    // 분모가 0이 되는 것 방지
    if (rawRange === 0) {
        return { std: lower.std, pct: lower.pct, grade: lower.grade };
    }
    const position = rawOffset / rawRange;
    const stdRange = upper.std - lower.std;
    const pctRange = upper.pct - lower.pct;
    const estimatedStd = lower.std + stdRange * position;
    const estimatedPct = lower.pct + pctRange * position;
    // 5. 최종 반올림 (정수) 및 등급 반환
    return {
        std: Math.round(estimatedStd),
        pct: Math.round(estimatedPct),
        grade: lower.grade, // 등급은 아래쪽(lower) 컷을 따라감
    };
}
/**
 * 백분위 → 변환표준점수 매핑 (탐구 변환표용)
 *
 * @param convMap - 백분위 → 변환표준점수 맵
 * @param percentile - 학생 백분위
 * @returns 변환표준점수 (없으면 null)
 */
function mapPercentileToConverted(convMap, percentile) {
    const pct = Math.max(0, Math.min(100, Math.round(Number(percentile) || 0)));
    if (!convMap)
        return null;
    // 정확히 일치하는 키가 있으면 반환
    if (convMap[String(pct)] != null) {
        return Number(convMap[String(pct)]);
    }
    // 보간 필요
    const keys = Object.keys(convMap)
        .map((k) => parseInt(k, 10))
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => a - b);
    if (!keys.length)
        return null;
    // 범위 밖
    if (pct <= keys[0])
        return Number(convMap[String(keys[0])]);
    if (pct >= keys[keys.length - 1])
        return Number(convMap[String(keys[keys.length - 1])]);
    // 구간 찾기
    let lo = keys[0];
    let hi = keys[keys.length - 1];
    for (let i = 1; i < keys.length; i++) {
        if (keys[i] >= pct) {
            hi = keys[i];
            lo = keys[i - 1];
            break;
        }
    }
    // 선형 보간
    const y1 = Number(convMap[String(lo)]);
    const y2 = Number(convMap[String(hi)]);
    const t = (pct - lo) / (hi - lo);
    return y1 + (y2 - y1) * t;
}
/**
 * [절대평가] 영어 원점수 -> 등급
 */
function getEnglishGrade(rawScore) {
    const score = Number(rawScore);
    if (score >= 90)
        return 1;
    if (score >= 80)
        return 2;
    if (score >= 70)
        return 3;
    if (score >= 60)
        return 4;
    if (score >= 50)
        return 5;
    if (score >= 40)
        return 6;
    if (score >= 30)
        return 7;
    if (score >= 20)
        return 8;
    return 9;
}
/**
 * [절대평가] 한국사 원점수 -> 등급
 */
function getHistoryGrade(rawScore) {
    const score = Number(rawScore);
    if (score >= 40)
        return 1;
    if (score >= 35)
        return 2;
    if (score >= 30)
        return 3;
    if (score >= 25)
        return 4;
    if (score >= 20)
        return 5;
    if (score >= 15)
        return 6;
    if (score >= 10)
        return 7;
    if (score >= 5)
        return 8;
    return 9;
}
