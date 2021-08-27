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
  header: string[];
  table: string[][];
  rowsAffected: number;
  exception?: string;
};

export type EmtpyResult = {};

export type CondResult = Result | EmtpyResult;

export type RegistryType = any;

export type CommandsType = {
  StartBlock?: any;
  EndBlock?: any;
  Registry?: RegistryType;
};
