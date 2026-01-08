"use strict";
/**
 * 실기 특수 규칙 계산 모듈
 *
 * U_ID 기반 하드코딩된 특수 대학 계산식
 * (향후 DB 규칙 엔진으로 마이그레이션 예정)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcPracticalSpecial = calcPracticalSpecial;
/** 상위 N개 종목 환산 */
function practicalTopN(list, n, maxScore) {
    if (!list || list.length === 0)
        return 0;
    const sorted = [...list].sort((a, b) => (b.score || 0) - (a.score || 0));
    const picked = sorted.slice(0, n);
    const sum = picked.reduce((s, r) => s + (r.score || 0), 0);
    return (sum / (n * 100)) * maxScore;
}
/** 전체 평균 환산 */
function practicalAverage(list, maxScore) {
    if (!list || list.length === 0)
        return 0;
    const avg = list.reduce((s, r) => s + (r.score || 0), 0) / list.length;
    return (avg / 100) * maxScore;
}
/**
 * Special 모드 대학 계산
 *
 * @param F - 실기 계산식 데이터
 * @param list - 종목별 계산 결과 배열
 * @param log - 계산 로그
 * @param studentGender - 학생 성별
 * @returns 최종 실기 점수
 */
function calcPracticalSpecial(F, list, log, studentGender) {
    const uid = Number(F.U_ID);
    const cfg = typeof F.실기특수설정 === 'string'
        ? JSON.parse(F.실기특수설정)
        : F.실기특수설정 || {};
    // ======== ID 13번 학교 (수동 공식 계산) ========
    if (uid === 13) {
        log.push(`[Special-Case 13] 수동 공식 계산 시작 (Gender: ${studentGender})`);
        if (studentGender !== '남' && studentGender !== '여') {
            log.push(`[오류] 성별 정보 없음. 0점 반환.`);
            return 0;
        }
        const standards = {
            배근력: { 남: { min: 130, max: 220 }, 여: { min: 60, max: 151 } },
            좌전굴: { 남: { min: 11.9, max: 30 }, 여: { min: 13.9, max: 32 } },
            제자리멀리뛰기: { 남: { min: 254, max: 300 }, 여: { min: 199, max: 250 } },
            중량메고달리기: { 남: { min: 9.9, max: 7.19 }, 여: { min: 10.9, max: 7.6 } },
        };
        let totalScore = 0;
        for (const item of list) {
            const eventName = item.event;
            const std = standards[eventName]?.[studentGender];
            const record = parseFloat(String(item.record));
            if (!std || isNaN(record)) {
                log.push(`[Special-Case 13] ${eventName}: 기록(${item.record})이 없거나 숫자가 아님. 0점 처리.`);
                item.score = 0;
                item.deduction_level = 0;
                continue;
            }
            let eventScoreRaw = 0;
            const min = std.min;
            const max = std.max;
            let cappedRecord = record;
            const isLowerBetter = max < min;
            if (isLowerBetter) {
                if (record < max)
                    cappedRecord = max;
                if (record > min)
                    cappedRecord = min;
            }
            else {
                if (record > max)
                    cappedRecord = max;
                if (record < min)
                    cappedRecord = min;
            }
            if (max - min === 0) {
                eventScoreRaw = 0;
            }
            else {
                eventScoreRaw = ((cappedRecord - min) / (max - min)) * 100;
            }
            const eventScore = Math.round(eventScoreRaw * 100) / 100;
            item.score = eventScore;
            item.deduction_level = 0;
            log.push(`[Special-Case 13] ${eventName}: (기록 ${record} -> ${cappedRecord}) → ${eventScore.toFixed(2)}점 (0감)`);
            totalScore += eventScore;
        }
        const finalTotalScore = Math.round(totalScore * 100) / 100;
        log.push(`[Special-Case 13] 최종 합산 점수: ${finalTotalScore.toFixed(2)} (반올림 전: ${totalScore})`);
        return finalTotalScore;
    }
    // ======== 공통 변수 준비 ========
    const scoreMap = new Map();
    for (const item of list) {
        scoreMap.set(item.event, item.score || 0);
    }
    const cleaned = (list || []).filter((it) => Number.isFinite(it.score) && it.score !== null && it.score > 0);
    const sumOfAllScores = Array.from(scoreMap.values()).reduce((sum, score) => sum + score, 0);
    switch (uid) {
        // ======== ID 2번 학교 ========
        case 2: {
            const sumOfScores = cleaned.reduce((sum, item) => sum + (item.score || 0), 0);
            let lookedUpScore;
            if (sumOfScores >= 286)
                lookedUpScore = 700;
            else if (sumOfScores >= 271)
                lookedUpScore = 691;
            else if (sumOfScores >= 256)
                lookedUpScore = 682;
            else if (sumOfScores >= 241)
                lookedUpScore = 673;
            else if (sumOfScores >= 226)
                lookedUpScore = 664;
            else if (sumOfScores >= 211)
                lookedUpScore = 655;
            else if (sumOfScores >= 196)
                lookedUpScore = 646;
            else if (sumOfScores >= 181)
                lookedUpScore = 637;
            else
                lookedUpScore = 630;
            log.push(`[Special-Case 2] 배점 합(${sumOfScores}) -> 환산 점수(${lookedUpScore})`);
            return lookedUpScore;
        }
        // ======== ID 3번 학교 ========
        case 3: {
            const sumOfScores = cleaned.reduce((sum, item) => sum + (item.score || 0), 0);
            log.push(`[Special-Case 3] 배점 합(${sumOfScores}) + 기본점수(1)`);
            return sumOfScores + 1;
        }
        // ======== ID 17번 학교 (가중치 합산 1) ========
        case 17: {
            const runScore = scoreMap.get('10m왕복달리기') || 0;
            const jumpScore = scoreMap.get('제자리멀리뛰기') || 0;
            const situpScore = scoreMap.get('윗몸일으키기') || 0;
            const totalScore = runScore * 5.6 + jumpScore * 5.6 + situpScore * 4.8;
            log.push(`[Special-Case 17] (10m왕복 ${runScore}점 * 5.6) + (제멀 ${jumpScore}점 * 5.6) + (윗몸 ${situpScore}점 * 4.8)`);
            log.push(`[Special-Case 17] 최종 합산 점수: ${totalScore.toFixed(3)}`);
            return totalScore;
        }
        // ======== ID 16번 학교 (가중치 합산 2) ========
        case 16: {
            const runScore = scoreMap.get('10m왕복달리기') || 0;
            const jumpScore = scoreMap.get('제자리멀리뛰기') || 0;
            const situpScore = scoreMap.get('윗몸일으키기') || 0;
            const totalScore = runScore * 9.8 + jumpScore * 9.8 + situpScore * 8.4;
            log.push(`[Special-Case 16] (10m왕복 ${runScore}점 * 9.8) + (제멀 ${jumpScore}점 * 9.8) + (윗몸 ${situpScore}점 * 8.4)`);
            log.push(`[Special-Case 16] 최종 합산 점수: ${totalScore.toFixed(3)}`);
            return totalScore;
        }
        // ======== ID 19번 학교 ========
        case 19: {
            const sumOfScores = cleaned.reduce((sum, item) => sum + (item.score || 0), 0);
            log.push(`[Special-Case 19] 배점 합(${sumOfScores}) + 기본점수(2)`);
            return sumOfScores + 2;
        }
        // ======== ID 69, 70번 학교 (평균 × 4 + 기본점수 400) ========
        case 69:
        case 70: {
            const avg = sumOfAllScores / 3;
            const totalScore = avg * 4 + 400;
            log.push(`[Special-Case ${uid}] (전체 합산 ${sumOfAllScores}점 / 3) * 4 + 400`);
            log.push(`[Special-Case ${uid}] 최종 합산 점수: ${totalScore.toFixed(3)}`);
            return totalScore;
        }
        // ======== ID 71번 학교 (5종목 단순 합산) ========
        case 71: {
            const totalScore = sumOfAllScores;
            log.push(`[Special-Case 71] 5종목 단순 합산: ${sumOfAllScores}점`);
            log.push(`[Special-Case 71] 최종 합산 점수: ${totalScore.toFixed(3)}`);
            return totalScore;
        }
        // ======== ID 99, 147 (상위 3종목, 800점 만점) ========
        case 99:
        case 147: {
            const finalScore = practicalTopN(cleaned, 3, 800);
            log.push(`[Special-Case ${uid}] 상위 3종목 합산 (800점 만점 환산)`);
            log.push(`[Special-Case ${uid}] 최종 점수: ${finalScore.toFixed(3)}`);
            return finalScore;
        }
        // ======== ID 121번 학교 (PASS 개수 × 100 + 200) ========
        case 121: {
            let passCount = 0;
            for (const item of list || []) {
                const gradeStr = String(item.rawGrade || '').toUpperCase();
                if (gradeStr === 'P' || gradeStr === 'PASS') {
                    passCount++;
                }
            }
            const totalScore = 100 * passCount + 200;
            log.push(`[Special-Case 121] PASS 종목 수: ${passCount}개 → (100 * ${passCount}) + 200 = ${totalScore}`);
            return totalScore;
        }
        // ======== ID 146 (상위 3종목, 400점 만점) ========
        case 146: {
            const finalScore = practicalTopN(cleaned, 3, 400);
            log.push(`[Special-Case 146] 상위 3종목 합산 (400점 만점 환산)`);
            log.push(`[Special-Case 146] 최종 점수: ${finalScore.toFixed(3)}`);
            return finalScore;
        }
        // ======== ID 151, 152번 학교 (3종목 평균) ========
        case 151:
        case 152: {
            const avg = sumOfAllScores / 3;
            const totalScore = (avg - 80) * (7 / 6) + 560;
            log.push(`[Special-Case ${uid}] ((합산 ${sumOfAllScores}점 / 3) - 80) * (7/6) + 560`);
            log.push(`[Special-Case ${uid}] 최종 합산 점수: ${totalScore.toFixed(3)}`);
            return totalScore;
        }
        // ======== ID 153번 학교 (2종목 평균) ========
        case 153: {
            const avg = sumOfAllScores / 2;
            const totalScore = avg - 80 + 480;
            log.push(`[Special-Case 153] ((합산 ${sumOfAllScores}점 / 2) - 80) + 480`);
            log.push(`[Special-Case 153] 최종 합산 점수: ${totalScore.toFixed(3)}`);
            return totalScore;
        }
        // ======== ID 160번 학교 (가중치 4:3:3 → 1000점 → 700점 환산) ========
        case 160: {
            const runScore = scoreMap.get('20m왕복달리기') || 0;
            const jumpScore = scoreMap.get('제자리멀리뛰기') || 0;
            const throwScore = scoreMap.get('메디신볼던지기') || 0;
            const rawTotal_1000 = runScore * 4 + jumpScore * 3 + throwScore * 3;
            log.push(`[Special-Case 160] (20m왕복 ${runScore}*4) + (제멀 ${jumpScore}*3) + (메디신 ${throwScore}*3) = ${rawTotal_1000}점`);
            const finalTotal_700 = (rawTotal_1000 / 1000) * 700;
            log.push(`[Special-Case 160] (${rawTotal_1000} / 1000) * 700`);
            log.push(`[Special-Case 160] 최종 합산 점수: ${finalTotal_700.toFixed(3)}`);
            return finalTotal_700;
        }
        // ======== ID 175번 학교 (3종목 평균) ========
        case 175: {
            const totalScore = sumOfAllScores / 3;
            log.push(`[Special-Case 175] (전체 합산 ${sumOfAllScores}점 / 3)`);
            log.push(`[Special-Case 175] 최종 합산 점수: ${totalScore.toFixed(3)}`);
            return totalScore;
        }
        // ======== ID 184번 학교 (3종목 합산 300 → 280점 만점 환산) ========
        case 184: {
            const totalScore = (sumOfAllScores / 300) * 280;
            log.push(`[Special-Case 184] (전체 합산 ${sumOfAllScores}점 / 300) * 280`);
            log.push(`[Special-Case 184] 최종 합산 점수: ${totalScore.toFixed(3)}`);
            return totalScore;
        }
        // ======== ID 186번 학교 (배점 총합 + 기본점수 300점) ========
        case 186: {
            const sumOfScores = cleaned.reduce((sum, item) => sum + (item.score || 0), 0);
            const totalScore = sumOfScores + 300;
            log.push(`[Special-Case 186] 배점 합(${sumOfScores}) + 기본점수(300)`);
            log.push(`[Special-Case 186] 최종 합산 점수: ${totalScore.toFixed(3)}`);
            return totalScore;
        }
        // ======== ID 189, 199번 학교 (배점 총합 + 기본점수 20점) ========
        case 189:
        case 199: {
            const sumOfScores = cleaned.reduce((sum, item) => sum + (item.score || 0), 0);
            const totalScore = sumOfScores + 20;
            log.push(`[Special-Case ${uid}] 배점 합(${sumOfScores}) + 기본점수(20)`);
            log.push(`[Special-Case ${uid}] 최종 합산 점수: ${totalScore.toFixed(3)}`);
            return totalScore;
        }
        // ======== ID 194, 197번 학교 (배점 총합 * 0.5 * 0.8) ========
        case 194:
        case 197: {
            const sumOfScores = cleaned.reduce((sum, item) => sum + (item.score || 0), 0);
            const totalScore = sumOfScores * 0.5 * 0.8;
            log.push(`[Special-Case ${uid}] 배점 합(${sumOfScores}) * 0.5 * 0.8`);
            log.push(`[Special-Case ${uid}] 최종 합산 점수: ${totalScore.toFixed(3)}`);
            return totalScore;
        }
        // ======== 예시: 상위 2종목만, 180점 만점 ========
        case 1234:
            return practicalTopN(cleaned, 2, cfg.maxScore || 180);
        // ======== 예시: 전체 평균, 150점 만점 ========
        case 5678:
            return practicalAverage(cleaned, cfg.maxScore || 150);
        default:
            log.push(`[경고] Special 모드 U_ID(${uid})가 분기에 없습니다. 0점을 반환합니다.`);
            return 0;
    }
}
