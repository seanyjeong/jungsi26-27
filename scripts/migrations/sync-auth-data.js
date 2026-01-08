const mysql = require('mysql2/promise');
const { execSync } = require('child_process');

(async () => {
  const cafe24 = mysql.createPool({
    host: '211.37.174.218',
    user: 'maxilsan',
    password: 'q141171616!',
    database: '26susi',
  });

  console.log('=== cafe24에서 인증 데이터 복사 ===\n');

  // 1. 지점 복사
  console.log('1. 지점 데이터 복사...');
  const [branches] = await cafe24.query('SELECT * FROM branches ORDER BY id');

  let branchCount = 0;
  for (const b of branches) {
    const sql = `INSERT INTO branches (branch_id, branch_name) VALUES (${b.id}, '${b.branch_name.replace(/'/g, "''")}') ON DUPLICATE KEY UPDATE branch_name = VALUES(branch_name)`;
    try {
      execSync(`mysql -u paca univjungsi -e "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
      branchCount++;
    } catch (e) {
      console.log(`  Error: ${b.branch_name}: ${e.message}`);
    }
  }
  console.log(`  → ${branchCount}개 지점 완료`);

  // 2. 원장회원 복사
  console.log('\n2. 사용자 데이터 복사...');
  const [users] = await cafe24.query('SELECT * FROM 원장회원');

  // 지점명 → branch_id 매핑
  const branchResult = execSync(
    `mysql -u paca univjungsi -N -e "SELECT branch_id, branch_name FROM branches"`,
    { encoding: 'utf8' }
  );
  const branchMap = new Map();
  branchResult.trim().split('\n').forEach(line => {
    const [id, name] = line.split('\t');
    branchMap.set(name, parseInt(id));
  });

  let userCount = 0;
  for (const u of users) {
    // 직급 → role 변환
    let role = 'staff';
    if (u.직급 === '원장' || u.아이디 === 'admin') role = 'admin';
    else if (u.직급 === '부원장' || u.직급 === '실장') role = 'manager';

    // 승인여부 → status 변환
    let status = 'pending';
    if (u.승인여부 === 'O') status = 'active';
    else if (u.승인여부 === 'X') status = 'blocked';

    // 지점명으로 branch_id 찾기
    let branchId = branchMap.get(u.지점명);
    if (!branchId && u.지점명) {
      // 지점이 없으면 새로 생성
      try {
        execSync(`mysql -u paca univjungsi -e "INSERT INTO branches (branch_name) VALUES ('${u.지점명.replace(/'/g, "''")}')"`, { encoding: 'utf8' });
        // 새로 생성된 ID 조회
        const newId = execSync(`mysql -u paca univjungsi -N -e "SELECT branch_id FROM branches WHERE branch_name = '${u.지점명.replace(/'/g, "''")}'"`, { encoding: 'utf8' });
        branchId = parseInt(newId.trim());
        branchMap.set(u.지점명, branchId);
        console.log(`  + 새 지점 생성: ${u.지점명} (ID: ${branchId})`);
      } catch (e) {}
    }

    const name = (u.이름 || '').replace(/'/g, "''");
    const phone = (u.전화번호 || '').replace(/'/g, "''");
    const password = u.비밀번호.replace(/'/g, "''");

    const sql = `INSERT INTO users (user_id, username, password_hash, name, branch_id, phone, role, status)
                 VALUES (${u.원장ID}, '${u.아이디}', '${password}', '${name}', ${branchId || 'NULL'}, '${phone}', '${role}', '${status}')
                 ON DUPLICATE KEY UPDATE
                   password_hash = VALUES(password_hash),
                   name = VALUES(name),
                   branch_id = VALUES(branch_id),
                   phone = VALUES(phone),
                   role = VALUES(role),
                   status = VALUES(status)`;

    try {
      execSync(`mysql -u paca univjungsi -e "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
      userCount++;
    } catch (e) {
      console.log(`  Error: ${u.아이디}: ${e.message}`);
    }
  }
  console.log(`  → ${userCount}명 사용자 완료`);

  // 결과 확인
  console.log('\n=== 결과 확인 ===');
  const checkBranches = execSync(`mysql -u paca univjungsi -N -e "SELECT COUNT(*) FROM branches"`, { encoding: 'utf8' });
  const checkUsers = execSync(`mysql -u paca univjungsi -N -e "SELECT COUNT(*) FROM users"`, { encoding: 'utf8' });
  const checkActive = execSync(`mysql -u paca univjungsi -N -e "SELECT COUNT(*) FROM users WHERE status = 'active'"`, { encoding: 'utf8' });

  console.log(`지점: ${checkBranches.trim()}개`);
  console.log(`사용자: ${checkUsers.trim()}명`);
  console.log(`활성 사용자: ${checkActive.trim()}명`);

  await cafe24.end();
})();
