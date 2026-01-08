"use strict";
/**
 * 특수공식 컨텍스트 빌더
 *
 * buildSpecialContext: 50개 이상의 변수를 계산하여 특수공식에서 사용할 컨텍스트 객체 생성
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSpecialContext = buildSpecialContext;
const safe_parse_1 = require("../utils/safe-parse");
const normalizer_1 = require("./normalizer");
/**
 * 특수공식용 컨텍스트 변수 빌드
 *
 * @param F - 계산식 데이터 (FormulaData)
 * @param S - 파싱된 학생 성적
 * @param highestMap - 최고표점 맵
 * @returns 50개+ 변수를 포함한 컨텍스트 객체
 */
function buildSpecialContext(F, S, highestMap) {
    const ctx = {};
    // 기본값
    ctx.total = (0, normalizer_1.resolveTotal)(F);
    ctx.suneung_ratio = (Number(F.수능) || 0) / 100;
    const cfg = (0, safe_parse_1.safeParse)(F.score_config, {}) || {};
    const kmMethod = cfg?.korean_math
        ?.max_score_method || '';
    const korKey = (0, normalizer_1.kmSubjectNameForKorean)(S?.국어);
    const mathKey = (0, normalizer_1.kmSubjectNameForMath)(S?.수학);
    // 최고표점 결정
    let korMax = 200;
    let mathMax = 200;
    if (kmMethod === 'fixed_200') {
        korMax = 200;
        mathMax = 200;
    }
    else if (kmMethod === 'highest_of_year') {
        if (highestMap && highestMap[korKey] != null)
            korMax = Number(highestMap[korKey]);
        if (highestMap && highestMap[mathKey] != null)
            mathMax = Number(highestMap[mathKey]);
    }
    // 특수공식: highestMap이 있으면 최우선
    if (highestMap) {
        if (highestMap[korKey] != null)
            korMax = Number(highestMap[korKey]);
        if (highestMap[mathKey] != null)
            mathMax = Number(highestMap[mathKey]);
    }
    // 0 또는 NaN 방지
    if (!Number.isFinite(korMax) || korMax <= 0)
        korMax = 1;
    if (!Number.isFinite(mathMax) || mathMax <= 0)
        mathMax = 1;
    ctx.kor_max = korMax;
    ctx.math_max = mathMax;
    // 반영비율
    ctx.ratio_kor = Number(F['국어'] || 0);
    ctx.ratio_math = Number(F['수학'] || 0);
    ctx.ratio_inq = Number(F['탐구'] || 0);
    ctx.ratio_kor_norm = ctx.ratio_kor / 100;
    ctx.ratio_math_norm = ctx.ratio_math / 100;
    ctx.ratio_inq_norm = ctx.ratio_inq / 100;
    ctx.ratio5_kor = ctx.ratio_kor_norm * 5;
    ctx.ratio5_math = ctx.ratio_math_norm * 5;
    ctx.ratio5_inq = ctx.ratio_inq_norm * 5;
    // 국어/수학 표준·백분위
    ctx.kor_std = Number(S.국어?.std || 0);
    ctx.kor_pct = Number(S.국어?.percentile || 0);
    ctx.math_std = Number(S.수학?.std || 0);
    ctx.math_pct = Number(S.수학?.percentile || 0);
    // 영어 (등급 환산)
    ctx.eng_grade_score = 0;
    ctx.eng_max = 100;
    ctx.eng_pct_est = 0;
    const englishScores = (0, safe_parse_1.safeParse)(F.english_scores, null);
    if (englishScores && S.영어?.grade != null) {
        const eg = String(S.영어.grade);
        ctx.eng_grade_score = Number(englishScores[eg] ?? 0);
        const vals = Object.values(englishScores)
            .map(Number)
            .filter((n) => !Number.isNaN(n));
        const engMax = vals.length ? Math.max(...vals) : 100;
        ctx.eng_max = engMax;
        ctx.eng_pct_est =
            engMax > 0 ? Math.min(100, Math.max(0, (ctx.eng_grade_score / engMax) * 100)) : 0;
    }
    // 한국사 (등급 → 환산/감점)
    ctx.hist_grade_score = 0;
    const historyScores = (0, safe_parse_1.safeParse)(F.history_scores, null);
    if (historyScores && S.한국사?.grade != null) {
        const hg = String(S.한국사.grade);
        ctx.hist_grade_score = Number(historyScores[hg] || 0);
    }
    // 탐구 변수들
    const inqs = S.탐구 || [];
    // 변환표준점수 기준 정렬
    const sortedConv = inqs
        .map((t) => ({
        conv: (0, normalizer_1.readConvertedStd)(t),
        std: Number(t?.std || 0),
        pct: Number(t?.percentile || 0),
    }))
        .sort((a, b) => b.conv - a.conv);
    // 표준점수 기준 정렬 (과목명 포함)
    const sortedStd = inqs
        .map((t) => ({
        subject: t?.subject || '',
        std: Number(t?.std || 0),
        pct: Number(t?.percentile || 0),
    }))
        .sort((a, b) => b.std - a.std);
    // 백분위 기준 정렬
    const sortedPct = inqs
        .map((t) => ({ pct: Number(t?.percentile || 0) }))
        .sort((a, b) => b.pct - a.pct);
    ctx.inq1_converted_std = sortedConv[0]?.conv || 0;
    ctx.inq2_converted_std = sortedConv[1]?.conv || 0;
    ctx.inq_sum2_converted_std = ctx.inq1_converted_std + ctx.inq2_converted_std;
    ctx.inq_avg2_converted_std =
        ctx.inq_sum2_converted_std / (sortedConv.length >= 2 ? 2 : sortedConv.length || 1);
    ctx.inq1_std = sortedStd[0]?.std || 0;
    ctx.inq2_std = sortedStd[1]?.std || 0;
    // 탐구 과목별 최고표점
    let inq1_max = 0;
    let inq2_max = 0;
    if (highestMap) {
        const inq1_subject = sortedStd[0]?.subject;
        const inq2_subject = sortedStd[1]?.subject;
        inq1_max = Number(highestMap[inq1_subject] || 0);
        inq2_max = Number(highestMap[inq2_subject] || 0);
    }
    // top3_sum_std_kme_inq1_doubled: 국(표), 수(표), 영(환), (탐구1표*2) 4개 중 상위 3개 합
    const items_std_kme_inq1_doubled = [
        Number(ctx.kor_std || 0),
        Number(ctx.math_std || 0),
        Number(ctx.eng_grade_score || 0),
        Number(ctx.inq1_std || 0) * 2.0,
    ]
        .map((v) => Math.max(0, v))
        .sort((a, b) => b - a);
    ctx.top3_sum_std_kme_inq1_doubled =
        (items_std_kme_inq1_doubled[0] || 0) +
            (items_std_kme_inq1_doubled[1] || 0) +
            (items_std_kme_inq1_doubled[2] || 0);
    // 변환표준점수 테이블 적용 (탐구변표)
    const convTable = F.탐구변표;
    if (convTable &&
        (Object.keys(convTable['사탐'] || {}).length > 0 ||
            Object.keys(convTable['과탐'] || {}).length > 0)) {
        const inq1_subject = sortedStd[0]?.subject;
        const inq2_subject = sortedStd[1]?.subject;
        const inq1_group = (0, normalizer_1.guessInquiryGroup)(inq1_subject || '');
        const inq2_group = (0, normalizer_1.guessInquiryGroup)(inq2_subject || '');
        let maxConv_inq1 = 0;
        let maxConv_inq2 = 0;
        if (convTable[inq1_group]) {
            const vals = Object.values(convTable[inq1_group])
                .map(Number)
                .filter((n) => !isNaN(n));
            if (vals.length > 0)
                maxConv_inq1 = Math.max(...vals);
        }
        if (inq2_subject && convTable[inq2_group]) {
            const vals = Object.values(convTable[inq2_group])
                .map(Number)
                .filter((n) => !isNaN(n));
            if (vals.length > 0)
                maxConv_inq2 = Math.max(...vals);
        }
        else if (inq2_subject) {
            maxConv_inq2 = maxConv_inq1;
        }
        else {
            maxConv_inq2 = 0;
        }
        if (inq1_subject && inq2_subject && inq1_group === inq2_group) {
            maxConv_inq2 = maxConv_inq1;
        }
        if (maxConv_inq1 > 0)
            inq1_max = maxConv_inq1;
        if (maxConv_inq2 > 0)
            inq2_max = maxConv_inq2;
    }
    ctx.inq1_max_std = inq1_max;
    ctx.inq2_max_std = inq2_max;
    ctx.inq_sum2_std = ctx.inq1_std + ctx.inq2_std;
    ctx.inq_avg2_std =
        ctx.inq_sum2_std / (sortedStd.length >= 2 ? 2 : sortedStd.length || 1);
    ctx.inq1_percentile = sortedPct[0]?.pct || 0;
    ctx.inq2_percentile = sortedPct[1]?.pct || 0;
    ctx.inq_sum2_percentile = ctx.inq1_percentile + ctx.inq2_percentile;
    ctx.inq_avg2_percentile =
        ctx.inq_sum2_percentile / (sortedPct.length >= 2 ? 2 : sortedPct.length || 1);
    // top3 조합
    const kor_pct = ctx.kor_pct;
    const math_pct = ctx.math_pct;
    const inq1_pct = ctx.inq1_percentile;
    const eng_pct_est = ctx.eng_pct_est;
    const top3_no_eng = [kor_pct, math_pct, inq1_pct].sort((a, b) => b - a).slice(0, 3);
    ctx.top3_avg_pct_kor_math_inq1 = top3_no_eng.length
        ? top3_no_eng.reduce((s, x) => s + x, 0) / top3_no_eng.length
        : 0;
    const top3_with_eng = [kor_pct, math_pct, inq1_pct, eng_pct_est]
        .sort((a, b) => b - a)
        .slice(0, 3);
    ctx.top3_avg_pct_kor_eng_math_inq1 = top3_with_eng.length
        ? top3_with_eng.reduce((s, x) => s + x, 0) / top3_with_eng.length
        : 0;
    ctx.top3_avg_pct = ctx.top3_avg_pct_kor_eng_math_inq1;
    // 수학 가산점
    const mathSubject = S.수학?.subject || '';
    let mathBonus = 1.0;
    const bonusRules = (0, safe_parse_1.safeParse)(F.bonus_rules, []);
    if (Array.isArray(bonusRules)) {
        for (const rule of bonusRules) {
            if (rule &&
                rule.type === 'percent_bonus' &&
                Array.isArray(rule.subjects) &&
                rule.subjects.includes(mathSubject)) {
                mathBonus = 1.0 + (Number(rule.value) || 0);
                break;
            }
        }
    }
    // top2_sum_scaled_kme: (국*국비율), (수*수비율), (영*영비율) 3개 중 상위 2개 합
    const ratio_eng_norm_local = Number(F['영어'] || 0) / 100.0;
    const scaled_kor = (ctx.kor_pct || 0) * (ctx.ratio_kor_norm || 0);
    const scaled_math = (ctx.math_pct || 0) * (ctx.ratio_math_norm || 0);
    const scaled_eng = (ctx.eng_grade_score || 0) * ratio_eng_norm_local;
    const items_scaled_kme = [scaled_kor, scaled_math, scaled_eng].sort((a, b) => b - a);
    ctx.top2_sum_scaled_kme = (items_scaled_kme[0] || 0) + (items_scaled_kme[1] || 0);
    // top2_avg_pct_kme: 국, 수, 영(환산백) 3개 중 상위 2개 평균
    const items_pct_kme_for_top2_avg = [
        Number(ctx.kor_pct || 0),
        Number(ctx.math_pct || 0),
        Number(ctx.eng_pct_est || 0),
    ]
        .map((v) => Math.max(0, Math.min(100, v)))
        .sort((a, b) => b - a);
    const top2_sum_kme = (items_pct_kme_for_top2_avg[0] || 0) + (items_pct_kme_for_top2_avg[1] || 0);
    ctx.top2_avg_pct_kme = top2_sum_kme / 2.0;
    // top3_avg_pct_kme_inqAvg: 국, 수, 영, 탐(평균) 4개 중 상위 3개 평균
    const items_pct_kme_inqAvg_for_top3_avg = [
        Number(ctx.kor_pct || 0),
        Number(ctx.math_pct || 0),
        Number(ctx.inq_avg2_percentile || 0),
        Number(ctx.eng_pct_est || 0),
    ]
        .map((v) => Math.max(0, Math.min(100, v)))
        .sort((a, b) => b - a);
    const top3_sum_kme_inqAvg = (items_pct_kme_inqAvg_for_top3_avg[0] || 0) +
        (items_pct_kme_inqAvg_for_top3_avg[1] || 0) +
        (items_pct_kme_inqAvg_for_top3_avg[2] || 0);
    ctx.top3_avg_pct_kme_inqAvg = top3_sum_kme_inqAvg / 3.0;
    // math_bonus_pct_10: 미적분/기하 선택 시 수학 백분위의 10% 보너스
    ctx.math_bonus_pct_10 = 0;
    if (/미적분|기하/.test(mathSubject)) {
        ctx.math_bonus_pct_10 = (ctx.math_pct || 0) * 0.1;
    }
    // top3_avg_pct_kme_inqAvg_mathBonus: 청주대용
    const items_pct_kme_inqAvg_with_mathBonus = [
        Number(ctx.kor_pct || 0),
        Number(ctx.math_pct || 0) + Number(ctx.math_bonus_pct_10 || 0),
        Number(ctx.inq_avg2_percentile || 0),
        Number(ctx.eng_grade_score || 0),
    ].sort((a, b) => b - a);
    const top3_sum_with_mathBonus = (items_pct_kme_inqAvg_with_mathBonus[0] || 0) +
        (items_pct_kme_inqAvg_with_mathBonus[1] || 0) +
        (items_pct_kme_inqAvg_with_mathBonus[2] || 0);
    ctx.top3_avg_pct_kme_inqAvg_mathBonus = top3_sum_with_mathBonus / 3.0;
    // top1_math_or_eng_pct: 수학/영어 중 상위 1개
    ctx.top1_math_or_eng_pct = Math.max(Number(ctx.math_pct || 0), Number(ctx.eng_pct_est || 0));
    // 표준점수 가산점 적용
    const math_std_bonused = ctx.math_std * mathBonus;
    ctx.math_std_bonused = math_std_bonused;
    ctx.max_kor_math_std = Math.max(ctx.kor_std, math_std_bonused);
    // 백분위 가산점 적용
    let math_pct_bonused = ctx.math_pct * mathBonus;
    const scoreConfigParsed = (0, safe_parse_1.safeParse)(F.score_config, {});
    if (scoreConfigParsed?.math_bonus_cap_100 === true) {
        math_pct_bonused = Math.min(100, math_pct_bonused);
    }
    ctx.math_pct_bonused = math_pct_bonused;
    ctx.max_kor_math_pct = Math.max(ctx.kor_pct, math_pct_bonused);
    // top2_sum_scaled60_kme_inqAvg: 국, 수, 영, 탐(평균) 4개 중 상위 2개 각각 60점 환산 후 합계
    const items_pct_kme_inqAvg_for_120 = [
        Number(ctx.kor_pct || 0),
        Number(ctx.math_pct || 0),
        Number(ctx.inq_avg2_percentile || 0),
        Number(ctx.eng_pct_est || 0),
    ]
        .map((v) => Math.max(0, Math.min(100, v)))
        .sort((a, b) => b - a);
    const top1_scaled = (items_pct_kme_inqAvg_for_120[0] || 0) * 0.6;
    const top2_scaled = (items_pct_kme_inqAvg_for_120[1] || 0) * 0.6;
    ctx.top2_sum_scaled60_kme_inqAvg = top1_scaled + top2_scaled;
    // top2_kmInq_scaled_80_x_6, top2_kmInq_scaled_80_x_7
    const items_pct_kmi_for_top2_both = [
        Number(ctx.kor_pct || 0),
        Number(ctx.math_pct || 0),
        Number(ctx.inq_avg2_percentile || 0),
    ]
        .map((v) => Math.max(0, Math.min(100, v)))
        .sort((a, b) => b - a);
    const top1_val_40pct = (items_pct_kmi_for_top2_both[0] || 0) * 0.4;
    const top2_val_40pct = (items_pct_kmi_for_top2_both[1] || 0) * 0.4;
    const sum_80pct = top1_val_40pct + top2_val_40pct;
    ctx.top2_kmInq_scaled_80_x_6 = sum_80pct * 6;
    ctx.top2_kmInq_scaled_80_x_7 = sum_80pct * 7;
    // top2_sum_norm_pct_kmi2, top2_sum_raw_pct_kmi2
    const items_pct = [
        Number(ctx.kor_pct || 0),
        Number(ctx.math_pct || 0),
        Number(ctx.inq1_percentile || 0),
        Number(ctx.inq2_percentile || 0),
    ]
        .map((v) => Math.max(0, Math.min(100, v)))
        .sort((a, b) => b - a);
    ctx.top2_sum_norm_pct_kmi2 = ((items_pct[0] || 0) + (items_pct[1] || 0)) / 100;
    ctx.top2_sum_raw_pct_kmi2 = (items_pct[0] || 0) + (items_pct[1] || 0);
    // 탐구 사탐 부스트
    const tuples = inqs
        .map((t) => ({
        subject: t.subject || '',
        group: t.group || t.type || (0, normalizer_1.guessInquiryGroup)(t.subject || ''),
        conv: (0, normalizer_1.readConvertedStd)(t),
    }))
        .sort((a, b) => b.conv - a.conv);
    const inq1 = tuples[0];
    const inq2 = tuples[1];
    ctx.inq1_social_boost = inq1 && inq1.group === '사탐' ? 1.05 : 1.0;
    ctx.inq2_social_boost = inq2 && inq2.group === '사탐' ? 1.05 : 1.0;
    // top2_sum_raw_pct_kme
    const kme_scores_for_top2 = [ctx.kor_pct, ctx.math_pct, ctx.eng_grade_score].sort((a, b) => b - a);
    ctx.top2_sum_raw_pct_kme = (kme_scores_for_top2[0] || 0) + (kme_scores_for_top2[1] || 0);
    return ctx;
}
