# 정시엔진 v2 - 프로젝트 계획서

## 현재 상황

### 기존 시스템 (cafe24)
- **maxjungsi222**: HTML/JS 기반 학생 상담 시스템
- **jungsi.js**: Express 백엔드 (supermax.kr/jungsi/*)
- **jungsi DB**: cafe24 MySQL

### 신규 시스템 (univjungsi)
- **기술스택**: Next.js 16 + TypeScript + MySQL
- **배포**:
  - 백엔드: `https://jungsi.sean8320.dedyn.io` (로컬서버 systemd)
  - 프론트: `https://jungsi.vercel.app` (Vercel)

---

## 목표

### 1. 데이터 관리 시스템 (완료 ✅)
27학년도 데이터를 **비개발자도 엑셀로 쉽게 업데이트** 가능하게

- `/dashboard/excel` - 엑셀 업로드/다운로드
- `/dashboard/history` - 변경 이력 추적

### 2. 학생 상담 시스템 (만들어야 함 🔨)
maxjungsi222의 기능을 **새 디자인 + TypeScript 엔진**으로 재구현

---

## 필요한 페이지 (프론트엔드)

| 페이지 | 경로 | 기능 | 참고 (기존) |
|--------|------|------|-------------|
| 학생 관리 | `/dashboard/students` | 학생 추가/수정/삭제, 목록 조회 | add_student.html |
| 성적 입력 | `/dashboard/scores` | 수능 성적 일괄 입력 (공식/가채점) | score_input.html |
| 개인별 상담 | `/dashboard/counsel` | 학생별 대학/학과 점수 계산, 등급컷 비교 | counsel.html |
| 통합 계산기 | `/dashboard/calculator` | 군/대학/학과별 여러 학생 비교 | calculator.html |
| 최종 지원 | `/dashboard/apply` | 가/나/다군 최종 지원 대학 입력 | final_apply.html |

---

## 핵심 기능 상세

### 개인별 상담 (counsel)
1. 학생 선택 → 수능 성적 표시
2. 대학/학과 필터링 (가/나/다군)
3. 각 학과별 점수 계산:
   - 수능 환산점수
   - 실기 점수 (종목별 기록 입력)
   - 총점
4. 등급컷 비교 (지점/전체)
5. 위시리스트 저장
6. PDF 출력

### 통합 계산기 (calculator)
1. 군 → 대학 → 학과 선택
2. 해당 학과에 지원 가능한 학생들 표시
3. 점수 순 정렬
4. 여러 학생 동시 비교

### 최종 지원 (apply)
1. 학생별 가/나/다군 지원 대학 선택
2. 실기 점수 입력
3. 예상 결과 기록 (합격/불합격/예비)

---

## 백엔드 API 현황

### 완료된 API ✅
| 엔드포인트 | 메서드 | 기능 |
|------------|--------|------|
| `/api/students` | GET | 학생 목록 |
| `/api/students` | POST | 학생 등록 |
| `/api/students/[id]/scores` | GET | 성적 조회 |
| `/api/students/[id]/scores` | PUT | 성적 저장 |
| `/api/calculate/suneung` | POST | 수능 점수 계산 |
| `/api/calculate/practical` | POST | 실기 점수 계산 |
| `/api/departments` | GET | 학과 목록 |
| `/api/universities` | GET | 대학 목록 |
| `/api/years` | GET | 학년도 목록 |
| `/api/export/excel` | GET | 엑셀 다운로드 |
| `/api/import/excel` | POST | 엑셀 업로드 |

### 추가 필요 API 🔨
| 엔드포인트 | 메서드 | 기능 |
|------------|--------|------|
| `/api/students/[id]` | PUT | 학생 정보 수정 |
| `/api/students/[id]` | DELETE | 학생 삭제 |
| `/api/counseling/wishlist` | GET/POST | 상담 위시리스트 |
| `/api/apply` | GET/POST/PUT | 최종 지원 저장 |
| `/api/scores/bulk` | PUT | 성적 일괄 저장 |

---

## 데이터베이스 스키마

### 주요 테이블
```
students (학생)
├── student_id, year_id, branch_name, student_name
├── school_name, gender, phone, parent_phone

student_scores (성적)
├── 국어_선택과목, 국어_표준점수, 국어_백분위, 국어_등급
├── 수학_선택과목, 수학_표준점수, 수학_백분위, 수학_등급
├── 영어_등급, 한국사_등급
├── 탐구1_과목명, 탐구1_표준점수, 탐구1_백분위, 탐구1_등급
├── 탐구2_과목명, 탐구2_표준점수, 탐구2_백분위, 탐구2_등급
├── practical_records (JSON)

counseling_wishlist (위시리스트)
├── student_id, dept_id, priority, memo

departments (학과)
├── dept_id, univ_id, year_id, dept_name, 모집군, 모집인원

formula_configs (계산 공식)
├── dept_id, subjects_config (JSON), 계산유형, 특수공식
```

---

## 디자인 가이드

- **UI 프레임워크**: shadcn/ui (현재 사용 중)
- **스타일**: Tailwind CSS
- **디자인 방향**:
  - 기존 maxjungsi222보다 깔끔하고 현대적인 UI
  - 모바일 반응형 지원
  - 다크모드 지원 (선택)

---

## 참고 파일

### 기존 프론트엔드 (참고용)
- `/home/sean/maxjungsi222/counsel.html` - 개인별 상담
- `/home/sean/maxjungsi222/calculator.html` - 통합 계산기
- `/home/sean/maxjungsi222/score_input.html` - 성적 입력
- `/home/sean/maxjungsi222/add_student.html` - 학생 관리
- `/home/sean/maxjungsi222/final_apply.html` - 최종 지원

### 계산 엔진
- `/home/sean/univjungsi/src/lib/calculator/` - TypeScript 계산 엔진
- `/home/sean/maxjungsi222/jungsical.js` - 기존 수능 계산 (참고)
- `/home/sean/maxjungsi222/silgical.js` - 기존 실기 계산 (참고)

---

## 작업 순서 (제안)

1. **백엔드 API 완성**
   - 학생 수정/삭제 API
   - 위시리스트 API
   - 최종지원 API
   - 성적 일괄저장 API

2. **프론트엔드 재구축**
   - 학생 관리 페이지
   - 성적 입력 페이지
   - 개인별 상담 페이지
   - 통합 계산기 페이지
   - 최종 지원 페이지

3. **테스트 및 검증**
   - 기존 시스템과 점수 계산 결과 비교
   - 실제 데이터로 테스트

---

## 메모

- Vercel 프론트는 API를 `jungsi.sean8320.dedyn.io`로 프록시함 (vercel.json)
- 로그인: sean8320 / 8320, admin / admin1234
- 기존 비밀번호는 bcrypt 호환 안됨 (재설정 필요)
