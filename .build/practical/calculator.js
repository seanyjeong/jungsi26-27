"use strict";
/**
 * 실기 점수 계산기 핵심 모듈
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePracticalScore = calculatePracticalScore;
const lookup_1 = require("./lookup");
const special_rules_1 = require("./special-rules");
/**
 * 실기 점수 계산
 *
 * @param F - 실기 계산식 데이터 (학교별)
 * @param S_original - 학생 실기 데이터
 * @returns 계산 결과 { totalScore, breakdown, calculationLog }
 */
function calculatePracticalScore(F, S_original) {
    const log = [];
    log.push('========== 실기 계산 시작 ==========');
    // S_data 포맷 어댑터 (신/구 형식 호환)
    let S = S_original;
    if (S &&
        !S.gender &&
        S.practicals &&
        Array.isArray(S.practicals) &&
        S.practicals.length > 0) {
        log.push('[어댑터] S_data.gender가 없어 구형 포맷으로 간주. 변환 시도...');
        const oldPracticals = S.practicals;
        const firstRecord = oldPracticals[0];
        const detectedGender = firstRecord.gender;
        if (detectedGender === '남' || detectedGender === '여') {
            const newPracticals = oldPracticals.map((p) => ({
                event: p.event,
                value: p.record !== undefined ? p.record : p.value,
            }));
            S = { gender: detectedGender, practicals: newPracticals };
            log.push(`[어댑터] 변환 완료. Gender: ${S.gender}, Records: ${S.practicals.length}건`);
        }
        else {
            log.push(`[어댑터] 변환 실패: practicals 배열에서 gender('남'/'여')를 찾을 수 없음.`);
            S = { gender: '남', practicals: [] };
        }
    }
    else if (!S) {
        log.push('[오류] S_data가 null 또는 undefined입니다.');
        S = { gender: '남', practicals: [] };
    }
    const mode = F.실기모드 || 'basic';
    log.push(`[정보] 실기 모드: ${mode}`);
    const studentGender = S?.gender || '';
    const studentRecords = S?.practicals || [];
    const allScoreData = F?.실기배점 || [];
    // ========== Special 모드 ==========
    if (mode === 'special') {
        log.push(`[Special] 'special' 모드 실행...`);
        const eventBreakdowns = [];
        const schoolOutOfRangeRule = F.미달처리 || '0점';
        studentRecords.forEach((record) => {
            const eventName = record.event;
            const eventValue = String(record.value ?? record.record ?? '').trim();
            if (eventValue === '') {
                log.push(`[${eventName}] 기록 없음. 계산 보류.`);
                eventBreakdowns.push({
                    event: eventName,
                    record: '',
                    score: null,
                    rawGrade: undefined,
                    deduction_level: null,
                });
                return;
            }
            const { method } = (0, lookup_1.getEventRules)(eventName);
            const scoreTable = allScoreData.filter((r) => r.종목명 === eventName && (r.성별 === studentGender || r.성별 === '공통'));
            let rawGrade;
            let score;
            let deductionLevel = 0;
            // U_ID = 121 전용 PASS/NP 처리
            if (Number(F.U_ID) === 121) {
                const studentNum = Number(eventValue);
                let pass = false;
                if (!Number.isNaN(studentNum) && scoreTable.length > 0) {
                    const threshold = Number(scoreTable[0].기록);
                    if (!Number.isNaN(threshold)) {
                        if (method === 'lower_is_better') {
                            pass = studentNum <= threshold;
                        }
                        else {
                            pass = studentNum >= threshold;
                        }
                    }
                }
                rawGrade = pass ? 'P' : 'NP';
                score = (0, lookup_1.convertGradeToScore)(rawGrade, F.U_ID, eventName);
                deductionLevel = 0;
                log.push(`[121전용] ${eventName}: 기준 ${scoreTable[0]?.기록} / 학생기록 ${eventValue} → ${rawGrade}(${score}점)`);
            }
            else {
                // 다른 학교는 기존 special 로직
                rawGrade = (0, lookup_1.lookupScore)(eventValue, method, scoreTable, schoolOutOfRangeRule);
                score = (0, lookup_1.convertGradeToScore)(rawGrade, F.U_ID, eventName);
                deductionLevel = (0, lookup_1.lookupDeductionLevel)(score, scoreTable);
                log.push(`[${eventName}] (규칙: ${method}) 기록: ${eventValue} → 배점: "${rawGrade}"(환산: ${score}점) → 급간(감수): ${deductionLevel}감`);
            }
            eventBreakdowns.push({
                event: eventName,
                record: eventValue,
                score: score,
                rawGrade: rawGrade,
                deduction_level: deductionLevel,
            });
        });
        const finalPracticalScore = (0, special_rules_1.calcPracticalSpecial)(F, eventBreakdowns, log, studentGender);
        log.push('========== 실기 최종 ==========');
        log.push(`'special' 모드 계산 최종 총점: ${finalPracticalScore}`);
        const breakdown = {
            events: eventBreakdowns,
            practical_raw_sum: finalPracticalScore,
            total_deduction_level: 0,
        };
        return {
            totalScore: finalPracticalScore.toFixed(3),
            breakdown,
            calculationLog: log,
        };
    }
    // ========== Basic 모드 ==========
    log.push(`[Basic] 'basic' 모드(신규 로직) 실행...`);
    const PRACTICAL_MAX = Number(F.실기총점) || 0;
    const schoolTotalBaseScore = Number(F.기본점수) || 0;
    const schoolOutOfRangeRule = F.미달처리 || '0점';
    log.push(`[정보] 실기총점(목표 만점)=${PRACTICAL_MAX}, 기본점수(추가)=${schoolTotalBaseScore}`);
    if (studentGender !== '남' && studentGender !== '여') {
        log.push(`[오류] 학생 성별(S.gender)이 '남' 또는 '여'가 아닙니다.`);
        return {
            totalScore: '0',
            breakdown: {},
            calculationLog: log,
        };
    }
    let rawPracticalSum = 0;
    let scoreTableMaxSum = 0;
    const eventBreakdowns = [];
    let totalDeductionLevel = 0;
    studentRecords.forEach((record) => {
        const eventName = record.event;
        const eventValue = String(record.value ?? record.record ?? '').trim();
        const scoreTable = allScoreData.filter((r) => r.종목명 === eventName && (r.성별 === studentGender || r.성별 === '공통'));
        const eventMaxScore = (0, lookup_1.findMaxScore)(scoreTable);
        scoreTableMaxSum += eventMaxScore;
        log.push(`[정보] ${eventName} 배점표 만점: ${eventMaxScore}점 (누적 배점표 만점: ${scoreTableMaxSum}점)`);
        if (eventValue === '') {
            log.push(`[${eventName}] 기록 없음. 계산 보류.`);
            eventBreakdowns.push({
                event: eventName,
                record: '',
                score: null,
                deduction_level: null,
            });
            return;
        }
        const { method } = (0, lookup_1.getEventRules)(eventName);
        const rawGrade = (0, lookup_1.lookupScore)(eventValue, method, scoreTable, schoolOutOfRangeRule);
        const score = (0, lookup_1.convertGradeToScore)(rawGrade, F.U_ID, eventName);
        const deductionLevel = (0, lookup_1.lookupDeductionLevel)(score, scoreTable);
        log.push(`[${eventName}] (규칙: ${method}) 기록: ${eventValue} → 배점: "${rawGrade}"(환산: ${score}점) → 급간(감수): ${deductionLevel}감`);
        rawPracticalSum += score;
        totalDeductionLevel += deductionLevel;
        eventBreakdowns.push({
            event: eventName,
            record: eventValue,
            score: score,
            deduction_level: deductionLevel,
        });
    });
    log.push(`[결과] 종목 합계: ${rawPracticalSum}점`);
    if (scoreTableMaxSum <= 0) {
        log.push(`[오류] 배점표 만점 합계(${scoreTableMaxSum})가 0입니다. 계산 불가.`);
        const breakdown = {
            events: eventBreakdowns,
            practical_raw_sum: schoolTotalBaseScore,
            total_deduction_level: totalDeductionLevel,
        };
        return {
            totalScore: schoolTotalBaseScore.toFixed(3),
            breakdown,
            calculationLog: log,
        };
    }
    const finalRawScore = rawPracticalSum + schoolTotalBaseScore;
    log.push(`[조정] 종목 합계(${rawPracticalSum}) + 기본 점수(${schoolTotalBaseScore}) = ${finalRawScore}점`);
    log.push(`[결과] 실기 원점수 합계 (최종): ${finalRawScore} / ${scoreTableMaxSum}`);
    log.push(`[결과] 총 감수 (레벨 합): ${totalDeductionLevel}감`);
    const finalPracticalScore = (finalRawScore / scoreTableMaxSum) * PRACTICAL_MAX;
    log.push('========== 실기 최종 ==========');
    log.push(`실기 환산 점수 = (학생 원점수 ${finalRawScore} / 배점표 만점 ${scoreTableMaxSum}) * 실기총점(DB) ${PRACTICAL_MAX}`);
    log.push(`실기 최종 점수: ${finalPracticalScore.toFixed(3)}`);
    const breakdown = {
        events: eventBreakdowns,
        practical_raw_sum: finalPracticalScore,
        total_deduction_level: totalDeductionLevel,
    };
    return {
        totalScore: finalPracticalScore.toFixed(3),
        breakdown,
        calculationLog: log,
    };
}
