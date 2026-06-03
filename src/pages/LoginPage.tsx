import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Typography, App as AntApp } from 'antd';
import { useState } from 'react';

interface LoginPageProps {
  onSubmit: (values: { username: string; password: string }) => Promise<void>;
}

export default function LoginPage({ onSubmit }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const { message } = AntApp.useApp();

  async function handleFinish(values: { username: string; password: string }) {
    setLoading(true);
    try {
      await onSubmit(values);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-visual">
        <div className="scan-grid">
          {Array.from({ length: 96 }).map((_, index) => (
            <span key={index} className={index % 11 === 0 || index % 17 === 0 ? 'active' : ''} />
          ))}
        </div>
        <div className="login-copy">
          <Typography.Title>高密翔宇螺纹孔检测系统</Typography.Title>
        </div>
      </div>
      <Card className="login-card">
        <Typography.Title level={3}>用户登录</Typography.Title>
        <Typography.Text type="secondary">请输入中文用户名和密码</Typography.Text>
        <Form layout="vertical" onFinish={handleFinish} className="login-form" autoComplete="off">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="中文用户名" size="large" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
