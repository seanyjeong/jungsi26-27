# Phase 3: DB 스키마 설계

## 목표
- 27학년도 데이터 입력 시 **코딩 없이** 계산식 구현
- 사용자가 템플릿 선택 + 파라미터만 입력하면 자동으로 계산

---

## 1. 계산 패턴 분석 (50개 특수공식 기반)

| 패턴 | 설명 | 예시 대학 | 비율 |
|-----|------|---------|-----|
| `basic_ratio` | 기본 과목별 비율 적용 | 대부분 | 75% |
| `weighted_std` | 표준점수 × 가중치 합 | 서울대, 연세대 | 10% |
| `normalized` | (점수/최고점) × 배점 | 고려대, 서울시립대 | 5% |
| `top_n_select` | 상위 N개 선택 후 합/평균 | 공주대, 영남대 | 5% |
| `max_subject` | 국/수 중 높은 것 선택 | 원광대, 한국교원대 | 3% |
| `custom` | 완전 커스텀 (수식 직접) | 특수 케이스 | 2% |

---

## 2. 새로운 테이블 구조

### 2.1 calculation_templates (계산 템플릿)
```sql
CREATE TABLE calculation_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,           -- '기본비율', '가중표준점수', '정규화합산' 등
    description TEXT,
    pattern_type ENUM('basic_ratio', 'weighted_std', 'normalized', 'top_n_select', 'max_subject', 'custom'),

    -- 템플릿 파라미터 정의 (JSON)
    param_schema JSON NOT NULL,           -- 어떤 파라미터가 필요한지 정의

    -- 자동 생성 수식 템플릿
    formula_template TEXT,                -- {국어}*{국어비율} + {수학}*{수학비율} + ...

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 formula_configs 확장
```sql
ALTER TABLE formula_configs ADD COLUMN (
    -- 새 필드들
    template_id INT,                      -- 사용할 템플릿
    template_params JSON,                 -- 템플릿 파라미터 값

    -- 점수 표시용 (계산과 별도)
    display_formula TEXT,                 -- 사용자에게 보여줄 수식 설명
    display_weights JSON,                 -- {국어: 40, 수학: 30, ...}

    FOREIGN KEY (template_id) REFERENCES calculation_templates(id)
);
```

### 2.3 subject_score_types (점수 유형)
```sql
CREATE TABLE subject_score_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_name VARCHAR(20) NOT NULL,    -- '국어', '수학', '영어', '탐구', '한국사'
    score_type VARCHAR(30) NOT NULL,      -- 'std', 'percentile', 'grade', 'converted_std'
    display_name VARCHAR(50),             -- '표준점수', '백분위', '등급', '변환표준점수'
    max_score DECIMAL(5,1) DEFAULT 100,   -- 기본 최고점
    description TEXT
);
```

---

## 3. 템플릿 파라미터 스키마 예시

### 3.1 기본비율 (basic_ratio)
```json
{
  "type": "basic_ratio",
  "params": {
    "총점": { "type": "number", "default": 1000, "label": "총점" },
    "수능비율": { "type": "number", "default": 100, "label": "수능 비율(%)" },
    "국어": { "type": "number", "default": 25, "label": "국어 비율(%)" },
    "수학": { "type": "number", "default": 25, "label": "수학 비율(%)" },
    "영어": { "type": "number", "default": 25, "label": "영어 비율(%)" },
    "탐구": { "type": "number", "default": 25, "label": "탐구 비율(%)" },
    "탐구수": { "type": "number", "default": 2, "label": "반영 탐구 수" },
    "점수유형": {
      "type": "select",
      "options": ["백분위", "표준점수", "변환표준점수"],
      "default": "백분위"
    }
  }
}
```

### 3.2 상위 N개 선택 (top_n_select)
```json
{
  "type": "top_n_select",
  "params": {
    "선택과목": {
      "type": "multiselect",
      "options": ["국어", "수학", "영어", "탐구"],
      "label": "선택 대상 과목"
    },
    "선택개수": { "type": "number", "default": 3, "label": "상위 몇 개?" },
    "계산방식": {
      "type": "select",
      "options": ["평균", "합계"],
      "default": "평균"
    },
    "배수": { "type": "number", "default": 1, "label": "곱할 계수" },
    "기본점": { "type": "number", "default": 0, "label": "기본점수" }
  }
}
```

### 3.3 가중치 차등 (ranked_weights)
```json
{
  "type": "ranked_weights",
  "params": {
    "선택과목": {
      "type": "multiselect",
      "options": ["국어", "수학", "영어", "탐구"]
    },
    "가중치": {
      "type": "array",
      "items": { "type": "number" },
      "default": [0.5, 0.3, 0.2],
      "label": "1위/2위/3위 가중치"
    }
  }
}
```

---

## 4. 사용자 입력 워크플로우 (UI 흐름)

### Step 1: 기본 정보
```
대학명: [한국대학교]
학과명: [체육교육과]
모집군: [가] [나] [다]
```

### Step 2: 계산 유형 선택
```
[x] 기본 비율 적용
[ ] 상위 N개 선택
[ ] 가중치 차등 적용
[ ] 국/수 택1
[ ] 정규화 계산
[ ] 커스텀 수식
```

### Step 3: 파라미터 입력 (기본 비율 선택 시)
```
총점: [1000]점
수능 반영비율: [60]%

=== 과목별 반영비율 (합계 100%) ===
점수 유형: [백분위 ▼]

| 과목 | 비율 | 점수유형 |
|------|-----|---------|
| 국어 | [30]% | 백분위 |
| 수학 | [30]% | 백분위 |
| 영어 | [20]% | 등급환산 |
| 탐구 | [20]% | 백분위 |

탐구 반영 과목수: [2]개
```

### Step 4: 영어/한국사 등급표
```
영어 등급 환산표:
| 1등급 | 2등급 | 3등급 | ... |
| [100] | [95]  | [90]  | ... |

한국사 반영: [가/감점 ▼]
| 1등급 | 2등급 | ... |
| [10]  | [10]  | ... |
```

### Step 5: 미리보기 & 확인
```
=== 계산식 미리보기 ===
총점 1000점 × 수능 60%

국어(백분위) × 30% = 30점
수학(백분위) × 30% = 30점
영어(등급환산) × 20% = 20점
탐구(백분위, 2과목) × 20% = 20점
---
수능 환산점수 = 600점

+ 한국사 가/감점 (최대 10점)
= 최종 610점

[테스트 계산] [저장]
```

---

## 5. 마이그레이션 전략

### Phase 3-A: 기존 데이터 분석
1. 모든 특수공식을 패턴별로 분류
2. 분류 불가능한 케이스 식별 (custom으로 처리)

### Phase 3-B: 템플릿 테이블 생성
1. 6개 기본 템플릿 생성
2. 파라미터 스키마 정의

### Phase 3-C: 기존 데이터 변환
1. `기본비율` 146개 → template_id + params 자동 변환
2. `특수공식` 50개 → 패턴 매칭 후 변환, 불가능한 것은 custom

### Phase 3-D: 검증
1. 변환된 계산식으로 점수 재계산
2. 기존 결과와 100% 일치 확인

---

## 6. 27학년도 데이터 입력 가이드

### 새 학과 추가 절차
1. 대학/학과 기본정보 입력
2. 계산 템플릿 선택
3. 파라미터 입력 (비율, 점수유형 등)
4. 영어/한국사 등급표 입력
5. 테스트 학생으로 검증
6. 저장

### 기존 학과 복사
```
[26학년도 데이터 복사] 버튼
→ 변경사항만 수정
→ 검증 후 저장
```

---

## 7. 특수 케이스 처리

### 7.1 하드코딩 대학 (선문대, 경동대)
→ `custom` 템플릿 + 설명문으로 처리
→ 향후 템플릿화 검토

### 7.2 슬래시 형식 비율 (50/30/20)
→ `ranked_weights` 템플릿으로 자동 변환
→ 가중치 배열 [0.5, 0.3, 0.2]

### 7.3 변환표준점수 대학
→ 별도 변환표 테이블 연결
→ 점수유형에서 '변환표준점수' 선택 시 자동 적용
