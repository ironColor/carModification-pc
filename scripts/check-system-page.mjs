import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const systemPage = readFileSync(resolve(root, 'src/pages/SystemPage.tsx'), 'utf8');

const checks = [
  {
    name: 'system page header region is not rendered',
    pass: !systemPage.includes('className="page-heading"') &&
      !systemPage.includes('系统管理界面') &&
      !systemPage.includes('一级权限账户可进行通信测试和用户管理') &&
      !systemPage.includes('刷新用户'),
  },
  {
    name: 'system page keeps communication test and user management cards',
    pass: systemPage.includes('title="通信测试按钮"') &&
      systemPage.includes('title="用户管理"') &&
      systemPage.includes('新增用户'),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error('System page checks failed:');
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log('System page checks passed.');
