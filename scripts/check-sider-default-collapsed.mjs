import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');

const checks = [
  {
    name: 'sidebar is collapsed by default after entering the app',
    pass: app.includes('const [collapsed, setCollapsed] = useState(true);'),
  },
  {
    name: 'sidebar still exposes the header toggle control',
    pass: app.includes('collapsed={collapsed}') &&
      app.includes('collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />') &&
      app.includes('onClick={() => setCollapsed((value) => !value)}'),
  },
  {
    name: 'collapsed sidebar keeps the compact styling class',
    pass: app.includes("className={`app-sider ${collapsed ? 'is-collapsed' : ''}`}"),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error('Sider default collapsed checks failed:');
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log('Sider default collapsed checks passed.');
