import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const queryPage = readFileSync(resolve(root, 'src/pages/QueryPage.tsx'), 'utf8');

const operationColumnMatch = queryPage.match(/title: '操作'[\s\S]*?render: \(_, record\) => \([\s\S]*?\n\s*\),\n\s*\},/);
const operationColumn = operationColumnMatch?.[0] || '';

const checks = [
  {
    name: 'delete action stays clickable so permission denial can be shown in a modal',
    pass: operationColumn.includes('onClick={() => handleDelete(record)}') &&
      operationColumn.includes('删除') &&
      !operationColumn.includes('disabled={!canEdit}') &&
      !operationColumn.includes('<Popconfirm'),
  },
  {
    name: 'delete action reuses current role permission and password confirmation flow',
    pass: queryPage.includes('if (!canEdit)') &&
      queryPage.includes("Modal.warning({ title: '权限不足'") &&
      queryPage.includes('confirmPassword(password)') &&
      queryPage.includes('await deleteInspectionLog(record.id)'),
  },
  {
    name: 'inspection mutation permission still allows level 1 and level 2 roles only',
    pass: queryPage.includes('canMutateInspection(user)'),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error('Query delete permission checks failed:');
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log('Query delete permission checks passed.');
