/* tslint:disable:no-string-literal */
/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */

export type Request = {
  userId?: string;
  roles?: string[];
  serviceId: string;
  parameters: Record<string, string>;
};

export type Context = {
  recursion: number;
  contextId: number;
  rowsAffectedList: any;
  userMessages: string[];
  systemMessages: string[];
  statusCode: number;
  includes: Record<string, number>;
  maxRows?: number;
  serviceEntry?: ServiceEntry;
};

export type ServiceEntry = {
  serviceId: string;
  statements: string;
  roles: string[];
  tags: Set<string>;
};

export type StatementNode = {
  cmd: string;
  statement: string;
  parameter: string;
  children?: any[];
};

export interface Result {
  types?: string[];
  headerSql?: string[];
  header?: string[];
  table?: string[][];
  rowsAffected?: number;
  exception?: string;
  from?: number;
  hasMore?: boolean;
  stack?: string;
}

export interface ResultX extends Result {
  first: () => Record<string, string> | undefined;
  list: () => Record<string, string>[];
  single: () => string | undefined;
}

export type EmtpyResult = Record<any, any>;

export type CondResult = Result | EmtpyResult;

export type StartBlockType = 'if' | 'if-else' | 'switch' | 'while' | 'foreach' | string;
export type EndBlockType = 'fi' | 'done' | 'end' | string;
export type RegistryType = 'Node' | string;

export type CommandsType = {
  StartBlock: Record<StartBlockType, true>;
  EndBlock: Record<EndBlockType, true>;
  Registry: Record<RegistryType, any>;
};

export type ProcessSql = (sql: string, parameters?: Record<string, string>, context?: any) => Promise<Result>;

export type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';
export type LoggerFun = (msg: string) => void;
export type Logger = Record<LoggerLevel, LoggerFun>;

export type ConfigType = {
  getServiceEntrySql: string;
  saveServiceEntry: string;
  statementsPreprocessor: (statements: string) => string;
  logger: Logger;
  ignoredErrors: string[];
  processSql: ProcessSql;
};

export const isError = (error: any): error is Error => {
  return typeof error.message === 'string' && typeof error.name === 'string';
};
