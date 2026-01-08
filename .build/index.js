"use strict";
/**
 * 정시엔진 v2 - 계산 모듈 메인 진입점
 *
 * 수능/실기 점수 계산 및 관련 유틸리티 통합 export
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeArray = exports.safeString = exports.safeInt = exports.safeNumber = exports.safeParse = exports.getHistoryGrade = exports.getEnglishGrade = exports.mapPercentileToConverted = exports.interpolateScore = exports.calcPracticalSpecial = exports.buildPracticalScoreList = exports.convertGradeToScore = exports.lookupScore = exports.lookupDeductionLevel = exports.findMinScore = exports.findMaxScore = exports.getEventRules = exports.calculatePracticalScore = exports.extractFormulaVariables = exports.validateSpecialFormula = exports.evaluateSpecialFormula = exports.buildSpecialContext = exports.guessInquiryGroup = exports.readConvertedStd = exports.resolveMaxScores = exports.calcInquiryRepresentative = exports.isSubjectUsedInRules = exports.detectEnglishAsBonus = exports.resolveTotal = exports.inquirySubjectName = exports.kmSubjectNameForMath = exports.kmSubjectNameForKorean = exports.pickByType = exports.calculateScoreWithConv = exports.calculateScore = void 0;
// ============================================
// 수능 계산
// ============================================
var index_1 = require("./suneung/index");
// 메인 계산 함수
Object.defineProperty(exports, "calculateScore", { enumerable: true, get: function () { return index_1.calculateScore; } });
Object.defineProperty(exports, "calculateScoreWithConv", { enumerable: true, get: function () { return index_1.calculateScoreWithConv; } });
// 정규화 유틸리티
Object.defineProperty(exports, "pickByType", { enumerable: true, get: function () { return index_1.pickByType; } });
Object.defineProperty(exports, "kmSubjectNameForKorean", { enumerable: true, get: function () { return index_1.kmSubjectNameForKorean; } });
Object.defineProperty(exports, "kmSubjectNameForMath", { enumerable: true, get: function () { return index_1.kmSubjectNameForMath; } });
Object.defineProperty(exports, "inquirySubjectName", { enumerable: true, get: function () { return index_1.inquirySubjectName; } });
Object.defineProperty(exports, "resolveTotal", { enumerable: true, get: function () { return index_1.resolveTotal; } });
Object.defineProperty(exports, "detectEnglishAsBonus", { enumerable: true, get: function () { return index_1.detectEnglishAsBonus; } });
Object.defineProperty(exports, "isSubjectUsedInRules", { enumerable: true, get: function () { return index_1.isSubjectUsedInRules; } });
Object.defineProperty(exports, "calcInquiryRepresentative", { enumerable: true, get: function () { return index_1.calcInquiryRepresentative; } });
Object.defineProperty(exports, "resolveMaxScores", { enumerable: true, get: function () { return index_1.resolveMaxScores; } });
Object.defineProperty(exports, "readConvertedStd", { enumerable: true, get: function () { return index_1.readConvertedStd; } });
Object.defineProperty(exports, "guessInquiryGroup", { enumerable: true, get: function () { return index_1.guessInquiryGroup; } });
// 특수공식
Object.defineProperty(exports, "buildSpecialContext", { enumerable: true, get: function () { return index_1.buildSpecialContext; } });
Object.defineProperty(exports, "evaluateSpecialFormula", { enumerable: true, get: function () { return index_1.evaluateSpecialFormula; } });
Object.defineProperty(exports, "validateSpecialFormula", { enumerable: true, get: function () { return index_1.validateSpecialFormula; } });
Object.defineProperty(exports, "extractFormulaVariables", { enumerable: true, get: function () { return index_1.extractFormulaVariables; } });
// ============================================
// 실기 계산
// ============================================
var index_2 = require("./practical/index");
// 메인 계산 함수
Object.defineProperty(exports, "calculatePracticalScore", { enumerable: true, get: function () { return index_2.calculatePracticalScore; } });
// 배점표 조회 유틸리티
Object.defineProperty(exports, "getEventRules", { enumerable: true, get: function () { return index_2.getEventRules; } });
Object.defineProperty(exports, "findMaxScore", { enumerable: true, get: function () { return index_2.findMaxScore; } });
Object.defineProperty(exports, "findMinScore", { enumerable: true, get: function () { return index_2.findMinScore; } });
Object.defineProperty(exports, "lookupDeductionLevel", { enumerable: true, get: function () { return index_2.lookupDeductionLevel; } });
Object.defineProperty(exports, "lookupScore", { enumerable: true, get: function () { return index_2.lookupScore; } });
Object.defineProperty(exports, "convertGradeToScore", { enumerable: true, get: function () { return index_2.convertGradeToScore; } });
Object.defineProperty(exports, "buildPracticalScoreList", { enumerable: true, get: function () { return index_2.buildPracticalScoreList; } });
// 특수 규칙
Object.defineProperty(exports, "calcPracticalSpecial", { enumerable: true, get: function () { return index_2.calcPracticalSpecial; } });
// ============================================
// 공통 유틸리티
// ============================================
var index_3 = require("./utils/index");
// 등급컷 보간
Object.defineProperty(exports, "interpolateScore", { enumerable: true, get: function () { return index_3.interpolateScore; } });
Object.defineProperty(exports, "mapPercentileToConverted", { enumerable: true, get: function () { return index_3.mapPercentileToConverted; } });
Object.defineProperty(exports, "getEnglishGrade", { enumerable: true, get: function () { return index_3.getEnglishGrade; } });
Object.defineProperty(exports, "getHistoryGrade", { enumerable: true, get: function () { return index_3.getHistoryGrade; } });
// 안전 파싱
Object.defineProperty(exports, "safeParse", { enumerable: true, get: function () { return index_3.safeParse; } });
Object.defineProperty(exports, "safeNumber", { enumerable: true, get: function () { return index_3.safeNumber; } });
Object.defineProperty(exports, "safeInt", { enumerable: true, get: function () { return index_3.safeInt; } });
Object.defineProperty(exports, "safeString", { enumerable: true, get: function () { return index_3.safeString; } });
Object.defineProperty(exports, "safeArray", { enumerable: true, get: function () { return index_3.safeArray; } });
