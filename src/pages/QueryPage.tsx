import {
  App as AntApp,
  Button,
  Collapse,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  confirmPassword,
  deleteInspectionLog,
  exportInspectionExcel,
  exportInspectionPdf,
  getDict,
  getInspectionImage,
  getInspectionLog,
  isApiErrorNotified,
  queryInspectionLogs,
  updateInspectionLog,
} from '../api';
import { canMutateInspection } from '../auth';
import type { DictOption, InspectionDetail, InspectionLog, InspectionQuery, User } from '../types';

interface QueryPageProps {
  user: User | null;
}

function resultTag(status?: string) {
  const value = status || '-';
  if (['OK', 'PASS', '合格'].includes(value.toUpperCase())) return <Tag color="success">{value}</Tag>;
  if (['NG', 'FAIL', '不合格'].includes(value.toUpperCase())) return <Tag color="error">{value}</Tag>;
  return <Tag>{value}</Tag>;
}

function flattenDetails(log?: InspectionLog | null): InspectionDetail[] {
  if (!log?.detailList) return [];
  if (Array.isArray(log.detailList)) return log.detailList;
  return Object.values(log.detailList).flat();
}

function isInlineImageSource(path: string) {
  return path.startsWith('data:image/') || path.startsWith('blob:');
}

function isFilledString(value?: string): value is string {
  return Boolean(value);
}

function InspectionThumb({ path }: { path: string }) {
  const [src, setSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    setSrc('');
    setLoading(true);
    setFailed(false);

    if (isInlineImageSource(path)) {
      setSrc(path);
      setLoading(false);
      return;
    }

    getInspectionImage(path)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (loading) return <div className="thumb-placeholder">加载中</div>;
  if (failed || !src) return <div className="thumb-placeholder thumb-placeholder-error">加载失败</div>;

  return <Image src={src} width={88} height={64} className="thumb-img" />;
}

export default function QueryPage({ user }: QueryPageProps) {
  const [form] = Form.useForm();
  const [rows, setRows] = useState<InspectionLog[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [artifactOptions, setArtifactOptions] = useState<DictOption[]>([]);
  const [detail, setDetail] = useState<InspectionLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdfId, setExportingPdfId] = useState<number | null>(null);
  const { message } = AntApp.useApp();

  const canEdit = canMutateInspection(user);

  useEffect(() => {
    getDict('artifactType').then(setArtifactOptions).catch(() => setArtifactOptions([]));
  }, []);

  async function load(page = current, pageSize = size) {
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      const range = values.createTimeRange;
      const query: InspectionQuery = {
        artifactType: values.artifactType,
        artifactCode: values.artifactCode,
        status: values.status,
        createTimeBegin: range?.[0] ? dayjs(range[0]).format('YYYY-MM-DD HH:mm:ss') : undefined,
        createTimeEnd: range?.[1] ? dayjs(range[1]).format('YYYY-MM-DD HH:mm:ss') : undefined,
      };
      const pageResult = await queryInspectionLogs(query, page, pageSize);
      setRows(pageResult.records || []);
      setTotal(pageResult.total || 0);
      setCurrent(pageResult.current || page);
      setSize(pageResult.size || pageSize);
    } catch (error) {
      if (!isApiErrorNotified(error)) {
        message.error(error instanceof Error ? error.message : '查询失败');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function askPassword(action: () => Promise<void>) {
    if (!canEdit) {
      Modal.warning({ title: '权限不足', content: '当前账户无检测结果修改或删除权限。' });
      return;
    }
    let password = '';
    Modal.confirm({
      title: '二次确认',
      content: <Input.Password placeholder="请输入当前账户密码" onChange={(event) => (password = event.target.value)} />,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        if (!password) throw new Error('请输入密码');
        const passed = await confirmPassword(password);
        if (!passed) throw new Error('密码校验失败');
        await action();
      },
    });
  }

  async function openDetail(record: InspectionLog) {
    setDetailOpen(true);
    setDetail(record);
    try {
      setDetail(await getInspectionLog(record.id));
    } catch (error) {
      if (!isApiErrorNotified(error)) {
        message.error(error instanceof Error ? error.message : '详情获取失败');
      }
    }
  }

  async function handleDelete(record: InspectionLog) {
    await askPassword(async () => {
      await deleteInspectionLog(record.id);
      message.success('删除成功');
      load();
    });
  }

  async function toggleStatus(record: InspectionLog) {
    await askPassword(async () => {
      const nextStatus = record.status?.toUpperCase() === 'OK' ? 'NG' : 'OK';
      await updateInspectionLog({ id: record.id, artifactType: record.artifactType, artifactCode: record.artifactCode, status: nextStatus });
      message.success('检测结果已修改');
      load();
    });
  }

  async function handleBatchExport() {
    if (!canEdit) {
      Modal.warning({ title: '权限不足', content: '当前账户无检测数据导出权限。' });
      return;
    }
    if (!selectedRowKeys.length) {
      message.warning('请选择要导出的数据');
      return;
    }
    setExportingExcel(true);
    try {
      await exportInspectionExcel(selectedRowKeys.join(','));
      message.success('导出成功');
    } catch (error) {
      if (!isApiErrorNotified(error)) {
        message.error(error instanceof Error ? error.message : '导出失败');
      }
    } finally {
      setExportingExcel(false);
    }
  }

  async function handlePdfExport(record: InspectionLog) {
    if (!canEdit) {
      Modal.warning({ title: '权限不足', content: '当前账户无检测数据导出权限。' });
      return;
    }
    setExportingPdfId(record.id);
    try {
      await exportInspectionPdf(record.id);
      message.success('PDF 导出成功');
    } catch (error) {
      if (!isApiErrorNotified(error)) {
        message.error(error instanceof Error ? error.message : 'PDF 导出失败');
      }
    } finally {
      setExportingPdfId(null);
    }
  }

  const columns = useMemo<ColumnsType<InspectionLog>>(
    () => [
      {
        title: '型号',
        dataIndex: 'artifactType',
        width: 150,
      },
      {
        title: '产品生产编号',
        dataIndex: 'artifactCode',
        width: 180,
        render: (value, record) => (
          <Button type="link" onClick={() => openDetail(record)} className="link-button">
            {value || record.id}
          </Button>
        ),
      },
      {
        title: '检测结果',
        dataIndex: 'status',
        width: 130,
        render: (value, record) => (
          <Button type="link" icon={<EditOutlined />} disabled={!canEdit} onClick={() => toggleStatus(record)}>
            {resultTag(value)}
          </Button>
        ),
      },
      {
        title: '检测时间',
        dataIndex: 'createTime',
        width: 190,
        render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '操作',
        width: 230,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            {/*<Button icon={<EyeOutlined />} onClick={() => openDetail(record)}>*/}
            {/*  详情*/}
            {/*</Button>*/}
            <Button icon={<FilePdfOutlined />} loading={exportingPdfId === record.id} onClick={() => handlePdfExport(record)}>
              PDF
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [canEdit, exportingPdfId],
  );

  const details = flattenDetails(detail);
  const detailsByFace = details.reduce<Record<string, InspectionDetail[]>>((acc, item) => {
    const key = item.face || '未分面';
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <Typography.Title level={2}>数据查询</Typography.Title>
        </div>
        <Space>
          <Button icon={<FileExcelOutlined />} loading={exportingExcel} onClick={handleBatchExport}>
            导出Excel
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => load(1, size)}>
            刷新
          </Button>
        </Space>
      </div>

      <Form form={form} layout="inline" className="query-form" onFinish={() => load(1, size)}>
        <div className="query-form-main">
          <Form.Item name="artifactType" label="型号">
            <Select
              showSearch
              allowClear
              placeholder="请选择或输入型号"
              options={artifactOptions.map((item) => ({ label: item.dictLabel, value: item.dictValue }))}
              style={{ width: 190 }}
            />
          </Form.Item>
          <Form.Item name="artifactCode" label="产品号">
            <Input allowClear placeholder="支持模糊查询" style={{ width: 210 }} />
          </Form.Item>
        </div>
        <Collapse
          ghost
          className="inline-collapse"
          items={[
            {
              key: 'more',
              label: '更多条件',
              children: (
                <Space wrap>
                  <Form.Item name="status" label="检测结果">
                    <Select
                      allowClear
                      placeholder="全部"
                      style={{ width: 150 }}
                      options={[
                        { label: 'OK', value: 'OK' },
                        { label: 'NG', value: 'NG' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="createTimeRange" label="检测时间">
                    <DatePicker.RangePicker showTime />
                  </Form.Item>
                </Space>
              ),
            },
          ]}
        />
        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
            查询
          </Button>
        </Form.Item>
      </Form>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        scroll={{ x: 980 }}
        pagination={{
          current,
          pageSize: size,
          total,
          showSizeChanger: true,
          showTotal: (value) => `共 ${value} 条`,
          onChange: (page, pageSize) => load(page, pageSize),
        }}
      />

      <Drawer
        title={`检测详情：${detail?.artifactCode || detail?.id || ''}`}
        width={860}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="型号">{detail?.artifactType || '-'}</Descriptions.Item>
          <Descriptions.Item label="产品生产编号">{detail?.artifactCode || '-'}</Descriptions.Item>
          <Descriptions.Item label="检测结果">{resultTag(detail?.status)}</Descriptions.Item>
          <Descriptions.Item label="检测时间">
            {detail?.createTime ? dayjs(detail.createTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
        </Descriptions>
        <Collapse
          className="detail-collapse"
          defaultActiveKey={Object.keys(detailsByFace)}
          items={Object.entries(detailsByFace).map(([face, items]) => ({
            key: face,
            label: `${face} 检测面（${items.length} 个孔位）`,
            children: (
              <div className="detail-grid">
                {items.map((item, index) => (
                  <div className="detail-item" key={item.id || `${face}-${index}`}>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="孔位">{item.hole || '-'}</Descriptions.Item>
                      <Descriptions.Item label="孔类型">{item.holeType || '-'}</Descriptions.Item>
                      <Descriptions.Item label="报警类型">{resultTag(item.warnType)}</Descriptions.Item>
                      <Descriptions.Item label="直径">{item.diameter ?? '-'}</Descriptions.Item>
                      <Descriptions.Item label="深度">{item.depth ?? '-'}</Descriptions.Item>
                      <Descriptions.Item label="有无螺纹">{item.hasThread || '-'}</Descriptions.Item>
                    </Descriptions>
                    <div className="thumb-row">
                      {[item.threadImg, item.diameterImg, item.depthImg].filter(isFilledString).map((path) => (
                        <InspectionThumb key={path} path={path} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ),
          }))}
        />
      </Drawer>
    </div>
  );
}
