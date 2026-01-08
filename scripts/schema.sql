-- univjungsi Database Schema v2.0
-- 정시 시스템 리팩토링 - 연도 관리 최적화

USE univjungsi;

-- =============================================
-- 1. 연도 설정 테이블 (핵심)
-- =============================================
CREATE TABLE IF NOT EXISTS year_configs (
    year_id INT PRIMARY KEY,              -- 2026, 2027...
    is_active BOOLEAN DEFAULT FALSE,      -- 현재 활성 연도
    data_copied_from INT DEFAULT NULL,    -- 어떤 연도에서 복사했는지
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 2. 대학 마스터 테이블 (연도 무관)
-- =============================================
CREATE TABLE IF NOT EXISTS universities (
    univ_id INT AUTO_INCREMENT PRIMARY KEY,
    univ_name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50),               -- 약칭
    region VARCHAR(50),                   -- 지역 (서울, 경기 등)
    logo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_univ_name (univ_name),
    INDEX idx_region (region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 3. 학과 연도별 정보 (매년 변경되는 데이터)
-- =============================================
CREATE TABLE IF NOT EXISTS departments (
    dept_id INT AUTO_INCREMENT PRIMARY KEY,
    univ_id INT NOT NULL,
    year_id INT NOT NULL,

    -- 기본 정보
    dept_name VARCHAR(100) NOT NULL,      -- 학과명
    모집군 ENUM('가', '나', '다') NOT NULL,
    모집인원 INT DEFAULT 0,
    형태 VARCHAR(50),                     -- 일반, 실기 등
    교직 VARCHAR(50),
    단계별 VARCHAR(50),

    -- 메타
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (univ_id) REFERENCES universities(univ_id) ON DELETE CASCADE,
    FOREIGN KEY (year_id) REFERENCES year_configs(year_id) ON DELETE CASCADE,
    UNIQUE KEY uk_dept_year (univ_id, year_id, dept_name, 모집군),
    INDEX idx_year (year_id),
    INDEX idx_gun (모집군)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 4. 계산식 설정 (새로운 JSON 기반 구조)
-- =============================================
CREATE TABLE IF NOT EXISTS formula_configs (
    config_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_id INT NOT NULL,

    -- 기본 설정
    total_score INT DEFAULT 1000,         -- 총점
    suneung_ratio DECIMAL(5,2) DEFAULT 100.00, -- 수능 비율 (%)

    -- 과목별 설정 (JSON)
    subjects_config JSON,
    /*
    예시:
    {
        "korean": {"enabled": true, "ratio": 25, "source_type": "pct", "normalization": {"method": "fixed_100"}},
        "math": {"enabled": true, "ratio": 25, "source_type": "std", "normalization": {"method": "highest_of_year"}},
        "english": {"enabled": true, "ratio": 25, "source_type": "grade_conv"},
        "inquiry": {"enabled": true, "ratio": 25, "count": 2, "source_type": "conv_std"},
        "history": {"mode": "bonus", "grade_table": {"1": 10, "2": 10, "3": 8}}
    }
    */

    -- 선택 규칙 (JSON)
    selection_rules JSON,
    /*
    예시:
    [
        {"type": "select_n", "from": ["korean", "math", "english", "inquiry"], "count": 3}
    ]
    */

    -- 가산점 규칙 (JSON)
    bonus_rules JSON,
    /*
    예시:
    [
        {"type": "percent", "target": "math", "condition": {"field": "subject", "values": ["미적분", "기하"]}, "value": 0.1}
    ]
    */

    -- 특수 모드 (등급 기반 등)
    special_mode JSON,
    /*
    예시 (선문대):
    {
        "type": "grade_based",
        "subjects": ["korean", "math", "english", "inquiry"],
        "select_count": 2,
        "grade_table": {"1": 100, "2": 93, "3": 86, ...}
    }
    */

    -- 레거시 호환 (마이그레이션 기간 동안)
    legacy_formula TEXT,                  -- 기존 특수공식 (이관 후 제거)

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE CASCADE,
    UNIQUE KEY uk_dept (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 5. 영어 등급 환산표
-- =============================================
CREATE TABLE IF NOT EXISTS english_grade_tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dept_id INT NOT NULL,
    grade TINYINT NOT NULL,               -- 1~9
    score DECIMAL(6,2) NOT NULL,

    FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE CASCADE,
    UNIQUE KEY uk_dept_grade (dept_id, grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 6. 한국사 등급 환산표
-- =============================================
CREATE TABLE IF NOT EXISTS history_grade_tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dept_id INT NOT NULL,
    grade TINYINT NOT NULL,               -- 1~9
    score DECIMAL(6,2) NOT NULL,

    FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE CASCADE,
    UNIQUE KEY uk_dept_grade (dept_id, grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 7. 탐구 변환표준점수 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS inquiry_conv_tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dept_id INT NOT NULL,
    계열 ENUM('사탐', '과탐') NOT NULL,
    백분위 TINYINT NOT NULL,              -- 0~100
    변환표준점수 DECIMAL(6,2) NOT NULL,

    FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE CASCADE,
    UNIQUE KEY uk_dept_type_pct (dept_id, 계열, 백분위),
    INDEX idx_dept (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 8. 실기 배점표
-- =============================================
CREATE TABLE IF NOT EXISTS practical_score_tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dept_id INT NOT NULL,
    종목명 VARCHAR(50) NOT NULL,
    성별 ENUM('남', '여', '공통') DEFAULT '공통',
    기록 VARCHAR(50) NOT NULL,            -- 기록값 (초, cm 등)
    점수 DECIMAL(6,2) NOT NULL,

    FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE CASCADE,
    INDEX idx_dept_event (dept_id, 종목명)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 9. 최고표점 (연도/모형별)
-- =============================================
CREATE TABLE IF NOT EXISTS highest_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year_id INT NOT NULL,
    모형 ENUM('3월', '6월', '9월', '수능') NOT NULL,
    과목명 VARCHAR(50) NOT NULL,
    최고점 DECIMAL(6,2) NOT NULL,

    FOREIGN KEY (year_id) REFERENCES year_configs(year_id) ON DELETE CASCADE,
    UNIQUE KEY uk_year_exam_subj (year_id, 모형, 과목명)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 10. 예상 등급컷
-- =============================================
CREATE TABLE IF NOT EXISTS grade_cuts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    year_id INT NOT NULL,
    모형 ENUM('3월', '6월', '9월', '수능') NOT NULL,
    선택과목명 VARCHAR(50) NOT NULL,
    등급 TINYINT NOT NULL,
    원점수 DECIMAL(6,2),
    표준점수 DECIMAL(6,2),
    백분위 DECIMAL(6,2),

    FOREIGN KEY (year_id) REFERENCES year_configs(year_id) ON DELETE CASCADE,
    UNIQUE KEY uk_year_exam_subj_grade (year_id, 모형, 선택과목명, 등급),
    INDEX idx_year_exam (year_id, 모형)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 11. 학생 기본 정보
-- =============================================
CREATE TABLE IF NOT EXISTS students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    year_id INT NOT NULL,
    branch_name VARCHAR(50) NOT NULL,     -- 지점명

    student_name VARCHAR(50) NOT NULL,
    school_name VARCHAR(100),             -- 고등학교명
    gender ENUM('남', '여'),
    phone VARCHAR(20),
    parent_phone VARCHAR(20),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (year_id) REFERENCES year_configs(year_id) ON DELETE CASCADE,
    INDEX idx_year_branch (year_id, branch_name),
    INDEX idx_name (student_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 12. 학생 수능 성적
-- =============================================
CREATE TABLE IF NOT EXISTS student_scores (
    score_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,

    -- 국어
    국어_선택과목 VARCHAR(20),
    국어_표준점수 DECIMAL(6,2),
    국어_백분위 DECIMAL(6,2),
    국어_등급 TINYINT,

    -- 수학
    수학_선택과목 VARCHAR(20),
    수학_표준점수 DECIMAL(6,2),
    수학_백분위 DECIMAL(6,2),
    수학_등급 TINYINT,

    -- 영어
    영어_등급 TINYINT,

    -- 한국사
    한국사_등급 TINYINT,

    -- 탐구1
    탐구1_과목명 VARCHAR(50),
    탐구1_표준점수 DECIMAL(6,2),
    탐구1_백분위 DECIMAL(6,2),
    탐구1_등급 TINYINT,

    -- 탐구2
    탐구2_과목명 VARCHAR(50),
    탐구2_표준점수 DECIMAL(6,2),
    탐구2_백분위 DECIMAL(6,2),
    탐구2_등급 TINYINT,

    -- 실기 기록 (JSON)
    practical_records JSON,
    /*
    예시:
    {
        "100m": "12.5",
        "제자리멀리뛰기": "285",
        "메디신볼던지기": "12.3"
    }
    */

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    UNIQUE KEY uk_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 13. 상담 목록 (학생별 지원 희망 대학)
-- =============================================
CREATE TABLE IF NOT EXISTS counseling_wishlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    dept_id INT NOT NULL,
    모집군 ENUM('가', '나', '다') NOT NULL,

    -- 상담 시점 점수 (스냅샷)
    상담_수능점수 DECIMAL(8,2),
    상담_실기점수 DECIMAL(8,2),
    상담_총점 DECIMAL(8,2),

    -- 메모
    memo TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE CASCADE,
    UNIQUE KEY uk_student_dept_gun (student_id, dept_id, 모집군),
    INDEX idx_student (student_id),
    INDEX idx_dept (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 14. 디버그 메모 (대학별 검증 상태)
-- =============================================
CREATE TABLE IF NOT EXISTS debug_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dept_id INT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    memo TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (dept_id) REFERENCES departments(dept_id) ON DELETE CASCADE,
    UNIQUE KEY uk_dept (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 15. 군이동 기록
-- =============================================
CREATE TABLE IF NOT EXISTS group_changes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    univ_id INT NOT NULL,
    dept_name VARCHAR(100) NOT NULL,
    from_year INT NOT NULL,
    to_year INT NOT NULL,
    from_group ENUM('가', '나', '다') NOT NULL,
    to_group ENUM('가', '나', '다') NOT NULL,
    applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (univ_id) REFERENCES universities(univ_id) ON DELETE CASCADE,
    INDEX idx_to_year (to_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 초기 데이터: 2026 연도 설정
-- =============================================
INSERT INTO year_configs (year_id, is_active) VALUES (2026, TRUE)
ON DUPLICATE KEY UPDATE is_active = TRUE;

-- 완료 메시지
SELECT 'Schema created successfully!' AS message;
