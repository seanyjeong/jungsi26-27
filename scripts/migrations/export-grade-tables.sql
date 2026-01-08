-- cafe24 SSH에서 실행할 영어/한국사 등급표 추출 쿼리
-- 실행: mysql -u maxilsan -p jungsi < export-grade-tables.sql > grade_tables.json

SELECT JSON_OBJECT(
    'data', JSON_ARRAYAGG(
        JSON_OBJECT(
            'U_ID', U_ID,
            '대학', 대학,
            '학과', 학과,
            '학년도', 학년도,
            'english_scores', english_scores,
            'history_scores', history_scores
        )
    )
) AS result
FROM 정시반영비율
WHERE 학년도 = 2026
  AND (
    (english_scores IS NOT NULL AND english_scores != '' AND english_scores != '{}')
    OR (history_scores IS NOT NULL AND history_scores != '' AND history_scores != '{}')
  );
