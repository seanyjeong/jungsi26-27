-- Migration 001: 계산 템플릿 시스템
-- 목적: 코딩 없이 계산식을 구성할 수 있는 템플릿 시스템

-- ============================================
-- 1. 계산 템플릿 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS calculation_templates (
    template_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,

    -- 템플릿 유형
    pattern_type ENUM(
        'basic_ratio',       -- 기본 비율 계산
        'weighted_std',      -- 가중 표준점수 합
        'normalized',        -- 정규화 (점수/최고점) 계산
        'top_n_select',      -- 상위 N개 선택
        'ranked_weights',    -- 가중치 차등 (50/30/20)
        'max_subject',       -- 국/수 택1
        'custom'             -- 커스텀 수식
    ) NOT NULL,

    -- 파라미터 정의 (JSON Schema 형식)
    param_schema JSON NOT NULL COMMENT '템플릿이 필요로 하는 파라미터 정의',

    -- 계산 로직 (JS 코드 또는 수식 템플릿)
    formula_template TEXT COMMENT '변수 치환용 수식 템플릿',

    -- 예시 및 도움말
    example_config JSON COMMENT '예시 설정값',
    help_text TEXT COMMENT '사용자용 설명',

    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. formula_configs 테이블 확장
-- ============================================
ALTER TABLE formula_configs
    ADD COLUMN template_id INT NULL AFTER config_id,
    ADD COLUMN template_params JSON NULL COMMENT '템플릿 파라미터 값',
    ADD COLUMN display_config JSON NULL COMMENT '표시용 설정 (요강 표시)',
    ADD COLUMN calculation_mode ENUM('template', 'legacy', 'custom') DEFAULT 'legacy',
    ADD CONSTRAINT fk_template FOREIGN KEY (template_id) REFERENCES calculation_templates(template_id);

-- ============================================
-- 3. 기본 템플릿 데이터 삽입
-- ============================================

-- 3.1 기본비율 템플릿
INSERT INTO calculation_templates (name, display_name, pattern_type, description, param_schema, help_text, sort_order) VALUES
('basic_ratio', '기본 비율 계산', 'basic_ratio',
'각 과목별 비율을 적용하여 계산합니다. 가장 일반적인 계산 방식입니다.',
'{
  "properties": {
    "국어": {"type": "number", "title": "국어 비율(%)", "default": 25, "minimum": 0, "maximum": 100},
    "수학": {"type": "number", "title": "수학 비율(%)", "default": 25, "minimum": 0, "maximum": 100},
    "영어": {"type": "number", "title": "영어 비율(%)", "default": 25, "minimum": 0, "maximum": 100},
    "탐구": {"type": "number", "title": "탐구 비율(%)", "default": 25, "minimum": 0, "maximum": 100},
    "탐구수": {"type": "number", "title": "탐구 과목수", "default": 2, "enum": [1, 2]},
    "점수유형": {"type": "string", "title": "점수 유형", "enum": ["백분위", "표준점수", "변환표준점수"], "default": "백분위"}
  },
  "required": ["국어", "수학", "영어", "탐구"]
}',
'과목별 반영비율 합이 100%가 되도록 입력하세요. 예: 국어 30%, 수학 30%, 영어 20%, 탐구 20%',
1);

-- 3.2 상위 N개 선택 템플릿
INSERT INTO calculation_templates (name, display_name, pattern_type, description, param_schema, help_text, sort_order) VALUES
('top_n_select', '상위 N개 선택', 'top_n_select',
'여러 과목 중 상위 N개를 선택하여 계산합니다.',
'{
  "properties": {
    "선택대상": {"type": "array", "title": "선택 대상 과목", "items": {"type": "string", "enum": ["국어", "수학", "영어", "탐구"]}, "default": ["국어", "수학", "영어", "탐구"]},
    "선택개수": {"type": "number", "title": "선택 개수", "default": 3, "minimum": 1, "maximum": 4},
    "계산방식": {"type": "string", "title": "계산 방식", "enum": ["평균", "합계"], "default": "평균"},
    "배수": {"type": "number", "title": "곱할 계수", "default": 1},
    "기본점": {"type": "number", "title": "기본 점수", "default": 0}
  },
  "required": ["선택대상", "선택개수"]
}',
'예: 국어, 수학, 영어, 탐구 중 상위 3개 평균 × 8.5 + 150',
2);

-- 3.3 가중치 차등 템플릿 (select_ranked_weights 호환)
INSERT INTO calculation_templates (name, display_name, pattern_type, description, param_schema, help_text, sort_order) VALUES
('ranked_weights', '가중치 차등', 'ranked_weights',
'상위 과목부터 차등 가중치를 적용합니다. (예: 1위 50%, 2위 30%, 3위 20%)',
'{
  "properties": {
    "선택대상": {"type": "array", "title": "선택 대상 과목", "items": {"type": "string"}, "default": ["국어", "수학", "영어", "탐구"]},
    "가중치": {"type": "array", "title": "순위별 가중치", "items": {"type": "number"}, "default": [0.5, 0.3, 0.2]},
    "점수유형": {"type": "string", "title": "점수 유형", "enum": ["백분위", "표준점수"], "default": "백분위"}
  },
  "required": ["선택대상", "가중치"]
}',
'상위 과목순으로 가중치가 적용됩니다. 예: [0.5, 0.3, 0.2]는 1위 50%, 2위 30%, 3위 20%',
3);

-- 3.4 국/수 택1 템플릿
INSERT INTO calculation_templates (name, display_name, pattern_type, description, param_schema, help_text, sort_order) VALUES
('max_subject', '국/수 택1 (높은 점수)', 'max_subject',
'국어와 수학 중 높은 점수를 선택하여 반영합니다.',
'{
  "properties": {
    "택1대상": {"type": "array", "title": "택1 대상", "items": {"type": "string"}, "default": ["국어", "수학"]},
    "택1비율": {"type": "number", "title": "택1 비율(%)", "default": 40},
    "영어비율": {"type": "number", "title": "영어 비율(%)", "default": 30},
    "탐구비율": {"type": "number", "title": "탐구 비율(%)", "default": 30},
    "탐구수": {"type": "number", "title": "탐구 과목수", "default": 1}
  },
  "required": ["택1대상", "택1비율"]
}',
'국어와 수학 중 점수가 높은 과목이 자동 선택됩니다.',
4);

-- 3.5 정규화 계산 템플릿
INSERT INTO calculation_templates (name, display_name, pattern_type, description, param_schema, help_text, sort_order) VALUES
('normalized', '정규화 계산', 'normalized',
'각 과목 점수를 최고점으로 나눈 후 배점을 곱합니다. (점수/최고점) × 배점',
'{
  "properties": {
    "국어배점": {"type": "number", "title": "국어 배점", "default": 200},
    "수학배점": {"type": "number", "title": "수학 배점", "default": 200},
    "영어처리": {"type": "string", "title": "영어 처리", "enum": ["등급환산", "비율적용"], "default": "등급환산"},
    "탐구배점": {"type": "number", "title": "탐구 배점", "default": 200},
    "정규화기준": {"type": "string", "title": "최고점 기준", "enum": ["연도최고점", "200점", "100점"], "default": "연도최고점"}
  }
}',
'예: (국어표준점수/147) × 200 + (수학표준점수/139) × 200 + ...',
5);

-- 3.6 가중 표준점수 합 템플릿
INSERT INTO calculation_templates (name, display_name, pattern_type, description, param_schema, help_text, sort_order) VALUES
('weighted_std', '가중 표준점수 합', 'weighted_std',
'표준점수에 가중치(계수)를 곱해서 합산합니다.',
'{
  "properties": {
    "국어계수": {"type": "number", "title": "국어 계수", "default": 1},
    "수학계수": {"type": "number", "title": "수학 계수", "default": 1},
    "탐구계수": {"type": "number", "title": "탐구 계수", "default": 1},
    "영어처리": {"type": "string", "title": "영어", "enum": ["등급환산추가", "제외"], "default": "등급환산추가"},
    "한국사처리": {"type": "string", "title": "한국사", "enum": ["등급환산추가", "가감점", "제외"], "default": "가감점"}
  }
}',
'예: 국어×1 + 수학×1.2 + 탐구×0.8 + 영어등급환산 + 한국사등급환산',
6);

-- 3.7 커스텀 수식 템플릿
INSERT INTO calculation_templates (name, display_name, pattern_type, description, param_schema, help_text, sort_order) VALUES
('custom', '커스텀 수식', 'custom',
'직접 수식을 입력합니다. 고급 사용자용.',
'{
  "properties": {
    "수식": {"type": "string", "title": "계산 수식", "description": "변수: {kor_std}, {math_std}, {eng_grade_score} 등"},
    "설명": {"type": "string", "title": "수식 설명"}
  },
  "required": ["수식"]
}',
'사용 가능한 변수: {kor_std}, {math_std}, {kor_pct}, {math_pct}, {eng_grade_score}, {inq1_std}, {inq2_std} 등',
99);

-- ============================================
-- 4. 표시용 뷰 생성
-- ============================================
CREATE OR REPLACE VIEW v_formula_display AS
SELECT
    d.dept_id,
    d.university_name,
    d.department_name,
    d.admission_group,
    y.year,
    fc.total_score,
    fc.suneung_ratio,
    ct.display_name as template_name,
    fc.template_params,
    fc.subjects_config,
    fc.selection_rules,
    fc.display_config
FROM departments d
JOIN year_configs y ON d.year_id = y.year_id
LEFT JOIN formula_configs fc ON d.dept_id = fc.dept_id
LEFT JOIN calculation_templates ct ON fc.template_id = ct.template_id;

-- ============================================
-- 5. 인덱스 추가
-- ============================================
CREATE INDEX idx_template_pattern ON calculation_templates(pattern_type);
CREATE INDEX idx_formula_template ON formula_configs(template_id);
