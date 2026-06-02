import { TOKEN_KEY, USER_KEY } from './api';
import type { User } from './types';

export function roleLevel(roleCode?: string) {
  const numeric = Number(roleCode);
  return Number.isFinite(numeric) ? numeric : 99;
}

export function isAdmin(user?: User | null) {
  return roleLevel(user?.roleCode) === 1;
}

export function canMutateInspection(user?: User | null) {
  return roleLevel(user?.roleCode) <= 2;
}

export function canManageSystem(user?: User | null) {
  return isAdmin(user);
}

export function saveSession(token: string, user?: User | null) {
  localStorage.setItem(TOKEN_KEY, token);
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function labelForRole(roleCode?: string) {
  if (roleCode === '1') return '一级管理员';
  if (roleCode === '2') return '二级操作员';
  if (roleCode === '3') return '三级查看员';
  return roleCode || '-';
}

export function tokenFromLoginData(data: Record<string, string>) {
  return data.token || data.accessToken || data.Authorization || data.authorization || '';
}
