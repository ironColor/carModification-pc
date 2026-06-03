import { App as AntApp, Button, Image, Timeline } from 'antd';
import { useState } from 'react';
import { startSoftware } from '../api';
import type { User } from '../types';

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
    '良品数：999   不良品数：999',
    '缺陷1数量：999',
    '缺陷2数量：999',
    '缺陷3数量：999',
    '良品率：98%',
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

export default function DashboardPage(_props: DashboardPageProps) {
  const [running, setRunning] = useState(false);
  const { message } = AntApp.useApp();

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

  return (
    <div className="machine-dashboard">
      <div className="machine-layout">
        <section className="machine-workspace">
          <section className="machine-left">
            <div>
              <Button className={`start-button ${running ? 'is-running' : ''}`} onClick={handleStart}>
                {running ? '停止' : '开始'}
              </Button>
            </div>

            <div className="panel system-status-panel">
              <div className="system-status-title">系统状态</div>
              {dashboardSnapshot.statusRows.map((item) => (
                <div className="status-line" key={item.label}>
                  <span>{item.label}:</span>
                  <strong className={item.ok ? 'ok' : 'offline'}>{item.ok ? '正常' : '离线'}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="machine-main">
            <div className="machine-top-grid">
              <div className="panel model-panel">
                <div className="panel-label">型号：</div>
                <div className="model-value">{dashboardSnapshot.model}</div>
              </div>

              <div className="panel workpiece-panel">
                <div>当前工件：</div>
                <strong>{dashboardSnapshot.workpiece}</strong>
                <div>
                  面:{dashboardSnapshot.face}孔：{dashboardSnapshot.hole}
                </div>
              </div>
            </div>

            <div className="machine-mid-grid">
              <div className="panel stats-panel">
                <p>统计:</p>
                {dashboardSnapshot.stats.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>

              <div className="panel alarm-panel">
                <div>当前报警类型：</div>
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
                      <span>design.alipay.com</span>
                    </div>
                  )}
                </div>
                <div className="image-result">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="machine-right">
          <div className="panel holes-panel">
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
            <Timeline
              items={dashboardSnapshot.logItems.map((item) => ({
                color: item.color,
                children: item.text,
              }))}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
