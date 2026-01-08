"use strict";
/**
 * 수능 점수 계산기 핵심 모듈
 *
 * calculateScore: 기본 계산
 * calculateScoreWithConv: 변환표준점수 적용 래퍼
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateScore = calculateScore;
exports.calculateScoreWithConv = calculateScoreWithConv;
const safe_parse_1 = require("../utils/safe-parse");
const interpolate_1 = require("../utils/interpolate");
const normalizer_1 = require("./normalizer");
const special_context_1 = require("./special-context");
const formula_eval_1 = require("./formula-eval");
/**
 * 수능 점수 계산
 *
 * @param formulaDataRaw - 학교별 계산식 데이터 (DB에서 로드)
 * @param studentScores - 학생 성적
 * @param highestMap - 최고표점 맵 (optional)
 * @returns 계산 결과 { totalScore, breakdown, calculationLog }
 */
function calculateScore(formulaDataRaw, studentScores, highestMap) {
    const log = [];
    log.push('========== 계산 시작 ==========');
    // JSON 필드 파싱
    const F = { ...formulaDataRaw };
    // 파싱된 값들을 별도 변수로 관리 (타입 안전성)
    // selection_rules는 배열 또는 단일 객체일 수 있음
    const parsedSelectionRules = (0, safe_parse_1.safeParse)(F.selection_rules, []);
    const selectionRules = Array.isArray(parsedSelectionRules)
        ? parsedSelectionRules
        : parsedSelectionRules && typeof parsedSelectionRules === 'object'
            ? [parsedSelectionRules]
            : [];
    const scoreConfig = ((0, safe_parse_1.safeParse)(F.score_config, {}) || {});
    const englishScoresMap = (0, safe_parse_1.safeParse)(F.english_scores, null);
    const historyScoresMap = (0, safe_parse_1.safeParse)(F.history_scores, null);
    const englishBonusScoresMap = (0, safe_parse_1.safeParse)(F.english_bonus_scores, null);
    const englishBonusFixed = Number(F.english_bonus_fixed || 0);
    const otherSettings = ((0, safe_parse_1.safeParse)(F.기타설정, {}) || {});
    const englishAsBonus = (0, normalizer_1.detectEnglishAsBonus)(F);
    // 학생 성적 파싱
    const subs = studentScores?.subjects || [];
    const S = {
        국어: subs.find((s) => s.name === '국어') || { name: '국어' },
        수학: subs.find((s) => s.name === '수학') || { name: '수학' },
        영어: subs.find((s) => s.name === '영어') || { name: '영어' },
        한국사: subs.find((s) => s.name === '한국사') || { name: '한국사' },
        탐구: subs.filter((s) => s.name === '탐구'),
    };
    // ========== 하드코딩 특수 대학 (선문대) ==========
    if (F.U_ID === 148 || F.U_ID === 149) {
        log.push(`<< U_ID ${F.U_ID}번 대학 하드코딩 로직 실행 >>`);
        const gradeToScoreMap = {
            1: 100,
            2: 93,
            3: 86,
            4: 79,
            5: 72,
            6: 65,
            7: 58,
            8: 51,
            9: 44,
        };
        const defaultScore = 0;
        const korGrade = S.국어?.grade || 9;
        const mathGrade = S.수학?.grade || 9;
        const engGrade = S.영어?.grade || 9;
        let bestInqGrade = 9;
        if (S.탐구 && S.탐구.length > 0) {
            const inquiryGrades = S.탐구.map((t) => t.grade || 9).sort((a, b) => a - b);
            bestInqGrade = inquiryGrades[0];
        }
        const korScore = gradeToScoreMap[korGrade] || defaultScore;
        const mathScore = gradeToScoreMap[mathGrade] || defaultScore;
        const engScore = gradeToScoreMap[engGrade] || defaultScore;
        const inqScore = gradeToScoreMap[bestInqGrade] || defaultScore;
        log.push(` -> 국:${korGrade}등급(${korScore}점), 수:${mathGrade}등급(${mathScore}점), 영:${engGrade}등급(${engScore}점), 탐(Best):${bestInqGrade}등급(${inqScore}점)`);
        const scoresToSelect = [korScore, mathScore, engScore, inqScore];
        scoresToSelect.sort((a, b) => b - a);
        const top2Sum = scoresToSelect[0] + scoresToSelect[1];
        log.push(` -> 상위 2개 영역 합: ${scoresToSelect[0]} + ${scoresToSelect[1]} = ${top2Sum}점`);
        let histScore = 0;
        const histGrade = S.한국사?.grade;
        if (histGrade && historyScoresMap) {
            histScore = Number(historyScoresMap[String(histGrade)] || 0);
            log.push(` -> 한국사: ${histGrade}등급 → ${histScore}점 (가산)`);
        }
        else {
            log.push(` -> 한국사: 등급 정보 없거나 환산표 없음 → 0점`);
        }
        const finalScore = top2Sum + histScore;
        log.push(` -> 최종 점수(200점 만점 + 한국사): ${top2Sum} + ${histScore} = ${finalScore.toFixed(2)}점`);
        log.push('========== 최종 ==========');
        return {
            totalScore: finalScore.toFixed(2),
            breakdown: { top2: top2Sum, history: histScore },
            calculationLog: log,
        };
    }
    // ========== 하드코딩 특수 대학 (경동대) ==========
    if (F.U_ID === 76) {
        log.push(`<< U_ID ${F.U_ID}번 대학 (등급 평균) 하드코딩 로직 실행 >>`);
        const scoreTable = {
            1: 700.0,
            2: 692.0,
            3: 684.0,
            4: 676.0,
            5: 668.0,
            6: 660.0,
            7: 652.0,
            8: 644.0,
            9: 630.0,
        };
        const korGrade = S.국어?.grade || 9;
        const mathGrade = S.수학?.grade || 9;
        const engGrade = S.영어?.grade || 9;
        let bestInqGrade = 9;
        if (S.탐구 && S.탐구.length > 0) {
            const inqGrades = S.탐구.map((t) => t.grade || 9).sort((a, b) => a - b);
            bestInqGrade = inqGrades[0];
        }
        log.push(` -> 등급: 국(${korGrade}) + 수(${mathGrade}) + 영(${engGrade}) + 탐1(${bestInqGrade})`);
        const gradeSum = korGrade + mathGrade + engGrade + bestInqGrade;
        const gradeAvg = gradeSum / 4.0;
        log.push(` -> 합계: ${gradeSum} / 평균: ${gradeAvg.toFixed(2)}`);
        let uniGrade = Math.floor(gradeAvg);
        if (gradeAvg < 1.0)
            uniGrade = 1;
        if (gradeAvg >= 9.0)
            uniGrade = 9;
        uniGrade = Math.max(1, Math.min(9, uniGrade));
        log.push(` -> 대학 자체 등급으로 변환: ${uniGrade}등급`);
        const finalScore = scoreTable[uniGrade] || 630.0;
        log.push(` -> 최종 특점: ${finalScore.toFixed(1)}점`);
        log.push('========== 최종 ==========');
        return {
            totalScore: finalScore.toFixed(1),
            breakdown: { special: finalScore },
            calculationLog: log,
        };
    }
    // ========== 특수공식 모드 ==========
    if (F.계산유형 === '특수공식' && F.특수공식) {
        log.push('<< 특수공식 모드 >>');
        const ctx = (0, special_context_1.buildSpecialContext)(F, S, highestMap);
        log.push(`[특수공식 원본] ${F.특수공식}`);
        const specialValue = (0, formula_eval_1.evaluateSpecialFormula)(F.특수공식, ctx, log);
        const final = Number(specialValue) || 0;
        log.push('========== 최종 ==========');
        log.push(`특수공식 결과 = ${final.toFixed(2)}`);
        return {
            totalScore: final.toFixed(2),
            breakdown: { special: final },
            calculationLog: log,
        };
    }
    // ========== 일반 계산 ==========
    const cfg = scoreConfig;
    const kmType = cfg.korean_math?.type || '백분위';
    const inqType = cfg.inquiry?.type || '백분위';
    const inqMethod = cfg.inquiry?.max_score_method || '';
    const inquiryCount = Math.max(1, parseInt(String(F.탐구수 || '1'), 10));
    const { rep: inqRep, picked: inqPicked } = (0, normalizer_1.calcInquiryRepresentative)(S.탐구, inqType, inquiryCount);
    let engConv = 0;
    let englishGradeBonus = 0;
    if (englishScoresMap && S.영어?.grade != null) {
        const g = String(S.영어.grade);
        if (englishAsBonus) {
            englishGradeBonus = Number(englishScoresMap[g] ?? 0);
        }
        else {
            engConv = Number(englishScoresMap[g] ?? 0);
        }
    }
    const historyAppearsInRules = (0, normalizer_1.isSubjectUsedInRules)('한국사', selectionRules);
    const historyRatioPositive = Number(F['한국사'] || 0) > 0;
    const historyAsSubject = historyAppearsInRules || historyRatioPositive;
    let histConv = 0;
    if (historyAsSubject && historyScoresMap && S.한국사?.grade != null) {
        const hg = String(S.한국사.grade);
        histConv = Number(historyScoresMap[hg] ?? 0);
    }
    const raw = {
        국어: (0, normalizer_1.pickByType)(S.국어, kmType),
        수학: (0, normalizer_1.pickByType)(S.수학, kmType),
        영어: englishAsBonus ? 0 : engConv,
        한국사: historyAsSubject ? histConv : 0,
        탐구: inqRep,
    };
    if (englishAsBonus) {
        log.push(`[원점수] 국:${raw.국어} / 수:${raw.수학} / 영(가산점모드-과목반영X):0 / 탐(대표):${raw.탐구}`);
    }
    else {
        log.push(`[원점수] 국:${raw.국어} / 수:${raw.수학} / 영(환산):${raw.영어} / 탐(대표):${raw.탐구}`);
    }
    if (historyAsSubject) {
        log.push(`[원점수] 한국사(과목반영): ${raw.한국사}`);
    }
    const { korMax, mathMax, engMax, inqMax } = (0, normalizer_1.resolveMaxScores)(cfg, englishScoresMap, highestMap, S);
    log.push(`[최고점] 국어=${korMax}, 수학=${mathMax}, 영어=${engMax}, 탐구=${inqMax}`);
    let histMax = 100;
    if (historyScoresMap) {
        const vals = Object.values(historyScoresMap)
            .map(Number)
            .filter((n) => !Number.isNaN(n));
        if (vals.length)
            histMax = Math.max(...vals);
    }
    const getMax = (name) => {
        if (name === '국어')
            return korMax;
        if (name === '수학')
            return mathMax;
        if (name === '영어')
            return engMax;
        if (name === '탐구')
            return inqMax;
        if (name === '한국사')
            return histMax;
        return 100;
    };
    // 정규화 함수
    const normOf = (name) => {
        // 한국사 과목 반영 시 100점 만점 처리
        if (name === '한국사' && historyAsSubject) {
            const sc = Number(raw[name] || 0);
            log.push(`[정규화 조정] 한국사(과목 반영) 점수 ${sc}를 100점 만점 기준으로 정규화`);
            return 100 > 0 ? Math.max(0, Math.min(1, sc / 100)) : 0;
        }
        // 탐구 highest_of_year 처리
        if (name === '탐구' && inqMethod === 'highest_of_year') {
            const allInquiryNormalized = S.탐구
                .map((sub) => {
                const subject = sub.subject || '';
                let val = 0;
                let top = 0;
                let normalized = 0;
                if (inqType === '변환표준점수') {
                    if (!F.탐구변표)
                        return null;
                    const group = sub.group || sub.type || (0, normalizer_1.guessInquiryGroup)(subject);
                    const convTableForGroup = F.탐구변표[group];
                    if (!convTableForGroup || Object.keys(convTableForGroup).length === 0)
                        return null;
                    const maxConvScore = Math.max(...Object.values(convTableForGroup)
                        .map(Number)
                        .filter((n) => !isNaN(n)));
                    val = (0, normalizer_1.readConvertedStd)(sub);
                    top = maxConvScore;
                }
                else if (inqType === '표준점수') {
                    if (!highestMap)
                        return null;
                    val = Number(sub.std || 0);
                    top = Number(highestMap[subject] ?? NaN);
                }
                else {
                    return null;
                }
                if (!Number.isFinite(top) || top <= 0 || !Number.isFinite(val))
                    return null;
                normalized = Math.max(0, Math.min(1, val / top));
                return { subject, val, top, normalized };
            })
                .filter((r) => r != null);
            allInquiryNormalized.sort((a, b) => b.normalized - a.normalized);
            const n = Math.max(1, inquiryCount || 1);
            const pickedNormalized = allInquiryNormalized.slice(0, Math.min(n, allInquiryNormalized.length));
            if (pickedNormalized.length) {
                const avg = pickedNormalized.reduce((s, r) => s + r.normalized, 0) / pickedNormalized.length;
                log.push(`[탐구정규화-정렬] highest_of_year (Top${n}): ${pickedNormalized
                    .map((p) => `${p.subject}:${p.normalized.toFixed(4)} [${p.val}/${p.top}]`)
                    .join(', ')} → 평균비율=${avg.toFixed(4)}`);
                return avg;
            }
            log.push(`[탐구정규화-정렬] FAILED.`);
            return 0;
        }
        // 기본 정규화
        const sc = Number(raw[name] || 0);
        const mx = getMax(name);
        return mx > 0 ? Math.max(0, Math.min(1, sc / mx)) : 0;
    };
    const TOTAL = (0, normalizer_1.resolveTotal)(F);
    const suneungRatio = (Number(F.수능) || 0) / 100;
    log.push(`[학교] 총점=${TOTAL}, 수능비율=${suneungRatio} (DB총점 반영)`);
    const rules = selectionRules;
    const selectWeightSubjects = new Set();
    const selectWeightSum = rules.reduce((acc, r) => {
        if (r && r.type === 'select_ranked_weights') {
            if (Array.isArray(r.from))
                r.from.forEach((n) => selectWeightSubjects.add(n));
            if (Array.isArray(r.weights)) {
                const w = r.weights.map(Number).reduce((a, b) => a + (b || 0), 0);
                return acc + w;
            }
        }
        return acc;
    }, 0);
    const SW = Math.min(1, Math.max(0, selectWeightSum));
    const TOTAL_select = TOTAL * SW;
    const TOTAL_base = TOTAL * (1 - SW);
    const selectNRules = rules.filter((r) => r?.type === 'select_n' && Array.isArray(r.from) && r.count);
    const selectedBySelectN = new Set();
    if (selectNRules.length) {
        for (const r of selectNRules) {
            const cand = r.from
                .filter((name) => !(englishAsBonus && name === '영어'))
                .map((name) => ({ name, norm: normOf(name) }))
                .sort((a, b) => b.norm - a.norm);
            const picked = cand.slice(0, Math.min(Number(r.count) || 1, cand.length));
            picked.forEach((p) => selectedBySelectN.add(p.name));
            log.push(`[select_n] from=[${r.from.join(', ')}], count=${r.count} -> 선택: ${picked
                .map((p) => p.name)
                .join(', ')}`);
        }
    }
    let baseRatioSum = 0;
    let baseNormWeighted = 0;
    const ratioOf = (name) => Number(F[name] || 0);
    const candidatesBase = [
        '국어',
        '수학',
        '영어',
        '탐구',
        ...(historyAsSubject ? ['한국사'] : []),
    ];
    for (const name of candidatesBase) {
        if (englishAsBonus && name === '영어')
            continue;
        const ratio = ratioOf(name);
        if (ratio <= 0)
            continue;
        if (selectWeightSubjects.size && selectWeightSubjects.has(name))
            continue;
        if (selectNRules.length && !selectedBySelectN.has(name))
            continue;
        baseRatioSum += ratio;
        baseNormWeighted += normOf(name) * ratio;
    }
    const baseBeforeRatio = baseRatioSum > 0 && TOTAL_base > 0
        ? (baseNormWeighted / baseRatioSum) * TOTAL_base
        : 0;
    let selectBeforeRatio = 0;
    const usedForWeights = new Set();
    for (let i = 0; i < rules.length; i++) {
        const r = rules[i];
        if (!(r &&
            r.type === 'select_ranked_weights' &&
            Array.isArray(r.from) &&
            Array.isArray(r.weights) &&
            r.weights.length)) {
            continue;
        }
        const cand = r.from
            .filter((name) => !(englishAsBonus && name === '영어'))
            .filter((name) => !usedForWeights.has(name))
            .map((name) => ({
            name,
            norm: normOf(name),
            raw: Number(raw[name] || 0),
        }))
            .sort((a, b) => b.norm - a.norm);
        const N = Math.min(cand.length, r.weights.length);
        const picked = cand.slice(0, N);
        picked.forEach((p) => usedForWeights.add(p.name));
        const wSum = picked.reduce((acc, c, idx) => acc + Number(r.weights[idx] || 0) * c.norm, 0);
        selectBeforeRatio += wSum * TOTAL;
    }
    const rawSuneungTotal = baseBeforeRatio + selectBeforeRatio;
    log.push(`[수능원본점수] 기본=${baseBeforeRatio.toFixed(2)}, 선택=${selectBeforeRatio.toFixed(2)}, 합계=${rawSuneungTotal.toFixed(2)} (비율적용 전)`);
    let historyScore = 0;
    if (!historyAsSubject && historyScoresMap && S.한국사?.grade != null) {
        const hg = String(S.한국사.grade);
        historyScore = Number(historyScoresMap[hg]) || 0;
        log.push(`[한국사] 등급 ${hg} → ${historyScore}점`);
    }
    let englishBonus = 0;
    if (englishBonusScoresMap && S.영어?.grade != null) {
        const eg = String(S.영어.grade);
        englishBonus += Number(englishBonusScoresMap[eg] ?? 0);
        log.push(`[영어 보정] 등급 ${eg} → ${Number(englishBonusScoresMap[eg] ?? 0)}점`);
    }
    if (englishAsBonus && S.영어?.grade != null && englishScoresMap) {
        const eg = String(S.영어.grade);
        englishBonus += englishGradeBonus;
        log.push(`[영어 보정] (자동판단-가산점모드) 등급 ${eg} → ${englishGradeBonus}점`);
    }
    if (englishBonusFixed) {
        englishBonus += englishBonusFixed;
        log.push(`[영어 보정] 고정 보정 ${englishBonusFixed}점`);
    }
    let finalSuneungScore = 0;
    if (otherSettings.한국사우선적용 === true) {
        log.push('[계산방식] 한국사 가산점 우선 적용');
        finalSuneungScore = (rawSuneungTotal + historyScore) * suneungRatio;
        historyScore = 0;
    }
    else {
        finalSuneungScore = rawSuneungTotal * suneungRatio;
    }
    const final = finalSuneungScore + historyScore + englishBonus;
    log.push('========== 최종 ==========');
    log.push(`수능점수(최종) = ${finalSuneungScore.toFixed(2)} / 한국사(후반영) = ${historyScore} / 영어보정 = ${englishBonus}`);
    log.push(`총점 = ${final.toFixed(2)}`);
    return {
        totalScore: final.toFixed(2),
        breakdown: {
            base: baseBeforeRatio * suneungRatio,
            select: selectBeforeRatio * suneungRatio,
            history: historyScore,
            english_bonus: englishBonus,
        },
        calculationLog: log,
    };
}
/**
 * 변환표준점수 적용 래퍼
 *
 * @param formulaDataRaw - 학교별 계산식 데이터
 * @param studentScores - 학생 성적
 * @param convMap - 변환표준점수 맵 { 사탐: {...}, 과탐: {...} }
 * @param logHook - 로그 콜백 (optional)
 * @param highestMap - 최고표점 맵 (optional)
 * @returns 계산 결과
 */
function calculateScoreWithConv(formulaDataRaw, studentScores, convMap, logHook, highestMap) {
    const cfg = ((0, safe_parse_1.safeParse)(formulaDataRaw.score_config, {}) || {});
    const inqType = cfg?.inquiry?.type || '백분위';
    if (inqType === '변환표준점수' && Array.isArray(studentScores?.subjects)) {
        const cloned = JSON.parse(JSON.stringify(studentScores));
        cloned.subjects = (cloned.subjects || []).map((sub) => {
            if (sub.name !== '탐구')
                return sub;
            if (sub.converted_std != null)
                return sub;
            const group = sub.group || sub.type || (0, normalizer_1.guessInquiryGroup)(sub.subject || '');
            const pct = Number(sub.percentile || 0);
            const conv = (0, interpolate_1.mapPercentileToConverted)(convMap?.[group], pct);
            if (conv != null) {
                if (typeof logHook === 'function') {
                    logHook(`[변환표준] ${group} 백분위 ${pct} → 변표 ${conv.toFixed(2)} (자동보충)`);
                }
                return { ...sub, converted_std: conv, vstd: conv, std: conv };
            }
            return sub;
        });
        studentScores = cloned;
    }
    return calculateScore(formulaDataRaw, studentScores, highestMap);
}
