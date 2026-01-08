"use strict";
/**
 * 실기 계산 모듈 통합 export
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcPracticalSpecial = exports.buildPracticalScoreList = exports.convertGradeToScore = exports.lookupScore = exports.lookupDeductionLevel = exports.findMinScore = exports.findMaxScore = exports.getEventRules = exports.calculatePracticalScore = void 0;
// 메인 계산 함수
var calculator_1 = require("./calculator");
Object.defineProperty(exports, "calculatePracticalScore", { enumerable: true, get: function () { return calculator_1.calculatePracticalScore; } });
// 배점표 조회 유틸리티
var lookup_1 = require("./lookup");
Object.defineProperty(exports, "getEventRules", { enumerable: true, get: function () { return lookup_1.getEventRules; } });
Object.defineProperty(exports, "findMaxScore", { enumerable: true, get: function () { return lookup_1.findMaxScore; } });
Object.defineProperty(exports, "findMinScore", { enumerable: true, get: function () { return lookup_1.findMinScore; } });
Object.defineProperty(exports, "lookupDeductionLevel", { enumerable: true, get: function () { return lookup_1.lookupDeductionLevel; } });
Object.defineProperty(exports, "lookupScore", { enumerable: true, get: function () { return lookup_1.lookupScore; } });
Object.defineProperty(exports, "convertGradeToScore", { enumerable: true, get: function () { return lookup_1.convertGradeToScore; } });
Object.defineProperty(exports, "buildPracticalScoreList", { enumerable: true, get: function () { return lookup_1.buildPracticalScoreList; } });
// 특수 규칙 (하드코딩)
var special_rules_1 = require("./special-rules");
Object.defineProperty(exports, "calcPracticalSpecial", { enumerable: true, get: function () { return special_rules_1.calcPracticalSpecial; } });
