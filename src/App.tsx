import {
  App as AntApp,
  Avatar,
  Button,
  Layout,
  Menu,
  Space,
  Spin,
  Typography,
} from 'antd';
import {
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';
import {
  clearPersistentStorage,
  clearSession,
  getStoredToken,
  getStoredUser,
  labelForRole,
  saveSession,
  tokenFromLoginData,
  canManageSystem,
} from './auth';
import { getCurrentUser, login, setApiErrorNotifier, setApiUnauthorizedHandler } from './api';
import type { User } from './types';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import QueryPage from './pages/QueryPage';
import SystemPage from './pages/SystemPage';

const { Header, Sider, Content } = Layout;

function AppShell() {
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [booting, setBooting] = useState(Boolean(getStoredToken()));
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntApp.useApp();

  const redirectToLogin = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    setApiErrorNotifier((content) => message.error(content));
    return () => setApiErrorNotifier();
  }, [message]);

  useEffect(() => {
    setApiUnauthorizedHandler(redirectToLogin);
    return () => setApiUnauthorizedHandler();
  }, [redirectToLogin]);

  useEffect(() => {
    clearPersistentStorage();
    const handlePageHide = () => {
      clearPersistentStorage();
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, []);

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }
    getCurrentUser()
      .then((nextUser) => {
        setUser(nextUser);
        saveSession(token, nextUser);
      })
      .catch(() => {
        redirectToLogin();
      })
      .finally(() => setBooting(false));
  }, [redirectToLogin, token]);

  const menuItems = useMemo(() => {
    const items = [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '检测主界面' },
      { key: '/query', icon: <SearchOutlined />, label: '数据查询导出' },
    ];
    if (canManageSystem(user)) {
      items.push({ key: '/system', icon: <SettingOutlined />, label: '系统管理' });
    }
    return items;
  }, [user]);

  async function handleLogin(values: { username: string; password: string }) {
    const loginData = await login(values);
    const nextToken = tokenFromLoginData(loginData);
    if (!nextToken) {
      throw new Error('登录成功但未返回 token');
    }
    saveSession(nextToken);
    setToken(nextToken);
    const nextUser = await getCurrentUser().catch(() => ({
      username: values.username,
      roleCode: loginData.roleCode || '3',
      nickName: loginData.nickName || values.username,
    }));
    setUser(nextUser);
    saveSession(nextToken, nextUser);
    navigate('/dashboard', { replace: true });
  }

  if (booting) {
    return (
      <div className="screen-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onSubmit={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout className="app-layout">
      <Sider
        width={232}
        collapsedWidth={76}
        collapsed={collapsed}
        trigger={null}
        className={`app-sider ${collapsed ? 'is-collapsed' : ''}`}
      >
        <div className="brand-block">
          <div className="brand-mark">XY</div>
          <div>
            <Typography.Title level={4}>螺纹孔检测系统</Typography.Title>
            <Typography.Text>高密翔宇汽车改造项目</Typography.Text>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="nav-menu"
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Space size={12}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
              className="sider-toggle"
            />
            <Typography.Text className="header-title">检测数据监控与管理平台</Typography.Text>
          </Space>
          <Space size={12}>
            <Avatar icon={<UserOutlined />} />
            <div className="user-meta">
              <strong>{user?.nickName || user?.username}</strong>
              <span>{labelForRole(user?.roleCode)}</span>
            </div>
          </Space>
        </Header>
        <Content className="app-content">
          <Routes>
            <Route path="/dashboard" element={<DashboardPage user={user} />} />
            <Route path="/query" element={<QueryPage user={user} />} />
            <Route
              path="/system"
              element={canManageSystem(user) ? <SystemPage user={user} /> : <Navigate to="/dashboard" replace />}
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <AntApp>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AntApp>
  );
}
