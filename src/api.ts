import axios from 'axios';
import type {
  ApiResult,
  DictOption,
  InspectionLog,
  InspectionQuery,
  LoginPayload,
  PageResult,
  SystemState,
  User,
} from './types';

export const TOKEN_KEY = 'xy-inspection-token';
export const USER_KEY = 'xy-inspection-user';

export const http = axios.create({
  baseURL: '',
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers.token = token;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.msg || error?.message || '请求失败';
    return Promise.reject(new Error(message));
  },
);

function unwrap<T>(result: ApiResult<T>): T {
  if (typeof result?.code === 'number' && result.code !== 200 && result.code !== 0) {
    throw new Error(result.msg || '接口返回异常');
  }
  return result.data;
}

export async function login(payload: LoginPayload) {
  const { data } = await http.post<ApiResult<Record<string, string>>>('/auth/login', payload);
  return unwrap(data);
}

export async function logout() {
  const { data } = await http.post<ApiResult<boolean>>('/api/SysUser/logout');
  return unwrap(data);
}

export async function getCurrentUser() {
  const { data } = await http.get<ApiResult<User>>('/api/SysUser/getUserInfo');
  return unwrap(data);
}

export async function getDict(dictType: 'userAuth' | 'artifactType' | string) {
  const { data } = await http.get<ApiResult<DictOption[]>>('/api/sysDictData/dictType', {
    params: { dictType },
  });
  return unwrap(data) || [];
}

export async function getSystemState() {
  const { data } = await http.get<ApiResult<SystemState>>('/api/system_state');
  return unwrap(data) || {};
}

export async function getHardwareSettings() {
  const { data } = await http.get<ApiResult<Record<string, unknown>>>('/api/hardware');
  return unwrap(data) || {};
}

export async function startSoftware(startState: 'start' | 'end') {
  const { data } = await http.post<ApiResult<Record<string, string>>>('/api/start_software', {
    start_state: startState,
  });
  return unwrap(data);
}

export async function queryInspectionLogs(query: InspectionQuery, current: number, size: number) {
  const { data } = await http.get<ApiResult<PageResult<InspectionLog>>>('/api/inspection/artifactLog/page', {
    params: { ...query, current, size },
  });
  return unwrap(data);
}

export async function getInspectionLog(id: number) {
  const { data } = await http.get<ApiResult<InspectionLog>>('/api/inspection/artifactLog/getById', {
    params: { id },
  });
  return unwrap(data);
}

export async function deleteInspectionLog(id: number) {
  const { data } = await http.get<ApiResult<boolean>>('/api/inspection/artifactLog/del', {
    params: { id },
  });
  return unwrap(data);
}

export async function updateInspectionLog(payload: Partial<InspectionLog>) {
  const { data } = await http.post<ApiResult<boolean>>('/api/inspection/artifactLog/update', payload);
  return unwrap(data);
}

export async function exportInspectionExcel(ids: string) {
  const response = await http.post('/api/inspection/artifactLog/exportExcel', null, {
    params: { ids },
    responseType: 'blob',
  });
  downloadBlob(response.data, '检测数据.xlsx');
}

export async function exportInspectionPdf(id: number) {
  const response = await http.post('/api/inspection/artifactLog/downloadPdf', null, {
    params: { id },
    responseType: 'blob',
  });
  downloadBlob(response.data, `检测报告-${id}.pdf`);
}

export async function queryUsers(query: Partial<User>, current: number, size: number) {
  const { data } = await http.get<ApiResult<PageResult<User>>>('/api/SysUser/page', {
    params: { ...query, current, size },
  });
  return unwrap(data);
}

export async function createUser(payload: User) {
  const { data } = await http.post<ApiResult<User>>('/api/SysUser/register', payload);
  return unwrap(data);
}

export async function updateUser(payload: User) {
  const { data } = await http.post<ApiResult<boolean>>('/api/SysUser/update', payload);
  return unwrap(data);
}

export async function deleteUser(id: number) {
  const { data } = await http.get<ApiResult<boolean>>('/api/SysUser/del', { params: { id } });
  return unwrap(data);
}

export async function confirmPassword(password: string) {
  const { data } = await http.post<ApiResult<boolean>>('/api/SysUser/againPassword', { password });
  return unwrap(data);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
