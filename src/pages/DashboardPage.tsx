import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Empty,
  Image,
  List,
  Progress,
  Space,
  Statistic,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import {
  ApiOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  HddOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { getHardwareSettings, getSystemState, queryInspectionLogs, startSoftware } from '../api';
import type { InspectionDetail, InspectionLog, SystemState, User } from '../types';

interface DashboardPageProps {
  user: User | null;
}

const stateLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  camera_connected: { label: '相机', icon: <CameraOutlined /> },
  light: { label: '光源', icon: <ThunderboltOutlined /> },
  hardware: { label: '硬盘', icon: <HddOutlined /> },
  plc_connected: { label: '自动化设备', icon: <ApiOutlined /> },
  robot_connected: { label: '机器人', icon: <RobotOutlined /> },
  sensor_connected: { label: '传感器', icon: <CloudServerOutlined /> },
  algo: { label: '算法', icon: <CheckCircleOutlined /> },
};

function isOk(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    return ['true', '1', 'ok', 'online', 'connected', '正常', '已连接'].includes(value.toLowerCase());
  }
  return false;
}

function normalizeDetails(log?: InspectionLog | null): InspectionDetail[] {
  if (!log?.detailList) return [];
  if (Array.isArray(log.detailList)) return log.detailList;
  return Object.values(log.detailList).flat();
}

function statusColor(status?: string) {
  if (!status) return 'default';
  const value = status.toUpperCase();
  if (value === 'OK' || value === 'PASS' || value === '合格') return 'success';
  if (value === 'NG' || value === 'FAIL' || value === '不合格') return 'error';
  return 'processing';
}

export default function DashboardPage({ user }: DashboardPageProps) {
  const [state, setState] = useState<SystemState>({});
  const [hardware, setHardware] = useState<Record<string, unknown>>({});
  const [latest, setLatest] = useState<InspectionLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const { message } = AntApp.useApp();

  const appendEvent = useCallback((content: string) => {
    setEvents((items) => [`${dayjs().format('HH:mm:ss')} ${content}`, ...items].slice(0, 12));
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [systemState, hardwareData, page] = await Promise.all([
        getSystemState(),
        getHardwareSettings().catch(() => ({})),
        queryInspectionLogs({}, 1, 1).catch(() => ({ records: [], total: 0, current: 1, size: 1 })),
      ]);
      setState(systemState);
      setHardware(hardwareData);
      setLatest(page.records?.[0] || null);
      appendEvent('系统状态刷新完成');
    } catch (error) {
      appendEvent(`错误返回：${error instanceof Error ? error.message : '状态刷新失败'}`);
      message.error(error instanceof Error ? error.message : '状态刷新失败');
    } finally {
      setLoading(false);
    }
  }, [appendEvent, message]);

  useEffect(() => {
    loadDashboard();
    const timer = window.setInterval(loadDashboard, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const details = useMemo(() => normalizeDetails(latest), [latest]);
  const okCount = details.filter((item) => statusColor(item.warnType) === 'success' || !item.warnType).length;
  const ngCount = details.filter((item) => statusColor(item.warnType) === 'error').length;
  const currentDetail = details[0];
  const completion = details.length ? Math.round(((okCount + ngCount) / Math.max(details.length, 1)) * 100) : 0;

  async function handleStart(nextRunning: boolean) {
    try {
      await startSoftware(nextRunning ? 'start' : 'end');
      setRunning(nextRunning);
      appendEvent(nextRunning ? '系统启动命令已发送' : '系统停止命令已发送');
      message.success(nextRunning ? '已发送启动命令' : '已发送停止命令');
    } catch (error) {
      appendEvent(`系统启动情况异常：${error instanceof Error ? error.message : '命令发送失败'}`);
      message.error(error instanceof Error ? error.message : '命令发送失败');
    }
  }

  const imageItems = [
    { title: '螺纹检测图片', src: currentDetail?.threadImg, value: currentDetail?.hasThread },
    { title: '螺孔直径测量图片', src: currentDetail?.diameterImg, value: currentDetail?.diameter },
    { title: '通孔检测图片', src: currentDetail?.depthImg, value: currentDetail?.depth },
  ];

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>检测主界面</Typography.Title>
          <Typography.Text type="secondary">当前用户：{user?.nickName || user?.username}</Typography.Text>
        </div>
        <Space>
          <Button onClick={loadDashboard} loading={loading}>
            刷新状态
          </Button>
          <Button
            type={running ? 'default' : 'primary'}
            danger={running}
            icon={running ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => handleStart(!running)}
          >
            {running ? '停止检测' : '启动检测'}
          </Button>
        </Space>
      </div>

      <div className="dashboard-grid">
        <Card title="产品数据" className="dashboard-card">
          <div className="stat-grid">
            <Statistic title="当前检测产品型号" value={latest?.artifactType || '-'} />
            <Statistic title="产品检测数据统计" value={`${okCount} OK / ${ngCount} NG`} />
            <Statistic title="当前工件生产编号" value={latest?.artifactCode || '-'} />
            <div>
              <Typography.Text type="secondary">当前报警类型</Typography.Text>
              <div className="stat-tag-row">
                <Tag color={statusColor(currentDetail?.warnType || latest?.status)}>
                  {currentDetail?.warnType || latest?.status || '无'}
                </Tag>
              </div>
            </div>
          </div>
          <Progress percent={completion} size="small" />
        </Card>

        <Card title="系统状态区" className="dashboard-card">
          <div className="state-grid">
            {Object.entries(stateLabels).map(([key, meta]) => (
              <div key={key} className="state-tile">
                <span className={isOk(state[key]) ? 'state-icon ok' : 'state-icon warn'}>{meta.icon}</span>
                <div>
                  <Typography.Text>{meta.label}</Typography.Text>
                  <Tag color={isOk(state[key]) ? 'success' : 'error'}>{isOk(state[key]) ? '正常' : '异常'}</Tag>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="监测数据">
        {details.length ? (
          <div className="hole-panel">
            {details.map((detail, index) => (
              <div key={detail.id || `${detail.face}-${detail.hole}-${index}`} className="hole-item">
                <span className={`hole-dot ${statusColor(detail.warnType) === 'error' ? 'ng' : 'ok'}`} />
                <strong>{detail.face || '面'}-{detail.hole || index + 1}</strong>
                <span>{detail.holeType || '孔位'}</span>
              </div>
            ))}
          </div>
        ) : (
          <Alert type="info" showIcon message="暂无检测孔位数据" />
        )}
      </Card>

      <Card title="图片展示区">
        <div className="image-grid">
          {imageItems.map((item) => (
            <div className="inspection-image" key={item.title}>
              {item.src ? (
                <Image src={item.src} alt={item.title} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无图片" />
              )}
              <Typography.Text strong>{item.title}</Typography.Text>
              <Tag color={item.value ? 'processing' : 'default'}>{item.value ?? '未返回结果'}</Tag>
            </div>
          ))}
        </div>
      </Card>

      <div className="dashboard-grid lower">
        <Card title="运行状态展示区">
          <Timeline
            items={(events.length ? events : [`${dayjs().format('HH:mm:ss')} 等待系统运行信息`]).map((item) => ({
              children: item,
            }))}
          />
        </Card>
        <Card title="硬件设置">
          <Descriptions column={1} size="small">
            {Object.keys(hardware).length ? (
              Object.entries(hardware).map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>
                  {String(value)}
                </Descriptions.Item>
              ))
            ) : (
              <Descriptions.Item label="状态">暂无硬件设置数据</Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      </div>

      <Card title="最近检测明细">
        <List
          dataSource={details.slice(0, 8)}
          locale={{ emptyText: '暂无明细' }}
          renderItem={(item) => (
            <List.Item>
              <Space>
                {statusColor(item.warnType) === 'error' ? <WarningOutlined className="danger-text" /> : <CheckCircleOutlined className="ok-text" />}
                <span>{item.face || '-'} 面</span>
                <span>{item.hole || '-'} 孔</span>
                <span>直径：{item.diameter ?? '-'}</span>
                <span>深度：{item.depth ?? '-'}</span>
              </Space>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
