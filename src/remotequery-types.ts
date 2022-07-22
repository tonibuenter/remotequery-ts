/* tslint:disable:no-string-literal */
/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */

export type Simple = string | number | boolean;

export type Request = {
  userId?: string;
  roles?: string[];
  serviceId: string;
  parameters: Record<string, Simple>;
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
  serviceFunction?: (request: Request, context: Context) => Result;
  roles: string[];
  tags: Set<string>;
};

export type StatementNode = {
  cmd: string;
  statement: string;
  parameter: string;
  children?: any[];
};

export interface ExceptionResult {
  exception: string;
  stack?: string;
}

export interface Result extends Partial<ExceptionResult> {
  types?: string[];
  headerSql?: string[];
  header?: string[];
  table?: string[][];
  rowsAffected?: number;
  from?: number;
  hasMore?: boolean;
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

export type ProcessSql = (sql: string, parameters?: Record<string, Simple>, context?: any) => Promise<Result>;

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

export interface RqDriver {
  getConnection: () => Promise<any>;
  returnConnection: (connection: any) => void; // (con: PoolConnection) => void;
  processSql: ProcessSql;
  processSqlDirect: (sql: string, values: any, maxRows: number) => Promise<Result>;
  logger: Logger;
  sqlLogger: Logger;
}

export function exceptionResult(e: string | Error | unknown): ExceptionResult {
  if (isError(e)) {
    return { exception: e.message, stack: e.stack };
  } else if (typeof e === 'string') {
    return { exception: e };
  }
  return { exception: 'Unknown' };
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isExceptionResult = (data: any): data is ExceptionResult => {
  return data && typeof data.exception === 'string';
};
