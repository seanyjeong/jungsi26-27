#!/bin/bash
# cafe24 SSH에서 실행: bash cafe24-export.sh
# 결과: grade_tables_export.json

echo "영어/한국사 등급표 데이터 추출 중..."

mysql -u maxilsan -p'q141171616!' jungsi -N -e "
SELECT CONCAT('[', GROUP_CONCAT(
    JSON_OBJECT(
        'U_ID', U_ID,
        'univ', 대학,
        'dept', 학과,
        'year', 학년도,
        'english_scores', IFNULL(english_scores, '{}'),
        'history_scores', IFNULL(history_scores, '{}')
    )
    SEPARATOR ','
), ']')
FROM 정시반영비율
WHERE 학년도 = 2026
  AND (
    (english_scores IS NOT NULL AND english_scores != '' AND english_scores != '{}')
    OR (history_scores IS NOT NULL AND history_scores != '' AND history_scores != '{}')
  );
" > grade_tables_export.json 2>/dev/null

if [ -f grade_tables_export.json ]; then
    COUNT=$(cat grade_tables_export.json | grep -o '"U_ID"' | wc -l)
    echo "완료! ${COUNT}개 학과 데이터 추출됨"
    echo "파일: grade_tables_export.json"
    echo ""
    echo "로컬 서버로 복사:"
    echo "  scp grade_tables_export.json sean@YOUR_LOCAL_SERVER:/home/sean/univjungsi/scripts/migrations/"
else
    echo "오류: 추출 실패"
fi
