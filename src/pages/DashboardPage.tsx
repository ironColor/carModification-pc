import { App as AntApp, Button, Image, Select, Timeline } from 'antd';
import { PoweroffOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchDashboardImageObjectUrl,
  getCurrentArtifactType,
  getDict,
  getHardwareSettings,
  getSystemState,
  setArtifactType,
  startSoftware,
} from '../api';
import type { DictOption, SystemState, User } from '../types';

interface DashboardPageProps {
  user: User | null;
}

type HoleCell = 'ok' | 'ng' | 'empty' | 'idle';

interface StatusRow {
  label: string;
  ok: boolean;
  key?: string;
}

interface StatItem {
  label: string;
  value: string;
}

interface HoleRow {
  label: string;
  cells: HoleCell[];
}

interface LogItem {
  color: string;
  text: string;
}

interface ImageCard {
  key: 'diameter' | 'depth' | 'thread';
  label: string;
  result: string;
  src: string;
  path?: string;
  loading?: boolean;
}

interface DashboardSocketEnvelope {
  event?: string;
  type?: string;
  name?: string;
  payload?: unknown;
  data?: unknown;
  [key: string]: unknown;
}

const MAX_LOG_ITEMS = 80;
const IMAGE_DATA_PREFIX = ['data', 'image'].join(':');

const dashboardSnapshot = {
  model: '',
  workpiece: '',
  face: undefined,
  hole: undefined,
  alarmType: undefined,
  statusRows: [
    { label: '相机', key: 'camera_connected', ok: false },
    { label: '光源', key: 'light', ok: false },
    { label: '硬盘', key: 'hardware', ok: false },
    { label: 'PLC', key: 'plc_connected', ok: false },
    { label: '机器人', key: 'robot_connected', ok: false },
    { label: '传感器', key: 'sensor_connected', ok: false },
  ] satisfies StatusRow[],
  stats: [
    { label: '良品数', value: '' },
    { label: '不良品数', value: '' },
    { label: '缺陷1数量', value: '' },
    { label: '缺陷2数量', value: '' },
    { label: '缺陷3数量', value: '' },
    { label: '良品率', value: '' },
  ],
  holeRows: [
  ] satisfies HoleRow[],
  logItems: [

  ],
  imageCards: [
    { key: 'diameter', label: '孔直径检测图', result: '孔直径检测图', src: '' },
    { key: 'depth', label: '孔深度检测图', result: '孔深度检测图', src: '' },
    { key: 'thread', label: '螺纹检测图', result: '螺纹检测图', src: '' },
  ] satisfies ImageCard[],
};

function buildModelOptions(options: DictOption[], currentModel = dashboardSnapshot.model) {
  const filtered = options.filter((item) => item.dictValue);
  if (filtered.some((item) => item.dictValue === currentModel)) {
    return filtered;
  }
  return [{ dictLabel: currentModel, dictValue: currentModel }, ...filtered];
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function formatValue(value: unknown, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function normalizeConnected(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'ok', 'online', 'connected', '正常', '已连接', '连接'].includes(text)) return true;
  if (['false', '0', 'offline', 'disconnected', 'error', '异常', '离线', '未连接'].includes(text)) return false;
  return fallback;
}

function buildStatusRows(state: SystemState) {
  return dashboardSnapshot.statusRows.map((row) => ({
    ...row,
    ok: normalizeConnected(row.key ? state[row.key] : undefined, row.ok),
  }));
}

function inferRunning(settings: Record<string, unknown>) {
  const candidates = ['software', 'running', 'software_running', 'start_state', 'state', 'status'];
  for (const key of candidates) {
    const value = settings[key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'boolean') return value;
    const text = String(value).trim().toLowerCase();
    if (['start', 'running', 'run', '1', 'true', '运行中', '启动'].includes(text)) return true;
    if (['end', 'stop', 'stopped', '0', 'false', '停止', '待启动'].includes(text)) return false;
  }
  return null;
}

function extractArtifactType(payload: unknown) {
  if (typeof payload === 'string') return payload;
  const record = toRecord(payload);
  if (!record) return '';
  return formatValue(record.artifactType ?? record.type ?? record.currentArtifactType ?? record.value ?? record.artifact, '');
}

function parseSocketData(data: unknown): DashboardSocketEnvelope | null {
  if (typeof data !== 'string') return toRecord(data) as DashboardSocketEnvelope | null;
  try {
    const parsed = JSON.parse(data) as unknown;
    return toRecord(parsed) as DashboardSocketEnvelope | null;
  } catch {
    return { event: 'log_received', payload: data };
  }
}

function normalizeEventPayload(envelope: DashboardSocketEnvelope) {
  return envelope.payload ?? envelope.data ?? envelope;
}

function getSocketUrl() {
  const baseURL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'http://127.0.0.1:8081' : window.location.origin);
  try {
    const url = new URL(baseURL, window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
}

function logColor(payload: unknown) {
  const text = JSON.stringify(payload).toLowerCase();
  if (text.includes('error') || text.includes('warn') || text.includes('报警') || text.includes('异常')) return '#ff1f2d';
  if (text.includes('ok') || text.includes('正常') || text.includes('自检')) return '#52c41a';
  return '#1677ff';
}

function logText(payload: unknown) {
  if (typeof payload === 'string') return payload;
  const record = toRecord(payload);
  if (!record) return formatValue(payload);
  const sender = formatValue(record.sender, '');
  const level = formatValue(record.level, '');
  const info = formatValue(record.info ?? record.message ?? record.log, '');
  const time = formatValue(record.time ?? record.createTime, '');
  return [sender, level, info, time].filter(Boolean).join(' ');
}

function normalizeHoleCell(value: unknown): HoleCell {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'boolean') return value ? 'ok' : 'ng';
  if (typeof value === 'number') return value === 0 ? 'ok' : 'ng';

  const text = String(value).trim().toLowerCase();
  if (!text || text === 'null') return 'empty';
  if (['idle', 'pending', '未检测', '等待'].includes(text)) return 'idle';
  if (text.includes('ng') || text.includes('false') || text.includes('fail') || text.includes('不符') || text.includes('缺失') || text.includes('异常')) {
    return 'ng';
  }
  if (text.includes('ok') || text.includes('true') || text.includes('pass') || text.includes('正常') || text.includes('良') || text.includes('通')) {
    return 'ok';
  }
  return 'ng';
}

function buildHoleRows(payload: unknown): HoleRow[] {
  const record = toRecord(payload);
  if (!record) return dashboardSnapshot.holeRows;

  const rows = Object.entries(record)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, value]) => {
      const cells = Array.isArray(value) ? value.map(normalizeHoleCell) : Object.values(toRecord(value) || {}).map(normalizeHoleCell);
      return { label, cells };
    });

  return rows.length ? rows : dashboardSnapshot.holeRows;
}

function buildStats(payload: unknown): StatItem[] {
  const record = toRecord(payload);
  if (!record) return dashboardSnapshot.stats;

  const warnMap = toRecord(record.warnMap);
  const warnStats = Object.entries(warnMap || {})
    .slice(0, 3)
    .map(([label, value]) => ({ label: `${label}数量`, value: formatValue(value, '0') }));

  while (warnStats.length < 3) {
    warnStats.push({ label: `缺陷${warnStats.length + 1}数量`, value: '0' });
  }

  return [
    { label: '良品数', value: formatValue(record.okNum, '0') },
    { label: '不良品数', value: formatValue(record.ngNum, '0') },
    ...warnStats,
    { label: '良品率', value: formatValue(record.okPercent, '0%') },
  ];
}

function sensorImageIndex(eventName: string, payload: unknown) {
  if (eventName === 'sensor-send-data-1') return 0;
  if (eventName === 'sensor-send-data-2') return 1;
  if (eventName === 'sensor-send-data-3') return 2;
  const record = toRecord(payload);
  const name = formatValue(record?.event ?? record?.name ?? record?.type, '');
  if (name.endsWith('-1')) return 0;
  if (name.endsWith('-2')) return 1;
  if (name.endsWith('-3')) return 2;
  return -1;
}

function imageIndex(eventName: string) {
  if (eventName === 'image-send-image-1') return 0;
  if (eventName === 'image-send-image-2') return 1;
  if (eventName === 'image-send-image-3') return 2;
  return -1;
}

function extractImagePath(payload: unknown) {
  const directValue = typeof payload === 'string' ? payload : '';
  const record = toRecord(payload);
  const value = directValue || formatValue(record?.path ?? record?.filePath ?? record?.url ?? record?.imagePath, '');
  if (!value || value.startsWith(IMAGE_DATA_PREFIX)) return '';
  return value;
}

function applyHoleResult(rows: HoleRow[], payload: unknown) {
  const record = toRecord(payload);
  if (!record) return rows;

  const faceValue = formatValue(record.face ?? record.faceName, '');
  const faceLabel = Number.isFinite(Number(faceValue)) ? String.fromCharCode(64 + Number(faceValue)) : faceValue;
  const holeIndex = Number(record.hole ?? record.holeNum ?? record.index) - 1;
  if (!faceLabel || holeIndex < 0) return rows;

  const nextRows = rows.map((row) => ({ ...row, cells: [...row.cells] }));
  let row = nextRows.find((item) => item.label === faceLabel);
  if (!row) {
    row = { label: faceLabel, cells: [] };
    nextRows.push(row);
  }
  while (row.cells.length <= holeIndex) row.cells.push('empty');
  row.cells[holeIndex] = normalizeHoleCell(record.final_result ?? record.result ?? record.warnType);
  return nextRows.sort((left, right) => left.label.localeCompare(right.label));
}

export default function DashboardPage(_props: DashboardPageProps) {
  const [running, setRunning] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [modelValue, setModelValue] = useState(dashboardSnapshot.model);
  const [modelOptions, setModelOptions] = useState<DictOption[]>([
    { dictLabel: dashboardSnapshot.model, dictValue: dashboardSnapshot.model },
  ]);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelSaving, setModelSaving] = useState(false);
  const [statusRows, setStatusRows] = useState<StatusRow[]>(dashboardSnapshot.statusRows);
  const [workpiece, setWorkpiece] = useState(dashboardSnapshot.workpiece);
  const [face, setFace] = useState<number | undefined>(dashboardSnapshot.face);
  const [hole, setHole] = useState<number | undefined>(dashboardSnapshot.hole);
  const [alarmType, setAlarmType] = useState<string | undefined>(dashboardSnapshot.alarmType);
  const [stats, setStats] = useState<StatItem[]>(dashboardSnapshot.stats);
  const [holeRows, setHoleRows] = useState<HoleRow[]>(dashboardSnapshot.holeRows);
  const [logItems, setLogItems] = useState<LogItem[]>(dashboardSnapshot.logItems);
  const [imageCards, setImageCards] = useState<ImageCard[]>(dashboardSnapshot.imageCards);
  const objectUrlsRef = useRef<string[]>([]);
  const aliveRef = useRef(true);
  const { message } = AntApp.useApp();

  const onlineCount = useMemo(() => statusRows.filter((item) => item.ok).length, [statusRows]);

  const updateModelValue = useCallback((nextModel: string) => {
    if (!nextModel) return;
    setModelOptions((current) => buildModelOptions(current, nextModel));
    setModelValue(nextModel);
  }, []);

  const prependLog = useCallback((item: LogItem) => {
    setLogItems((current) => [item, ...current].slice(0, MAX_LOG_ITEMS));
  }, []);

  const loadImageFromPath = useCallback(
    async (index: number, path: string) => {
      if (index < 0 || !path) return;
      setImageCards((current) =>
        current.map((item, itemIndex) => (itemIndex === index ? { ...item, path, loading: true } : item)),
      );

      try {
        const objectUrl = await fetchDashboardImageObjectUrl(path);
        if (!aliveRef.current) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        const previousUrl = objectUrlsRef.current[index];
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        objectUrlsRef.current[index] = objectUrl;

        setImageCards((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index ? { ...item, src: objectUrl, path, loading: false } : item,
          ),
        );
      } catch {
        setImageCards((current) =>
          current.map((item, itemIndex) => (itemIndex === index ? { ...item, src: '', path, loading: false } : item)),
        );
      }
    },
    [],
  );

  const handleDashboardSocketMessage = useCallback(
    (rawData: unknown) => {
      const envelope = parseSocketData(rawData);
      if (!envelope) return;

      const eventName = formatValue(envelope.event ?? envelope.type ?? envelope.name, '');
      const payload = normalizeEventPayload(envelope);

      if (eventName === 'log_received' || eventName === 'sendLog') {
        prependLog({ color: logColor(payload), text: logText(payload) });
        return;
      }

      if (eventName === 'sendCurrentType') {
        updateModelValue(extractArtifactType(payload));
        return;
      }

      if (eventName === 'current_stage' || eventName === 'sendCurrentStage') {
        const record = toRecord(payload);
        if (!record) return;
        const nextArtifact = formatValue(record.artifact ?? record.artifactCode ?? record.workpiece, '');
        if (nextArtifact) setWorkpiece(nextArtifact);
        const nextFace = Number(record.face ?? record.faceNum);
        const nextHole = Number(record.hole ?? record.holeNum);
        if (Number.isFinite(nextFace)) setFace(nextFace);
        if (Number.isFinite(nextHole)) setHole(nextHole);
        return;
      }

      if (eventName === 'hole_final_result' || eventName === 'sendHoleResult') {
        const record = toRecord(payload);
        const result = formatValue(record?.final_result ?? record?.result ?? record?.warnType, '');
        if (result) setAlarmType(result);
        setHoleRows((current) => applyHoleResult(current, payload));
        return;
      }

      if (eventName === 'statics' || eventName === 'sendStatics') {
        setStats(buildStats(payload));
        return;
      }

      if (eventName === 'surfaceData' || eventName === 'sendSurfaceData') {
        setHoleRows(buildHoleRows(payload));
        return;
      }

      if (eventName === 'sendSensorData' || eventName.startsWith('sensor-send-data-')) {
        const index = sensorImageIndex(eventName, payload);
        const value = formatValue(toRecord(payload)?.value ?? payload, '');
        if (index >= 0 && value) {
          setImageCards((current) =>
            current.map((item, itemIndex) => (itemIndex === index ? { ...item, result: value } : item)),
          );
        }
        return;
      }

      const currentImageIndex = imageIndex(eventName);
      if (currentImageIndex >= 0) {
        const path = extractImagePath(payload);
        if (path) {
          void loadImageFromPath(currentImageIndex, path);
        }
      }
    },
    [loadImageFromPath, prependLog, updateModelValue],
  );

  useEffect(() => {
    aliveRef.current = true;
    let active = true;

    async function bootstrapDashboard() {
      try {
        const [dictResult, currentTypeResult, systemStateResult, hardwareResult] = await Promise.allSettled([
          getDict('artifactType'),
          getCurrentArtifactType(),
          getSystemState(),
          getHardwareSettings(),
        ]);

        if (!active) return;

        const nextModel =
          currentTypeResult.status === 'fulfilled'
            ? extractArtifactType(currentTypeResult.value) || dashboardSnapshot.model
            : dashboardSnapshot.model;

        const nextOptions =
          dictResult.status === 'fulfilled'
            ? buildModelOptions(dictResult.value, nextModel)
            : [{ dictLabel: nextModel, dictValue: nextModel }];
        setModelOptions(nextOptions);
        setModelValue(nextOptions.some((item) => item.dictValue === nextModel) ? nextModel : nextOptions[0]?.dictValue || nextModel);
        let inferredRunning: boolean | null = null;

        if (systemStateResult.status === 'fulfilled') {
          setStatusRows(buildStatusRows(systemStateResult.value));
          inferredRunning = inferRunning(systemStateResult.value);
        }

        if (inferredRunning === null && hardwareResult.status === 'fulfilled') {
          inferredRunning = inferRunning(hardwareResult.value);
        }

        if (inferredRunning !== null) setRunning(inferredRunning);
      } finally {
        if (active) setModelLoading(false);
      }
    }

    void bootstrapDashboard();

    return () => {
      active = false;
      aliveRef.current = false;
      objectUrlsRef.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      objectUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const socket = new WebSocket(getSocketUrl());

    socket.onopen = () => setSocketConnected(true);
    socket.onclose = () => setSocketConnected(false);
    socket.onerror = () => setSocketConnected(false);
    socket.onmessage = (socketEvent) => handleDashboardSocketMessage(socketEvent.data);

    return () => {
      socket.close();
    };
  }, [handleDashboardSocketMessage]);

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
                  {onlineCount}/{statusRows.length}
                </strong>
              </div>
              <div className="status-list">
                {statusRows.map((item) => (
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
                    面 {face} / 孔 {hole}
                  </strong>
                </div>
                <div className="workpiece-value">{workpiece}</div>
                <div className="workpiece-meta">
                  <span>
                    检测面<strong>{face}</strong>
                  </span>
                  <span>
                    孔位<strong>{hole}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="machine-mid-grid">
              <div className="panel stats-panel">
                <div className="panel-title-row">
                  <span>生产统计</span>
                  <strong>{socketConnected ? '实时连接' : '实时断开'}</strong>
                </div>
                <div className="stat-dashboard-grid">
                  {stats.map((item) => (
                    <div className={item.label === '良品率' ? 'stat-box highlight' : 'stat-box'} key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel dashboard-focus-card">
                <span>当前报警类型</span>
                <strong>{alarmType}</strong>
              </div>
            </div>
          </section>

          <div className="image-board">
            {imageCards.map((item) => (
              <div className="machine-image-group" key={item.key}>
                <div className="machine-image-box">
                  {item.src ? (
                    <Image src={item.src} alt={item.label} />
                  ) : (
                    <div className="image-placeholder">
                      <span className="placeholder-icon">▧</span>
                      <span>{item.loading ? '图像加载中' : '暂无图像'}</span>
                    </div>
                  )}
                </div>
                <div className="image-result">{item.result}</div>
              </div>
            ))}
          </div>
        </main>

        <aside className="machine-right">
          <div className="panel holes-panel">
            <div className="panel-title-row">
              <span>孔位检测</span>
            </div>
            {holeRows.map((row) => (
              <div className="hole-row" key={row.label}>
                <span className="hole-row-label">{row.label}</span>
                <div className="hole-row-cells">
                  {row.cells.map((cell, index) => (
                    <span className={`hole-pill ${cell}`} key={`${row.label}-${index}`} />
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
              items={logItems.map((item) => ({
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
