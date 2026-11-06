'use strict';

// Add only the 15 explicitly requested shared test accounts. Never reset users.
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const projectRef = 'zlsygwjskvxgtzdjhvzt';
const backend = path.resolve(__dirname, '..');
const fileEnv = {};
for (const line of fs.readFileSync(path.join(backend, '.env'), 'utf8').split(/\r?\n/)) {
  const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (match) fileEnv[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
}
const env = { ...fileEnv, ...process.env };
for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const target = new URL(env[key]);
  if (!target.hostname.endsWith('.pooler.supabase.com') || target.port !== '5432' ||
      target.pathname !== '/postgres' || target.searchParams.get('sslmode') !== 'require' ||
      decodeURIComponent(target.username) !== `postgres.${projectRef}`) {
    throw Error('Refusing unexpected database target');
  }
}
const apply = process.argv.includes('--apply');
if (apply && process.argv[process.argv.indexOf('--project-ref') + 1] !== projectRef) {
  throw Error('Writes require --apply --project-ref with the reviewed project ref');
}
const studentNames = [
  'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Minh Châu', 'Phạm Quốc Dũng',
  'Hoàng Thị Hà', 'Vũ Đức Huy', 'Đặng Ngọc Linh', 'Bùi Anh Minh',
  'Đỗ Thanh Nam', 'Ngô Thị Phương',
];
const lecturerNames = [
  'Nguyễn Minh Tuấn', 'Trần Thị Hương', 'Lê Quốc Việt',
  'Phạm Thu Trang', 'Hoàng Anh Dũng',
];
const students = studentNames.map((fullName, i) => ({
  username: String(221000001 + i), fullName, role: 'STUDENT',
}));
const lecturers = lecturerNames.map((fullName, i) => ({
  username: `gv${String(i + 1).padStart(6, '0')}`, fullName, role: 'LECTURER',
}));
const accounts = [...students, ...lecturers].map(account => ({
  ...account, email: `${account.username}@example.invalid`,
}));
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

async function prerequisites(tx) {
  const history = await tx.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations"');
  require('./shared-database.cjs').assertMigrationHistory(history);
  const expectedCount = fs.readdirSync(path.join(backend, 'prisma/migrations'))
    .filter(name => fs.existsSync(path.join(backend, 'prisma/migrations', name, 'migration.sql'))).length;
  if (history.length !== expectedCount) throw Error('Expected all repository migrations before adding accounts');
  const roles = await tx.role.findMany({ where: { name: { in: ['STUDENT', 'LECTURER'] } } });
  const system = await tx.trainingSystem.findUnique({ where: { code: 'CQ' } });
  const department = await tx.department.findUnique({ where: { code: 'CNPM' } });
  if (roles.length !== 2 || !system || !department) throw Error('Missing base roles, CQ or CNPM; no accounts written');
  const existingUsers = await tx.userAccount.count({ where: { OR: [
    { username: { in: accounts.map(a => a.username) } },
    { email: { in: accounts.map(a => a.email) } },
  ] } });
  const existingStudents = await tx.student.count({ where: { studentCode: { in: students.map(a => a.username) } } });
  const existingLecturers = await tx.lecturer.count({ where: { lecturerCode: { in: lecturers.map(a => a.username) } } });
  if (existingUsers || existingStudents || existingLecturers) {
    throw Error('An account/email/profile already exists; refusing overwrite or password reset');
  }
  return { roles: Object.fromEntries(roles.map(role => [role.name, role.id])), system, department };
}

async function main() {
  if (!apply) {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await prerequisites(tx);
      console.log(JSON.stringify({ operation: 'READ ONLY', projectRef, ready: true,
        students: students.map(a => a.username), lecturers: lecturers.map(a => a.username) }, null, 2));
    }, { timeout: 30000 });
    return;
  }
  const hashes = await Promise.all(accounts.map(account =>
    bcrypt.hash(account.role === 'STUDENT' ? account.username : 'Demo@2026', 12)));
  const result = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15000ms'");
    const base = await prerequisites(tx);
    for (const [i, account] of accounts.entries()) {
      const user = await tx.userAccount.create({ data: {
        username: account.username, displayName: account.fullName, email: account.email,
        passwordHash: hashes[i], status: 'ACTIVE', mustChangePassword: false,
        userRoles: { create: { roleId: base.roles[account.role] } },
      } });
      if (account.role === 'STUDENT') {
        await tx.student.create({ data: {
          userId: user.id, studentCode: account.username, fullName: account.fullName,
          trainingSystemId: base.system.id, className: 'CNPM-TEST', cohort: 'K2026',
          gpa: '3.00', academicEligible: true, isActive: true,
        } });
      } else {
        await tx.lecturer.create({ data: {
          userId: user.id, lecturerCode: account.username, fullName: account.fullName,
          departmentId: base.department.id, maxStudents: 5, isActive: true,
        } });
      }
    }
    const saved = await tx.userAccount.findMany({
      where: { username: { in: accounts.map(a => a.username) } },
      include: { student: true, lecturer: true, userRoles: { include: { role: true } } },
    });
    if (saved.length !== 15) throw Error('Account count mismatch; rolling back');
    for (const account of accounts) {
      const user = saved.find(u => u.username === account.username);
      const password = account.role === 'STUDENT' ? account.username : 'Demo@2026';
      if (!user || !await bcrypt.compare(password, user.passwordHash) || user.status !== 'ACTIVE' ||
          user.userRoles.length !== 1 || user.userRoles[0].role.name !== account.role ||
          (account.role === 'STUDENT' ? user.student?.studentCode : user.lecturer?.lecturerCode) !== account.username) {
        throw Error('Password/role/profile verification failed; rolling back');
      }
    }
    return { projectRef, createdStudents: 10, createdLecturers: 5,
      passwordRoleProfileVerification: 'PASS', existingUsersUnchanged: true,
      accounts: accounts.map(({ username, fullName, role }) => ({ username, fullName, role })) };
  }, { timeout: 60000 });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => {
  if (/^(Expected|Missing|An account|Account count|Password\/role)/.test(error.message)) console.error(error.message);
  else console.error('Test-account operation failed; inspect locally. Credentials suppressed. Code=' + (error.code || 'unknown'));
  process.exitCode = 1;
}).finally(() => db.$disconnect());
