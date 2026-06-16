export type RoleCode = '1' | '2' | '3' | string;

export interface ApiResult<T> {
  code: number;
  msg?: string;
  data: T;
  currentTimeMillis?: number;
}

export interface User {
  id?: number;
  username: string;
  password?: string;
  roleCode: RoleCode;
  roleName?: string;
  nickName?: string;
  createTime?: string;
  updateTime?: string;
  createName?: string;
  updateName?: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface DictOption {
  dictCode?: number;
  dictLabel: string;
  dictValue: string;
  dictType?: string;
}

export interface InspectionDetail {
  id?: number;
  logId?: number;
  face?: string;
  hole?: string;
  holeType?: string;
  filePath?: string;
  warnType?: string;
  diameter?: number;
  diameterImg?: string;
  depth?: number;
  depthImg?: string;
  hasThread?: string;
  threadImg?: string;
}

export type DetailMap = Record<string, InspectionDetail[]>;

export interface InspectionLog {
  id: number;
  artifactType?: string;
  artifactCode?: string;
  status?: string;
  faceNum?: number;
  holeNum?: number;
  detailList?: DetailMap | InspectionDetail[];
  createTime?: string;
  updateTime?: string;
  createName?: string;
  updateName?: string;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages?: number;
}

export interface InspectionQuery {
  artifactType?: string;
  artifactCode?: string;
  status?: string;
  createTimeBegin?: string;
  createTimeEnd?: string;
}

export interface SystemState {
  camera_connected?: boolean | string;
  plc_connected?: boolean | string;
  robot_connected?: boolean | string;
  sensor_connected?: boolean | string;
  light?: boolean | string;
  hardware?: boolean | string;
  algo?: boolean | string;
  [key: string]: unknown;
}

export type DashboardImageSlot = 'diameter' | 'depth' | 'thread';
