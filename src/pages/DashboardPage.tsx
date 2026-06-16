import { App as AntApp, Button, Image, Select, Timeline } from 'antd';
import { PoweroffOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getDict, setArtifactType, startSoftware } from '../api';
import type { DictOption, User } from '../types';

interface DashboardPageProps {
  user: User | null;
}

const dashboardSnapshot = {
  model: 'EH09',
  workpiece: '2026_5_3_12_12_43_110',
  face: 2,
  hole: 6,
  alarmType: '螺纹缺失',
  statusRows: [
    { label: '相机', ok: true },
    { label: '光源', ok: false },
    { label: '硬盘', ok: true },
    { label: 'PLC', ok: true },
    { label: '机器人', ok: true },
    { label: '传感器', ok: true },
  ],
  stats: [
    { label: '良品数', value: '999' },
    { label: '不良品数', value: '999' },
    { label: '缺陷1数量', value: '999' },
    { label: '缺陷2数量', value: '999' },
    { label: '缺陷3数量', value: '999' },
    { label: '良品率', value: '98%' },
  ],
  holeRows: [
    ['ok', 'ok', 'ok'],
    ['ok', 'ok', 'ng'],
    ['ok', 'empty', 'empty'],
    ['idle', 'idle', 'idle'],
    ['idle'],
    [],
  ],
  logItems: [
    { color: '#1677ff', text: '创建服务现场 2015-09-01' },
    { color: '#1677ff', text: '创建服务现场 2015-09-01' },
    { color: '#1677ff', text: '初步排除网络异常 2015-09-01' },
    { color: '#52c41a', text: '相机自检2015-09-01' },
    { color: '#52c41a', text: '机器人自检2015-09-01' },
    { color: '#ff1f2d', text: '相机拍摄 2015-09-01' },
    { color: '#1677ff', text: '机器人动作2015-09-01' },
  ],
  imageCards: [
    { label: 'NG', src: '' },
    { label: '9.0816', src: '' },
    { label: '通孔', src: '' },
  ],
};

function buildModelOptions(options: DictOption[]) {
  const filtered = options.filter((item) => item.dictValue);
  if (filtered.some((item) => item.dictValue === dashboardSnapshot.model)) {
    return filtered;
  }
  return [{ dictLabel: dashboardSnapshot.model, dictValue: dashboardSnapshot.model }, ...filtered];
}

export default function DashboardPage(_props: DashboardPageProps) {
  const [running, setRunning] = useState(false);
  const [modelValue, setModelValue] = useState(dashboardSnapshot.model);
  const [modelOptions, setModelOptions] = useState<DictOption[]>([
    { dictLabel: dashboardSnapshot.model, dictValue: dashboardSnapshot.model },
  ]);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelSaving, setModelSaving] = useState(false);
  const { message } = AntApp.useApp();
  const onlineCount = dashboardSnapshot.statusRows.filter((item) => item.ok).length;

  useEffect(() => {
    let active = true;
    getDict('artifactType')
      .then((items) => {
        if (!active) return;
        const nextOptions = buildModelOptions(items);
        setModelOptions(nextOptions);
        setModelValue((current) =>
          nextOptions.some((item) => item.dictValue === current)
            ? current
            : nextOptions[0]?.dictValue || dashboardSnapshot.model,
        );
      })
      .catch(() => {
        if (!active) return;
        setModelOptions([{ dictLabel: dashboardSnapshot.model, dictValue: dashboardSnapshot.model }]);
        setModelValue(dashboardSnapshot.model);
      })
      .finally(() => {
        if (active) setModelLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleStart() {
    const nextRunning = !running;
    try {
      await startSoftware(nextRunning ? 'start' : 'end');
      setRunning(nextRunning);
      message.success(nextRunning ? '已发送启动命令' : '已发送停止命令');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '启动接口调用失败');
    }
  }

  async function handleModelChange(nextModel: string) {
    if (nextModel === modelValue) return;
    const previousModel = modelValue;
    setModelValue(nextModel);
    setModelSaving(true);
    try {
      await setArtifactType(nextModel);
      message.success('型号已切换');
    } catch (error) {
      setModelValue(previousModel);
      message.error(error instanceof Error ? error.message : '型号切换失败');
    } finally {
      setModelSaving(false);
    }
  }

  return (
    <div className="machine-dashboard">
      <div className="machine-layout">
        <main className="machine-workspace">
          <section className="machine-left">
            <div className={`dashboard-run-card ${running ? 'is-running' : ''}`}>
              <div>
                <span>设备状态</span>
                <strong>{running ? '运行中' : '待启动'}</strong>
              </div>
              <Button
                className={`start-button ${running ? 'is-running' : ''}`}
                icon={<PoweroffOutlined />}
                onClick={handleStart}
              >
                {running ? '停止' : '开始'}
              </Button>
            </div>

            <div className="panel system-status-panel">
              <div className="panel-title-row">
                <span>系统状态</span>
                <strong>
                  {onlineCount}/{dashboardSnapshot.statusRows.length}
                </strong>
              </div>
              <div className="status-list">
                {dashboardSnapshot.statusRows.map((item) => (
                  <div className="status-line" key={item.label}>
                    <span className={`status-dot ${item.ok ? 'ok' : 'offline'}`} />
                    <span>{item.label}</span>
                    <strong className={item.ok ? 'ok' : 'offline'}>{item.ok ? '正常' : '离线'}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="machine-info">
            <div className="machine-top-grid">
              <div className="panel model-panel">
                <span>型号：</span>
                <Select
                  className="model-select"
                  aria-label="型号"
                  showSearch
                  disabled={modelSaving}
                  loading={modelLoading || modelSaving}
                  optionFilterProp="label"
                  value={modelValue}
                  options={modelOptions.map((item) => ({
                    label: item.dictLabel,
                    value: item.dictValue,
                  }))}
                  onChange={handleModelChange}
                />
              </div>

              <div className="panel workpiece-panel">
                <div className="panel-title-row">
                  <span>当前工件</span>
                  <strong>
                    面 {dashboardSnapshot.face} / 孔 {dashboardSnapshot.hole}
                  </strong>
                </div>
                <div className="workpiece-value">{dashboardSnapshot.workpiece}</div>
                <div className="workpiece-meta">
                  <span>
                    检测面<strong>{dashboardSnapshot.face}</strong>
                  </span>
                  <span>
                    孔位<strong>{dashboardSnapshot.hole}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="machine-mid-grid">
              <div className="panel stats-panel">
                <div className="panel-title-row">
                  <span>生产统计</span>
                </div>
                <div className="stat-dashboard-grid">
                  {dashboardSnapshot.stats.map((item) => (
                    <div className={item.label === '良品率' ? 'stat-box highlight' : 'stat-box'} key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel dashboard-focus-card">
                <span>当前报警类型</span>
                <strong>{dashboardSnapshot.alarmType}</strong>
              </div>
            </div>
          </section>

          <div className="image-board">
            {dashboardSnapshot.imageCards.map((item) => (
              <div className="machine-image-group" key={item.label}>
                <div className="machine-image-box">
                  {item.src ? (
                    <Image src={item.src} alt={item.label} />
                  ) : (
                    <div className="image-placeholder">
                      <span className="placeholder-icon">▧</span>
                      <span>暂无图像</span>
                    </div>
                  )}
                </div>
                <div className="image-result">{item.label}</div>
              </div>
            ))}
          </div>
        </main>

        <aside className="machine-right">
          <div className="panel holes-panel">
            <div className="panel-title-row">
              <span>孔位检测</span>
            </div>
            {dashboardSnapshot.holeRows.map((row, rowIndex) => (
              <div className="hole-row" key={String.fromCharCode(65 + rowIndex)}>
                <span className="hole-row-label">{String.fromCharCode(65 + rowIndex)}</span>
                <div className="hole-row-cells">
                  {row.map((cell, index) => (
                    <span className={`hole-pill ${cell}`} key={`${rowIndex}-${index}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="panel log-panel">
            <div className="panel-title-row">
              <span>运行日志</span>
            </div>
            <Timeline
              items={dashboardSnapshot.logItems.map((item) => ({
                color: item.color,
                children: item.text,
              }))}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
