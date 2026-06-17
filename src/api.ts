import axios, { type AxiosResponse } from 'axios';
import { message as antdMessage } from 'antd';
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

const PRODUCTION_API_BASE_URL = 'http://127.0.0.1:8081';
const apiBaseURL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? PRODUCTION_API_BASE_URL : '');
const API_SUCCESS_CODE = 200;
const MAX_JSON_BLOB_SIZE = 1024 * 1024;

type ApiErrorNotifier = (content: string) => void;

let apiErrorNotifier: ApiErrorNotifier = (content) => {
  antdMessage.error(content);
};

export function setApiErrorNotifier(notifier?: ApiErrorNotifier) {
  apiErrorNotifier =
    notifier ||
    ((content) => {
      antdMessage.error(content);
    });
}

export function isApiErrorNotified(error: unknown) {
  return Boolean(error && typeof error === 'object' && (error as { apiErrorNotified?: boolean }).apiErrorNotified);
}

function createNotifiedApiError(content: string) {
  const error = new Error(content) as Error & { apiErrorNotified?: boolean };
  error.name = 'ApiError';
  error.apiErrorNotified = true;
  return error;
}

function notifyApiError(content: string) {
  const message = content || '接口返回异常';
  apiErrorNotifier(message);
  return createNotifiedApiError(message);
}

function isApiResultLike(value: unknown): value is ApiResult<unknown> {
  return Boolean(value && typeof value === 'object' && typeof (value as ApiResult<unknown>).code === 'number');
}

function getApiResultErrorMessage(result: ApiResult<unknown>) {
  if (result.code === API_SUCCESS_CODE || result.code === 0) return '';
  return result.msg || '接口返回异常';
}

async function parseBlobApiResult(blob: Blob, headers: AxiosResponse['headers']) {
  const contentType = String(blob.type || headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
  const mayBeJson =
    !contentType ||
    contentType.includes('application/json') ||
    contentType.includes('text/json') ||
    contentType.includes('text/plain');

  if (!mayBeJson || blob.size > MAX_JSON_BLOB_SIZE) return null;

  try {
    const text = await blob.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function extractResponseApiErrorMessage(response: AxiosResponse) {
  const data = response.data;
  const payload =
    typeof Blob !== 'undefined' && data instanceof Blob ? await parseBlobApiResult(data, response.headers) : data;

  if (isApiResultLike(payload)) {
    return getApiResultErrorMessage(payload);
  }

  return '';
}

async function extractRequestErrorMessage(error: unknown) {
  const response = (error as { response?: AxiosResponse })?.response;
  if (response) {
    const apiErrorMessage = await extractResponseApiErrorMessage(response);
    if (apiErrorMessage) return apiErrorMessage;

    const data = response.data as { msg?: unknown } | undefined;
    if (data && typeof data === 'object' && typeof data.msg === 'string') return data.msg;
  }

  return (error as { message?: string })?.message || '请求失败';
}

export const http = axios.create({
  baseURL: apiBaseURL,
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers.token = token;
  }
  return config;
});

http.interceptors.response.use(
  async (response) => {
    const apiErrorMessage = await extractResponseApiErrorMessage(response);
    if (apiErrorMessage) {
      return Promise.reject(notifyApiError(apiErrorMessage));
    }
    return response;
  },
  async (error) => {
    const message = await extractRequestErrorMessage(error);
    return Promise.reject(notifyApiError(message));
  },
);

function unwrap<T>(result: ApiResult<T>): T {
  if (isApiResultLike(result) && result.code !== API_SUCCESS_CODE && result.code !== 0) {
    throw notifyApiError(result.msg || '接口返回异常');
  }
  return result.data;
}

function unwrapOptional<T>(result: ApiResult<T> | T): T {
  if (isApiResultLike(result)) {
    return unwrap(result as ApiResult<T>);
  }
  return result as T;
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

export async function getCurrentArtifactType() {
  const { data } = await http.get<ApiResult<Record<string, string>> | Record<string, string>>('/api/getCurrentArtifactType');
  return unwrapOptional(data) || {};
}

export async function startSoftware(startState: 'start' | 'end') {
  const { data } = await http.post<ApiResult<Record<string, string>>>('/api/start_software', {
    start_state: startState,
  });
  return unwrap(data);
}

export async function setArtifactType(artifactType: string) {
  const { data } = await http.post<ApiResult<Record<string, string>> | Record<string, string>>('/api/setArtifactType', {
    artifactType,
  });
  return unwrapOptional(data);
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

export async function getInspectionImage(path: string) {
  const response = await http.get<Blob>('/api/inspection/artifactLog/image', {
    params: { path },
    responseType: 'blob',
  });
  return response.data;
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
