/* tslint:disable:no-string-literal */
/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */

import { Logger } from 'pino';

export type Request = {
  userId: string;
  roles: string[];
  serviceId: string;
  parameters: Record<string, string>;
  output?: any;
};

export type Context = {
  recursion: number;
  contextId: number;
  rowsAffectedList: any;
  userMessages: string[];
  systemMessages: string[];
  statusCode: string;
  includes: Record<any, any>;
  maxRows?: number;
  serviceEntry?: ServiceEntry;
};

export type ServiceEntry = {
  serviceId: string;
  statements: string;
};

export type StatementNode = {
  cmd: string;
  statement: string;
  parameter: string;
  children?: any[];
};

export type Result = {
  types?: string[];
  headerSql?: string[];
  header?: string[];
  table?: string[][];
  rowsAffected?: number;
  exception?: string;
  from?: number;
  hasMore?: boolean;
  stack?: string | undefined;
};

export type EmtpyResult = Record<any, any>;

export type CondResult = Result | EmtpyResult;

export type RegistryType = any;

export type CommandsType = {
  StartBlock?: any;
  EndBlock?: any;
  Registry?: RegistryType;
};

export type ConfigType = {
  getServiceEntrySql: string;
  saveServiceEntry: string;
  statementsPreprocessor: any;
  logger: Logger;
  ignoredErrors: string[];
};

export type ProcessSql = (sql: string, parameters?: Record<string, string>, context?: any) => Promise<Result>;
export type DataserviceType = { processSql: ProcessSql };
