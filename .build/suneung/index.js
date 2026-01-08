"use strict";
/**
 * 수능 계산 모듈 통합 export
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFormulaVariables = exports.validateSpecialFormula = exports.evaluateSpecialFormula = exports.buildSpecialContext = exports.guessInquiryGroup = exports.readConvertedStd = exports.resolveMaxScores = exports.calcInquiryRepresentative = exports.isSubjectUsedInRules = exports.detectEnglishAsBonus = exports.resolveTotal = exports.inquirySubjectName = exports.kmSubjectNameForMath = exports.kmSubjectNameForKorean = exports.pickByType = exports.calculateScoreWithConv = exports.calculateScore = void 0;
// 메인 계산 함수
var calculator_1 = require("./calculator");
Object.defineProperty(exports, "calculateScore", { enumerable: true, get: function () { return calculator_1.calculateScore; } });
Object.defineProperty(exports, "calculateScoreWithConv", { enumerable: true, get: function () { return calculator_1.calculateScoreWithConv; } });
// 정규화 유틸리티
var normalizer_1 = require("./normalizer");
Object.defineProperty(exports, "pickByType", { enumerable: true, get: function () { return normalizer_1.pickByType; } });
Object.defineProperty(exports, "kmSubjectNameForKorean", { enumerable: true, get: function () { return normalizer_1.kmSubjectNameForKorean; } });
Object.defineProperty(exports, "kmSubjectNameForMath", { enumerable: true, get: function () { return normalizer_1.kmSubjectNameForMath; } });
Object.defineProperty(exports, "inquirySubjectName", { enumerable: true, get: function () { return normalizer_1.inquirySubjectName; } });
Object.defineProperty(exports, "resolveTotal", { enumerable: true, get: function () { return normalizer_1.resolveTotal; } });
Object.defineProperty(exports, "detectEnglishAsBonus", { enumerable: true, get: function () { return normalizer_1.detectEnglishAsBonus; } });
Object.defineProperty(exports, "isSubjectUsedInRules", { enumerable: true, get: function () { return normalizer_1.isSubjectUsedInRules; } });
Object.defineProperty(exports, "calcInquiryRepresentative", { enumerable: true, get: function () { return normalizer_1.calcInquiryRepresentative; } });
Object.defineProperty(exports, "resolveMaxScores", { enumerable: true, get: function () { return normalizer_1.resolveMaxScores; } });
Object.defineProperty(exports, "readConvertedStd", { enumerable: true, get: function () { return normalizer_1.readConvertedStd; } });
Object.defineProperty(exports, "guessInquiryGroup", { enumerable: true, get: function () { return normalizer_1.guessInquiryGroup; } });
// 특수공식
var special_context_1 = require("./special-context");
Object.defineProperty(exports, "buildSpecialContext", { enumerable: true, get: function () { return special_context_1.buildSpecialContext; } });
var formula_eval_1 = require("./formula-eval");
Object.defineProperty(exports, "evaluateSpecialFormula", { enumerable: true, get: function () { return formula_eval_1.evaluateSpecialFormula; } });
Object.defineProperty(exports, "validateSpecialFormula", { enumerable: true, get: function () { return formula_eval_1.validateSpecialFormula; } });
Object.defineProperty(exports, "extractFormulaVariables", { enumerable: true, get: function () { return formula_eval_1.extractFormulaVariables; } });
