# 정시엔진 v2 API 명세서

> 최종 업데이트: 2026-01-08

## Base URL
- 개발: `http://localhost:3000`
- 운영: TBD

---

## 1. 인증 API

### POST /api/auth/login
원장/강사 로그인

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "name": "홍길동",
    "role": "director",
    "branch_id": 1
  },
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

### POST /api/auth/logout
로그아웃 (세션 무효화)

### POST /api/auth/refresh
토큰 갱신

### GET /api/auth/me
현재 로그인 사용자 정보

---

## 2. 점수 계산 API

### POST /api/calculate/suneung
수능 점수 계산

**Request Body:**
```json
{
  "deptId": 335,
  "scores": {
    "korean": { "std": 131, "pct": 95 },
    "math": { "std": 140, "pct": 98, "type": "미적분" },
    "english": { "grade": 2 },
    "inquiry1": { "std": 68, "pct": 96, "subject": "생명과학1" },
    "inquiry2": { "std": 65, "pct": 92, "subject": "지구과학1" },
    "history": { "grade": 3 }
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "totalScore": 892.5,
    "breakdown": {
      "korean": 248.2,
      "math": 280.0,
      "english": 195.0,
      "inquiry": 169.3,
      "history": 0
    },
    "bonuses": {
      "history": 10.0,
      "mathType": 5.0
    }
  }
}
```

### POST /api/calculate/practical
실기 점수 계산

**Request Body:**
```json
{
  "deptId": 335,
  "gender": "남",
  "records": {
    "100m": 11.5,
    "제자리멀리뛰기": 2.85,
    "메디신볼던지기": 12.5
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "totalScore": 285.0,
    "breakdown": {
      "100m": 95.0,
      "제자리멀리뛰기": 95.0,
      "메디신볼던지기": 95.0
    }
  }
}
```

---

## 3. 데이터 조회 API

### GET /api/years
연도 목록 조회

**Response:**
```json
{
  "years": [
    { "year_id": 2026, "is_active": true },
    { "year_id": 2027, "is_active": false }
  ]
}
```

### GET /api/universities?year=2026
대학 목록 조회

### GET /api/departments?year=2026&univ_id=1
학과 목록 조회

**Query Parameters:**
- `year` (required): 학년도
- `univ_id` (optional): 대학 필터

**Response:**
```json
{
  "departments": [
    {
      "dept_id": 335,
      "univ_name": "가천대학교",
      "dept_name": "체육학과",
      "모집군": "가",
      "모집인원": 10
    }
  ]
}
```

---

## 4. 학생 관리 API

### GET /api/students
학생 목록 조회

### GET /api/students/:id
학생 상세 조회

### GET /api/students/:id/scores
학생 성적 조회

### POST /api/students/:id/scores
학생 성적 등록/수정

---

## 5. 엑셀 내보내기/가져오기 API

### GET /api/export/excel?year=2026
연도별 데이터 엑셀 내보내기

**Query Parameters:**
- `year` (required): 학년도 (예: 2026, 2027)

**Response:**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- 파일명: `{year}학년도_정시데이터.xlsx`

**엑셀 시트 구성:**

| 시트명 | 설명 | 주요 컬럼 |
|--------|------|----------|
| 기본정보_과목비율 | 학과별 기본 설정 | dept_id, 대학명, 학과명, 모집군, 모집인원, **삭제**, 총점, 수능비율, 국어비율~한국사비율, legacy_uid |
| 특수공식 | 특수 계산 공식 | dept_id, 대학명, 학과명, 특수공식, legacy_uid |
| 영어등급표 | 영어 등급별 환산점수 | dept_id, 대학명, 학과명, 1등급~9등급 |
| 한국사등급표 | 한국사 등급별 환산점수 | dept_id, 대학명, 학과명, 1등급~9등급 |
| 실기배점 | 종목별 실기 배점표 | dept_id, 대학명, 학과명, 종목명, 성별, 기록, 점수 |

**학과 관리 기능:**

| 작업 | 방법 |
|------|------|
| 학과명 변경 | `학과명` 컬럼 수정 |
| 모집군 변경 | `모집군` 컬럼 수정 (가/나/다) |
| 모집인원 변경 | `모집인원` 컬럼 수정 |
| **신규 학과 추가** | `dept_id` 비우고 `대학명`+`학과명` 입력 |
| **학과 삭제** | `삭제` 컬럼에 `Y` 입력 |

### POST /api/import/excel
엑셀 데이터 업로드

**Request:**
- Content-Type: `multipart/form-data`

**Form Fields:**
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| file | File | O | 엑셀 파일 (.xlsx) |
| year | number | O | 대상 학년도 |
| dryRun | boolean | X | true면 검증만 수행 (기본: false) |
| changedBy | string | X | 변경자 식별 (기본: system) |

**Response:**
```json
{
  "success": true,
  "summary": {
    "기본정보": { "updated": 195, "inserted": 2, "deleted": 1 },
    "특수공식": { "updated": 0 },
    "영어등급표": { "updated": 183, "inserted": 0 },
    "한국사등급표": { "updated": 107, "inserted": 0 },
    "실기배점": { "updated": 0, "inserted": 14991, "deleted": 14991 }
  },
  "errors": [],
  "dryRun": false,
  "message": "업로드 완료"
}
```

**검증 규칙:**
- `dept_id` 또는 `대학명`+`학과명` 필수 (신규 학과는 dept_id 없이 가능)
- 비율 값은 0~100 사이
- 등급 점수는 1등급 > 9등급 순서 (경고만, 에러 아님)

---

## 6. 변경 이력 API

### GET /api/change-logs
변경 이력 조회 (페이지네이션 지원)

**Query Parameters:**
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| page | number | X | 페이지 번호 (기본: 1) |
| limit | number | X | 페이지당 항목 수 (기본: 20, 최대: 100) |
| table_name | string | X | 테이블명 필터 (formula_configs, practical_score_tables 등) |
| action | string | X | 액션 필터 (INSERT, UPDATE, DELETE) |
| changed_by | string | X | 변경자 필터 |
| from | string | X | 시작일 (YYYY-MM-DD) |
| to | string | X | 종료일 (YYYY-MM-DD) |
| dept_id | number | X | 학과 ID 필터 |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "log_id": 835,
      "table_name": "formula_configs",
      "record_id": 335,
      "action": "UPDATE",
      "old_values": { ... },
      "new_values": { ... },
      "changed_by": "admin",
      "changed_at": "2026-01-08T14:34:45.000Z",
      "dept_info": {
        "univ_name": "가천대학교",
        "dept_name": "운동재활학과"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 835,
    "totalPages": 42,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**테이블 구조:**
```sql
CREATE TABLE change_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id INT NOT NULL,
  action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  old_values JSON,
  new_values JSON,
  changed_by VARCHAR(50),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. 에러 응답

모든 API는 에러 시 다음 형식으로 응답:

```json
{
  "error": "에러 메시지",
  "details": "상세 내용 (선택)"
}
```

**HTTP 상태 코드:**
- 200: 성공
- 400: 잘못된 요청
- 401: 인증 필요
- 403: 권한 없음
- 404: 리소스 없음
- 500: 서버 오류

---

## 8. 테스트 명령어

```bash
# 엑셀 내보내기 테스트
curl -o test.xlsx "http://localhost:3000/api/export/excel?year=2026"

# 엑셀 가져오기 테스트 (검증만)
curl -X POST "http://localhost:3000/api/import/excel" \
  -F "file=@test.xlsx" \
  -F "year=2026" \
  -F "dryRun=true"

# 엑셀 가져오기 (실제 저장)
curl -X POST "http://localhost:3000/api/import/excel" \
  -F "file=@test.xlsx" \
  -F "year=2026" \
  -F "dryRun=false" \
  -F "changedBy=admin"
```

---

## 부록: DB 테이블 요약

| 테이블 | 용도 | 주요 컬럼 |
|--------|------|----------|
| `universities` | 대학 정보 | univ_id, univ_name |
| `departments` | 학과 정보 | dept_id, univ_id, year_id, dept_name, 모집군, 모집인원 |
| `formula_configs` | 계산 공식 | dept_id, total_score, suneung_ratio, subjects_config(JSON), english_scores(JSON), history_scores(JSON), legacy_formula, legacy_uid |
| `practical_score_tables` | 실기 배점 | dept_id, 종목명, 성별, 기록, 점수 |
| `users` | 사용자 | id, username, password_hash, name, role, branch_id |
| `change_logs` | 변경 이력 | log_id, table_name, record_id, action, old_values, new_values |
