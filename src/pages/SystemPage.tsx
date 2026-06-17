import {
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ApiOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { createUser, deleteUser, getDict, getSystemState, isApiErrorNotified, queryUsers, updateUser } from '../api';
import { labelForRole, roleLevel } from '../auth';
import type { DictOption, User } from '../types';

interface SystemPageProps {
  user: User | null;
}

export default function SystemPage({ user }: SystemPageProps) {
  const [searchForm] = Form.useForm();
  const [userForm] = Form.useForm<User>();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [roleOptions, setRoleOptions] = useState<DictOption[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const { message } = AntApp.useApp();

  useEffect(() => {
    getDict('userAuth').then(setRoleOptions).catch(() => {
      setRoleOptions([
        { dictLabel: '一级管理员', dictValue: '1' },
        { dictLabel: '二级操作员', dictValue: '2' },
        { dictLabel: '三级查看员', dictValue: '3' },
      ]);
    });
  }, []);

  async function load(page = current, pageSize = size) {
    setLoading(true);
    try {
      const values = searchForm.getFieldsValue();
      const data = await queryUsers(values, page, pageSize);
      setUsers(data.records || []);
      setTotal(data.total || 0);
      setCurrent(data.current || page);
      setSize(data.size || pageSize);
    } catch (error) {
      if (!isApiErrorNotified(error)) {
        message.error(error instanceof Error ? error.message : '用户查询失败');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    userForm.resetFields();
    setModalOpen(true);
  }

  function openEdit(record: User) {
    setEditing(record);
    userForm.setFieldsValue({ ...record, password: '' });
    setModalOpen(true);
  }

  async function submitUser() {
    const values = await userForm.validateFields();
    try {
      if (editing?.id) {
        await updateUser({ ...editing, ...values, id: editing.id });
        message.success('用户已更新');
      } else {
        await createUser(values);
        message.success('用户已新增');
      }
      setModalOpen(false);
      load();
    } catch (error) {
      if (!isApiErrorNotified(error)) {
        message.error(error instanceof Error ? error.message : '保存失败');
      }
    }
  }

  function canDelete(record: User) {
    if (!user) return false;
    if (record.id === user.id && roleLevel(user.roleCode) === 1) return false;
    return roleLevel(record.roleCode) >= roleLevel(user.roleCode);
  }

  async function handleDelete(record: User) {
    if (!record.id) return;
    if (!canDelete(record)) {
      Modal.warning({ title: '权限不足', content: '不可删除权限高于当前账户的用户，一级账户也不可删除自身账号。' });
      return;
    }
    try {
      await deleteUser(record.id);
      message.success('删除成功');
      load();
    } catch (error) {
      if (!isApiErrorNotified(error)) {
        message.error(error instanceof Error ? error.message : '删除失败');
      }
    }
  }

  async function handleCommunicationTest() {
    setTesting(true);
    try {
      const state = await getSystemState();
      const result = {
        工控机: true,
        PLC: state.plc_connected,
        机器人: state.robot_connected,
      };
      setTestResult(result);
      const blocked = Object.entries(result).filter(([, value]) => {
        if (typeof value === 'boolean') return !value;
        return !['true', '1', 'ok', '正常', '已连接'].includes(String(value).toLowerCase());
      });
      if (blocked.length) {
        message.warning(`${blocked.map(([name]) => name).join('、')} 通信阻塞`);
      } else {
        message.success('通信测试正常');
      }
    } catch (error) {
      if (!isApiErrorNotified(error)) {
        message.error(error instanceof Error ? error.message : '通信测试失败');
      }
    } finally {
      setTesting(false);
    }
  }

  const columns = useMemo<ColumnsType<User>>(
    () => [
      {
        title: '序号',
        width: 80,
        render: (_, __, index) => (current - 1) * size + index + 1,
      },
      {
        title: '用户名',
        dataIndex: 'username',
      },
      {
        title: '密码',
        dataIndex: 'password'
      },
      {
        title: '用户权限',
        dataIndex: 'roleCode',
        render: (value, record) => <Tag color={value === '1' ? 'blue' : value === '2' ? 'green' : 'default'}>{record.roleName || labelForRole(value)}</Tag>,
      },
      {
        title: '创建时间',
        dataIndex: 'createTime',
        render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '操作',
        width: 200,
        render: (_, record) => (
          <Space>
            <Button icon={<EditOutlined />} onClick={() => openEdit(record)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该用户？" onConfirm={() => handleDelete(record)} okText="删除" cancelText="取消">
              <Button danger icon={<DeleteOutlined />} disabled={!canDelete(record)}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [current, size, user],
  );

  return (
    <div className="page-stack">

      <Card
        title="用户管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增用户
          </Button>
        }
      >
        <Form form={searchForm} layout="inline" className="query-form" onFinish={() => load(1, size)}>
          <Form.Item name="username" label="用户名">
            <Input allowClear placeholder="用户名" />
          </Form.Item>
          <Form.Item name="roleCode" label="用户权限">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 160 }}
              options={roleOptions.map((item) => ({ label: item.dictLabel, value: item.dictValue }))}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            查询
          </Button>
        </Form>
        <Table
          rowKey={(record) => record.id || record.username}
          loading={loading}
          columns={columns}
          dataSource={users}
          pagination={{
            current,
            pageSize: size,
            total,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
            onChange: (page, pageSize) => load(page, pageSize),
          }}
        />
      </Card>

      <Card title="通信测试按钮">
        <Space wrap>
          <Button type="primary" icon={<ApiOutlined />} loading={testing} onClick={handleCommunicationTest}>
            通信测试
          </Button>
          {testResult &&
              Object.entries(testResult).map(([name, value]) => {
                const ok = typeof value === 'boolean' ? value : ['true', '1', 'ok', '正常', '已连接'].includes(String(value).toLowerCase());
                return (
                    <Tag key={name} color={ok ? 'success' : 'error'}>
                      {name}：{ok ? '正常' : '阻塞'}
                    </Tag>
                );
              })}
        </Space>
      </Card>

      <Modal
        title={editing ? '编辑用户' : '新增用户'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submitUser}
        okText={editing ? '保存' : '注册'}
        cancelText="取消"
      >
        <Form form={userForm} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="中文用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: !editing, message: '请输入密码' }]}
            extra={editing ? '不填写则由后端按原密码处理' : undefined}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          {/*<Form.Item name="nickName" label="昵称">*/}
          {/*  <Input placeholder="昵称" />*/}
          {/*</Form.Item>*/}
          <Form.Item name="roleCode" label="用户权限" rules={[{ required: true, message: '请选择用户权限' }]}>
            <Select options={roleOptions.map((item) => ({ label: item.dictLabel, value: item.dictValue }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
