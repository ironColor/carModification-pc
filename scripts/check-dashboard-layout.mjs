import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dashboard = readFileSync(resolve(root, 'src/pages/DashboardPage.tsx'), 'utf8');
const css = readFileSync(resolve(root, 'src/styles.css'), 'utf8');

function cssBlock(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return '';
  const bodyStart = css.indexOf('{', start) + 1;
  const bodyEnd = css.indexOf('}', bodyStart);
  return css.slice(bodyStart, bodyEnd);
}

const machineLayoutBlock = cssBlock('.machine-layout');
const antSpinContainerBlock = cssBlock('.machine-dashboard .ant-spin-container');
const workspaceBlock = cssBlock('.machine-workspace');
const imageBoardBlock = cssBlock('.image-board');
const rightRailBlock = cssBlock('.machine-right');
const leftRailBlock = cssBlock('.machine-left');
const infoBlock = cssBlock('.machine-info');
const workpieceValueBlock = cssBlock('.workpiece-value');
const workpieceMetaItemBlock = cssBlock('.workpiece-meta span');
const statsPanelBlock = cssBlock('.stats-panel');
const statGridBlock = cssBlock('.stat-dashboard-grid');
const statBoxBlock = cssBlock('.stat-box');
const statBoxValueBlock = cssBlock('.stat-box strong');
const runCardBlock = cssBlock('.dashboard-run-card');
const imageGroupBlock = cssBlock('.machine-image-group');
const holeCellsBlock = cssBlock('.hole-row-cells');
const holePillBlock = cssBlock('.hole-pill');

const checks = [
  {
    name: 'dashboard uses the explicit machine layout wrapper',
    pass: dashboard.includes('className="machine-layout"'),
  },
  {
    name: 'main content uses top and middle 2-column grids',
    pass: dashboard.includes('className="machine-top-grid"') && dashboard.includes('className="machine-mid-grid"'),
  },
  {
    name: 'reference marker badges are not rendered',
    pass: !dashboard.includes('marked-box') && !/marker-\d/.test(dashboard) && !css.includes('.marked-box'),
  },
  {
    name: 'layout grid is applied to .machine-layout, not AntD spin container',
    pass: machineLayoutBlock.includes('grid-template-columns') && !antSpinContainerBlock.includes('grid-template-columns'),
  },
  {
    name: 'workspace grid reserves left column, center content, and bottom images',
    pass: workspaceBlock.includes('grid-template-columns: 370px minmax(0, 1fr)') &&
      imageBoardBlock.includes('grid-column: 1 / -1'),
  },
  {
    name: 'system status panel has enough first-row height for all status lines',
    pass: workspaceBlock.includes('grid-template-rows: 470px minmax(402px, 1fr)') &&
      leftRailBlock.includes('grid-template-rows: 120px minmax(336px, 1fr)'),
  },
  {
    name: 'top info row balances readable workpiece metadata with full stats content',
    pass: infoBlock.includes('grid-template-rows: 190px minmax(0, 1fr)'),
  },
  {
    name: 'right rail stacks hole status and timeline',
    pass: rightRailBlock.includes('grid-template-rows: 470px 1fr'),
  },
  {
    name: 'hole status pills are compact and wrap when rows contain many positions',
    pass: holeCellsBlock.includes('display: flex') &&
      holeCellsBlock.includes('flex-wrap: wrap') &&
      holePillBlock.includes('width: 38px') &&
      holePillBlock.includes('height: 16px') &&
      !holeCellsBlock.includes('grid-template-columns'),
  },
  {
    name: 'model tile uses a dictionary-backed dropdown instead of static text',
    pass: dashboard.includes("getDict('artifactType')") &&
      dashboard.includes('buildModelOptions') &&
      dashboard.includes('modelLoading') &&
      dashboard.includes('className="model-select"') &&
      dashboard.includes('<Select') &&
      dashboard.includes('检测面<strong>{dashboardSnapshot.face}</strong>') &&
      dashboard.includes('孔位<strong>{dashboardSnapshot.hole}</strong>'),
  },
  {
    name: 'model dropdown change calls the backend update endpoint',
    pass: dashboard.includes('setArtifactType') &&
      dashboard.includes('handleModelChange') &&
      dashboard.includes('modelSaving') &&
      dashboard.includes('disabled={modelSaving}'),
  },
  {
    name: 'workpiece details are compact enough to fit but tall enough to read',
    pass: workpieceValueBlock.includes('font-size: clamp(18px, 1.15vw, 20px)') &&
      workpieceMetaItemBlock.includes('min-height: 52px') &&
      workpieceMetaItemBlock.includes('padding: 8px 10px'),
  },
  {
    name: 'stats panel content is compact enough to show all six metrics',
    pass: statsPanelBlock.includes('padding: 10px') &&
      statGridBlock.includes('gap: 6px') &&
      statGridBlock.includes('margin-top: 8px') &&
      statBoxBlock.includes('min-height: 48px') &&
      statBoxBlock.includes('padding: 8px') &&
      statBoxValueBlock.includes('font-size: 22px'),
  },
  {
    name: 'dashboard vertical sizing keeps image results visible in one viewport',
    pass: runCardBlock.includes('min-height: 120px') &&
      imageGroupBlock.includes('grid-template-rows: minmax(320px, 1fr) 72px'),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error('Dashboard layout checks failed:');
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log('Dashboard layout checks passed.');
