# 특수공식 변수 매뉴얼

특수공식은 `{변수명}` 형태로 사용합니다.

---

## 자주 쓰는 변수 (필수)

| 변수 | 설명 | 사용빈도 |
|------|------|---------|
| `{kor_std}` | 국어 표준점수 | 23회 |
| `{math_std}` | 수학 표준점수 | 14회 |
| `{kor_pct}` | 국어 백분위 | 6회 |
| `{math_pct}` | 수학 백분위 | 4회 |
| `{eng_grade_score}` | 영어 등급 환산점 | 29회 |
| `{hist_grade_score}` | 한국사 가산점 | 34회 |

---

## 탐구 변수

| 변수 | 설명 | 사용빈도 |
|------|------|---------|
| `{inq1_std}` | 탐구1 표준점수 | 6회 |
| `{inq2_std}` | 탐구2 표준점수 | 4회 |
| `{inq1_percentile}` | 탐구1 백분위 | 8회 |
| `{inq2_percentile}` | 탐구2 백분위 | 1회 |
| `{inq1_converted_std}` | 탐구1 변환표준점수 | 11회 |
| `{inq2_converted_std}` | 탐구2 변환표준점수 | 7회 |
| `{inq_avg2_percentile}` | 탐구 백분위 평균 | 5회 |
| `{inq_avg2_converted_std}` | 탐구 변환표준 평균 | 4회 |
| `{inq_sum2_converted_std}` | 탐구 변환표준 합계 | 1회 |

---

## 최고표점 변수

| 변수 | 설명 | 사용빈도 |
|------|------|---------|
| `{kor_max}` | 국어 최고표점 | 6회 |
| `{math_max}` | 수학 최고표점 | 4회 |
| `{eng_max}` | 영어 최고점 | 3회 |
| `{inq1_max_std}` | 탐구1 최고표점 | 4회 |
| `{inq2_max_std}` | 탐구2 최고표점 | 4회 |

---

## 비율 변수

| 변수 | 설명 | 사용빈도 |
|------|------|---------|
| `{suneung_ratio}` | 수능반영비율 (0~1) | 6회 |
| `{ratio_kor_norm}` | 국어 비율 (0~1) | 1회 |
| `{ratio_math_norm}` | 수학 비율 (0~1) | 1회 |
| `{ratio_inq_norm}` | 탐구 비율 (0~1) | 3회 |
| `{ratio5_kor}` | 국어 5배율 | 2회 |
| `{ratio5_math}` | 수학 5배율 | 2회 |
| `{ratio5_inq}` | 탐구 5배율 | 2회 |

---

## 선택/최댓값 변수

| 변수 | 설명 | 사용빈도 |
|------|------|---------|
| `{max_kor_math_pct}` | 국/수 백분위 중 최댓값 | 3회 |
| `{max_kor_math_std}` | 국/수 표준점수 중 최댓값 | 2회 |
| `{top1_math_or_eng_pct}` | 수학/영어 중 최댓값 | 2회 |
| `{eng_pct_est}` | 영어 백분위 추정 | 6회 |

---

## Top N 선택 변수

| 변수 | 설명 | 사용빈도 |
|------|------|---------|
| `{top2_sum_raw_pct_kme}` | 국/수/영 상위 2개 합 | 3회 |
| `{top2_sum_scaled_kme}` | 국/수/영 비율적용 상위 2개 합 | 2회 |
| `{top2_kmInq_scaled_80_x_6}` | 국/수/탐 상위2 80% × 6 | 2회 |
| `{top3_avg_pct_kme_inqAvg}` | 국/수/영/탐평균 상위 3개 평균 | 2회 |
| `{top3_avg_pct_kor_eng_math_inq1}` | 국/수/영/탐1 상위 3개 평균 | 2회 |

---

## 공식 예시 (실제 사용)

### 기본형: 표준점수 가중합
```
{kor_std} + {math_std} + {inq1_converted_std} + {inq2_converted_std} + {eng_grade_score} + {hist_grade_score}
```

### 연세대형: 스케일 적용
```
({kor_std} + {math_std} + {eng_grade_score} + {inq_avg2_converted_std}) * 850 / 600
```

### 고려대형: Top 3 평균
```
({top3_avg_pct_kme_inqAvg} * 10 + 10) * {suneung_ratio} + {hist_grade_score}
```

### 강원대형: 택1 (수학/영어)
```
({kor_pct} + {top1_math_or_eng_pct}) * 1.5 + {hist_grade_score}
```

### 정규화형: 최고표점 기준
```
({kor_std} / {kor_max}) * 200 + ({math_std} / {math_max}) * 200 + {eng_grade_score} + {hist_grade_score}
```

### 중앙대형: ratio5
```
({kor_std} * {ratio5_kor} + {math_std} * {ratio5_math} + {inq_sum2_converted_std} * {ratio5_inq} + {eng_grade_score} + {hist_grade_score}) * {suneung_ratio}
```

---

## 작성 팁

1. **변수명 정확히**: `{kor_std}` (O), `{korean_std}` (X)
2. **괄호 확인**: 연산 순서 주의
3. **기존 공식 참고**: 비슷한 대학 공식 복사 후 수정
4. **테스트 필수**: 만점/평균 학생으로 검증
