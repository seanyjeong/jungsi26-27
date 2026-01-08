# 정시엔진 v2 (univjungsi)

## 왜 리팩토링을 하는가?

### 현재 상황 (26학년도)
- cafe24 서버의 기존 정시 계산 엔진이 **정상 작동 중**
- 하드코딩된 JavaScript 로직으로 점수 계산
- 연도별 모집요강 변경 시 **개발자가 직접 코드 수정 필요**

### 문제점
1. **연도별 업데이트가 어려움**: 27학년도 모집요강 발표 시 개발자가 직접 코드 수정
2. **비개발자 접근 불가**: 원장/강사가 데이터 수정 불가, 개발자 의존
3. **유지보수 어려움**: JavaScript 하드코딩, 테스트 없음

### 리팩토링 목표
1. **비개발자도 데이터 업데이트 가능**: 엑셀로 학과 정보, 비율, 등급표 수정
2. **연도별 업데이트 용이**: 27학년도 데이터를 엑셀로 업로드만 하면 됨
3. **동일한 점수 계산 결과**: 기존 엔진과 100% 동일한 점수 산출 (1249건 검증 완료)
4. **유지보수성 향상**: TypeScript + 31개 테스트 + 변경 이력 추적

---

## 기술 스택
- **프레임워크**: Next.js 16.1.1 (React 19)
- **언어**: TypeScript
- **DB**: MySQL (로컬 univjungsi)
- **테스트**: Vitest (31개 테스트)
- **스타일**: Tailwind CSS 4

---

## 디렉토리 구조
```
src/
├── lib/
│   ├── db.ts                    # DB 연결
│   ├── calculator/              # 점수 계산 엔진
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── suneung/             # 수능 점수 계산 (13 tests)
│   │   ├── practical/           # 실기 점수 계산 (18 tests)
│   │   └── utils/
│   └── auth/                    # 인증 시스템
├── app/
│   └── api/                     # API Routes
│       ├── auth/                # 로그인/로그아웃
│       ├── calculate/           # 점수 계산
│       ├── export/excel/        # 엑셀 내보내기
│       ├── import/excel/        # 엑셀 가져오기
│       ├── change-logs/         # 변경 이력
│       └── ...
docs/
└── API.md                       # API 명세서 (프론트엔드용)
```

---

## 개발 명령어
```bash
# 개발 서버
npm run dev

# 테스트
npm test              # 전체 테스트 (31개)
npm run test:watch    # watch 모드

# 빌드
npm run build

# 연도 관리 CLI
npm run year:list     # 연도 목록
npm run year:create   # 새 연도 생성
npm run year:activate # 연도 활성화
```

---

## 엑셀 업로드 워크플로우 (27학년도 업데이트 방법)

### 1. 기존 데이터 내보내기
```bash
curl -o 2026_data.xlsx "http://localhost:3000/api/export/excel?year=2026"
```

### 2. 엑셀에서 수정
| 작업 | 방법 |
|------|------|
| 학과명 변경 | `학과명` 컬럼 수정 |
| 모집군 변경 (가→나) | `모집군` 컬럼 수정 |
| 모집인원 변경 | `모집인원` 컬럼 수정 |
| 비율 변경 | `국어비율`, `수학비율` 등 수정 |
| 신규 학과 추가 | `dept_id` 비우고 `대학명`+`학과명` 입력 |
| 학과 삭제 | `삭제` 컬럼에 `Y` 입력 |
| 영어 등급표 수정 | `영어등급표` 시트에서 수정 |
| 실기 배점 수정 | `실기배점` 시트에서 수정 |

### 3. 업로드 (검증만)
```bash
curl -X POST "http://localhost:3000/api/import/excel" \
  -F "file=@2027_data.xlsx" \
  -F "year=2027" \
  -F "dryRun=true"
```

### 4. 업로드 (실제 저장)
```bash
curl -X POST "http://localhost:3000/api/import/excel" \
  -F "file=@2027_data.xlsx" \
  -F "year=2027" \
  -F "changedBy=admin"
```

### 5. 변경 이력 확인
모든 변경은 `change_logs` 테이블에 기록됨.

---

## 현재 진행 상황

### 완료된 Phase
- [x] **Phase 1**: 계산 엔진 TypeScript 재작성 (31 tests 통과)
- [x] **Phase 2**: 점수 검증 (cafe24 원본과 1249건 100% 일치)
- [x] **Phase 3**: DB 스키마 보완 (JSON 필드, 규칙 테이블)
- [x] **Phase 4**: 인증 시스템 (JWT, 61명 사용자)
- [x] **Phase 5**: API 구조 (점수 계산, 학생 관리)
- [x] **Phase 6**: 27학년도 워크플로우 (백엔드 완료)
  - [x] 엑셀 내보내기 API
  - [x] 엑셀 업로드 API (학과 추가/수정/삭제 지원)
  - [x] 검증 로직
  - [x] 변경 이력 테이블

### 대기 중 (프론트엔드)
- [ ] 엑셀 업로드 UI 페이지
- [ ] 데이터 편집 대시보드
- [ ] 변경 이력 조회 UI

---

## 주요 API 엔드포인트

| API | 설명 |
|-----|------|
| `GET /api/export/excel?year=2026` | 엑셀 내보내기 (5개 시트) |
| `POST /api/import/excel` | 엑셀 업로드 (multipart/form-data) |
| `POST /api/calculate/suneung` | 수능 점수 계산 |
| `POST /api/calculate/practical` | 실기 점수 계산 |
| `GET /api/change-logs` | 변경 이력 조회 |
| `POST /api/auth/login` | 로그인 |

**상세 명세**: `docs/API.md` 참조

---

## 엑셀 시트 구조

| 시트명 | 주요 컬럼 | 수정 가능 |
|--------|----------|----------|
| 기본정보_과목비율 | dept_id, 대학명, 학과명, 모집군, 모집인원, 삭제, 비율들 | O |
| 특수공식 | dept_id, 특수공식 | O |
| 영어등급표 | dept_id, 1등급~9등급 | O |
| 한국사등급표 | dept_id, 1등급~9등급 | O |
| 실기배점 | dept_id, 종목명, 성별, 기록, 점수 | O |

---

## 기술 노트

### 등급표 저장 방식
- 영어/한국사 등급표는 `formula_configs.english_scores`, `history_scores` **JSON 필드**에 저장
- 키는 문자열 `'1'`~`'9'` (숫자 아님)
- 예: `{"1": 100, "2": 95, "3": 90, ...}`

### 특수공식 (하드코딩)
대부분은 비율 변경으로 해결. 특수공식이 필요한 경우 개발자 연락.
- **수능**: U_ID 76(경동대), 148-149(선문대)
- **실기**: U_ID 2, 3, 13, 16, 17, 19, 69-70, 99, 121, 146-147, 151-153, 160, 175, 184, 186, 189, 194, 197, 199

### 검증 규칙
- 비율 합계 100% 검증: **비활성화** (가산점/특수공식으로 100% 아닌 경우 많음)
- 등급 순서 검증: **경고만** (에러 아님)

---

## 환경 변수 (.env.local)
```
DB_HOST=localhost
DB_USER=paca
DB_PASSWORD=***
DB_NAME=univjungsi
JWT_SECRET=***
NEXT_PUBLIC_CURRENT_YEAR=2026
```

---

## 참조 문서
- **API 명세서**: `docs/API.md`
- **원본 수능 계산**: `js/jungsical.js`
- **원본 실기 계산**: `js/silgical.js`
