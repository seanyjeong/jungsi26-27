#!/bin/bash
# cafe24에서 영어/한국사 등급표 데이터 가져오기

CAFE24_HOST="maxilsan.cafe24.com"
CAFE24_USER="maxilsan"
CAFE24_PASS="q141171616!"
CAFE24_DB="jungsi"

echo "=== cafe24 영어/한국사 등급 데이터 조회 ==="

mysql -h "$CAFE24_HOST" -u "$CAFE24_USER" -p"$CAFE24_PASS" "$CAFE24_DB" -e "
SELECT U_ID, 대학, 학과,
       SUBSTRING(english_scores, 1, 100) as eng_scores,
       SUBSTRING(history_scores, 1, 100) as hist_scores
FROM 정시반영비율
WHERE (english_scores IS NOT NULL AND english_scores != '')
   OR (history_scores IS NOT NULL AND history_scores != '')
LIMIT 10;
" 2>/dev/null
