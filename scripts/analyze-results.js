const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./scripts/verify-results-2026.json', 'utf8'));
const failures = data.filter(r => r.match === false);

// Group by university
const byUniv = {};
failures.forEach(f => {
  const key = f.U_ID + '|' + f.대학명;
  if (byUniv[key] === undefined) byUniv[key] = [];
  byUniv[key].push(f);
});

console.log('불일치 대학 목록 (총 ' + Object.keys(byUniv).length + '개):');
Object.keys(byUniv).sort((a,b) => {
  const ua = parseInt(a.split('|')[0]);
  const ub = parseInt(b.split('|')[0]);
  return ua - ub;
}).forEach(k => {
  const [uid, name] = k.split('|');
  const cases = byUniv[k];
  const avgDiff = cases.reduce((s,c) => s + (c.diff >= 0 ? c.diff : 0), 0) / cases.length;
  console.log('  U_ID ' + uid.padStart(3) + ': ' + name + ' (' + cases.length + '건, 평균차이: ' + avgDiff.toFixed(2) + ')');
});

// Print summary
console.log('\n=== 차이 유형 분석 ===');

// Legacy returns 0 cases
const legacyZero = failures.filter(f => f.legacyScore === '0.000');
console.log('기존엔진 0점 반환: ' + legacyZero.length + '건');
const legacyZeroUids = [...new Set(legacyZero.map(f => f.U_ID))];
console.log('  - 해당 U_ID: ' + legacyZeroUids.join(', '));

// Small differences (< 1)
const smallDiff = failures.filter(f => f.diff > 0 && f.diff < 1);
console.log('미세 차이 (<1): ' + smallDiff.length + '건');

// Medium differences (1-10)
const mediumDiff = failures.filter(f => f.diff >= 1 && f.diff < 10);
console.log('소 차이 (1-10): ' + mediumDiff.length + '건');

// Large differences (>=10)
const largeDiff = failures.filter(f => f.diff >= 10);
console.log('대 차이 (>=10): ' + largeDiff.length + '건');

// Infinity/NaN cases
const infCases = failures.filter(f => f.legacyScore === 'Infinity' || f.newScore === 'Infinity');
console.log('Infinity 케이스: ' + infCases.length + '건');
if (infCases.length > 0) {
  console.log('  - 해당 U_ID: ' + [...new Set(infCases.map(f => f.U_ID))].join(', '));
}
