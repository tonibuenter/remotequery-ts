/* WELCOME TO REMOTEQUERY for NODE JS */
/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */

import {
  CommandsType,
  CondResult,
  consoleLogger,
  Context,
  Driver,
  exceptionResult,
  ExceptionResult,
  isError,
  isExceptionResult,
  Logger,
  RegistryArgFun,
  Request,
  Result,
  ResultX,
  ServiceEntry,
  StatementNode,
  toFirst,
  toList
} from 'remotequery-ts-common';
import { deepClone, identCommand, isEmpty, resolveValue, texting, tokenize } from './utils';
import { processRqSqlCommand } from './rq_sql_command';

const ANONYMOUS = 'ANONYMOUS';
const MAX_RECURSION = 40;
const MAX_INCLUDES = 100;
const MAX_WHILE = 100000;
let CONTEXT_COUNTER = 1;

type StatementPreprocessor = (statements: string) => string;

export interface IRemoteQuery {
  addService: (serviceEntry: ServiceEntry) => void;

  setStatementsPreprocessor: (statementPreprocessor: StatementPreprocessor) => void;

  setServiceEntrySql: (sql: string) => void;

  processStatements(sqlStatements: string[]): Promise<Result[]>;

  registerNode: (name: string, fun: RegistryArgFun) => void;

  driver: Driver;

  run: (request: Request) => Promise<ResultX>;

  setLogger: (logger0: Logger) => void;
  getLogger: () => Logger;
}

export class RemoteQuery implements IRemoteQuery {
  public driver: Driver;
  private serviceEntrySql = '';
  public rqCommandName = '';

  public setServiceEntrySql(sql: string) {
    this.serviceEntrySql = sql;
  }

  private statementsPreprocessor: StatementPreprocessor = (s) => s;
  private logger = consoleLogger;
  private ignoredErrors: string[] = [];

  private directServices: Record<string, ServiceEntry> = {};

  private commands: CommandsType = {
    StartBlock: {
      if: true,
      'if-empty': true,
      switch: true,
      while: true,
      foreach: true
    },
    EndBlock: {
      fi: true,
      done: true,
      end: true
    },
    Registry: {},
    Node: {}
  };

  constructor(driver: Driver) {
    this.driver = driver;

    this.commands.Registry.serviceRoot = this.serviceRootCommand;
    this.commands.Registry.sql = this.sqlCommand;
    this.commands.Registry.set = this.setCommand;
    this.commands.Registry['set-if-empty'] = this.setCommand;
    this.commands.Registry.copy = this.setCommand;
    this.commands.Registry['copy-if-empty'] = this.setCommand;
    this.commands.Registry.serviceId = this.serviceIdCommand;
    this.commands.Registry.parameters = this.parametersCommand;
    this.commands.Registry['parameters-if-empty'] = this.parametersCommand;
    this.commands.Registry['if-empty'] = this.ifCommand;
    this.commands.Registry.switch = this.switchCommand;
    this.commands.Registry.while = this.whileCommand;
    this.commands.Registry.comment = this.commentCommand;
    this.commands.Registry.node = this.nodeCommand;
    this.commands.Registry.java = this.nodeCommand;
    this.commands.Registry.fi = identCommand;
    this.commands.Registry.end = identCommand;
    this.commands.Registry.done = identCommand;
    this.commands.Registry.then = identCommand;
    this.commands.Registry.else = identCommand;
    this.commands.Registry.case = identCommand;
    this.commands.Registry.default = identCommand;
    this.commands.Registry.break = identCommand;
    this.commands.Registry.do = identCommand;
    this.commands.Registry.python = identCommand;
    this.commands.Registry.class = identCommand;
    this.commands.Registry.include = identCommand;
  }

  public registerNode(name: string, fun: RegistryArgFun) {
    this.commands.Node[name] = fun;
  }

  public setRqCommandName(columnName: string) {
    this.rqCommandName = columnName;
  }

  public addService(serviceEntry: ServiceEntry) {
    this.directServices[serviceEntry.serviceId] = serviceEntry;
  }

  public async getServiceEntry(serviceId: string): Promise<ServiceEntry | ExceptionResult> {
    let serviceEntry: ServiceEntry = this.directServices[serviceId];
    if (!serviceEntry) {
      const r = await this.driver.getServiceEntry(serviceId);
      if (isExceptionResult(r)) {
        return r;
      }
      serviceEntry = r;
    }

    if (this.statementsPreprocessor) {
      serviceEntry.statements = this.statementsPreprocessor(serviceEntry.statements);
    }
    return serviceEntry;
  }

  setStatementsPreprocessor(preprocessor: StatementPreprocessor) {
    this.statementsPreprocessor = preprocessor;
  }

  async runIntern(request: Request, context: Context): Promise<Result | undefined> {
    if (!request.userId) {
      this.logger.warn(`Request has no userId set. Process continues with userId: ${ANONYMOUS} (${request.serviceId})`);
      request.userId = ANONYMOUS;
    }
    request.parameters = request.parameters || {};
    context.recursion++;

    //
    // GET SERVICE
    //

    const serviceEntry = await this.getServiceEntry(request.serviceId);
    if (isExceptionResult(serviceEntry)) {
      const exception = serviceEntry.exception;
      this.logger.warn(exception);
      return serviceEntry;
    }

    //
    // CHECK ACCESS
    //
    let hasAccess = false;
    const roles = request.roles || [];
    if (serviceEntry.roles.length === 0) {
      hasAccess = true;
    } else {
      for (const role of roles) {
        if (serviceEntry.roles.includes(role)) {
          hasAccess = true;
          break;
        }
      }
    }
    if (hasAccess) {
      this.logger.info(`Access to ${request.serviceId} for ${request.userId} :ok`);
    } else {
      this.logger.warn(
        `No access to ${request.serviceId} for ${request.userId} (service roles: ${serviceEntry.roles}, request roles ${request.roles})`
      );
      context.statusCode = 403;
      return { exception: 'no access' };
    }

    //
    // START PROCESSING STATEMENTS
    //
    this.logger.info(`Service ${serviceEntry.serviceId} found for ${request.userId}`);
    context.serviceEntry = serviceEntry;
    if (typeof serviceEntry.serviceFunction === 'function') {
      return serviceEntry.serviceFunction(request, context);
    }
    const statementNode = await this.prepareCommandBlock(serviceEntry, context);
    return this.processCommandBlock(statementNode, request, {}, serviceEntry, context);
  }

  async run(request: Request): Promise<ResultX> {
    const context: Context = {
      recursion: 0,
      contextId: CONTEXT_COUNTER++,
      rowsAffectedList: [],
      userMessages: [],
      systemMessages: [],
      statusCode: -1,
      includes: {}
    };

    const result = await this.runIntern(request, context);

    const result2 = result || (exceptionResult('Unexpected empty result!') as Result);

    return {
      ...result,
      list: () => toList(result2),
      first: () => toList(result2)[0],
      single: () => (result2.table ? result2.table[0][0] : undefined)
    };
  }

  buildCommandBlockTree(root: StatementNode, statementList: string[], pointer: number) {
    while (pointer < statementList.length) {
      const statementNode = this.parseStatement(statementList[pointer]);
      pointer = pointer + 1;
      if (!statementNode) {
        continue;
      }

      root.children = root.children || [];
      root.children.push(statementNode);

      if (this.commands.EndBlock[statementNode.cmd]) {
        return pointer;
      }

      if (this.commands.StartBlock[statementNode.cmd]) {
        pointer = this.buildCommandBlockTree(statementNode, statementList, pointer);
      }
    }
    return pointer;
  }

  async resolveIncludes(serviceEntry: ServiceEntry, context: Context) {
    const statements = serviceEntry.statements;

    const statementList = tokenize(statements);
    const resolvedList: string[] = [];

    for (const s0 of statementList) {
      const stmt = s0.trim();
      await this.resolveIncludes4Statement(stmt, resolvedList, context);
    }
    return resolvedList;
  }

  async resolveIncludes4Statement(stmt: string, resolvedList: string[], context: Context) {
    const _inc = 'include';
    if (stmt.substring(0, _inc.length) === _inc) {
      let serviceId = '';
      const parsed = this.parseStatement(stmt);
      if (parsed === null) {
        return;
      }
      serviceId = parsed.parameter;
      const se = await this.getServiceEntry(serviceId);
      if (isExceptionResult(se)) {
        this.filteredError(`Did not find service for include: ${serviceId}`);
      } else {
        let counter = context.includes[se.serviceId] || 0;
        counter += 1;
        if (counter < MAX_INCLUDES) {
          context.includes[se.serviceId] = counter;
          const resolvedList2 = await this.resolveIncludes(se, context);

          resolvedList2.forEach((s) => {
            resolvedList.push(s);
          });
        } else {
          this.filteredError('include command overflow:' + se.serviceId);
        }
      }
    } else {
      resolvedList.push(stmt);
    }
  }

  async prepareCommandBlock(se: ServiceEntry, context: Context) {
    const statementList = await this.resolveIncludes(se, context);
    const statementNode: StatementNode = {
      cmd: 'serviceRoot',
      parameter: se.serviceId,
      statement: '',
      children: []
    };
    this.buildCommandBlockTree(statementNode, statementList, 0);
    return statementNode;
  }

  async processCommandBlock(
    statementNode: StatementNode,
    request: Request,
    currentResult: CondResult,
    serviceEntry: ServiceEntry,
    context: Context
  ): Promise<Result | undefined> {
    context.recursion++;

    if (context.recursion > MAX_RECURSION) {
      const msg = 'recursion limit reached with: ' + MAX_RECURSION + '. stop processing.';
      this.logger.error(msg);
      return { exception: msg };
    }

    this.logger.debug(`cmd: ${statementNode.cmd}`);
    const fun = this.commands.Registry[statementNode.cmd];

    if (typeof fun === 'function') {
      try {
        return await fun.bind(this)(request, currentResult, statementNode, serviceEntry, context);
      } catch (e) {
        return exceptionResult(e);
      } finally {
        context.recursion--;
      }
    } else {
      this.logger.error(`unknown command: ${statementNode.cmd} in statement: ${statementNode.statement}`);
      return { exception: 'no command' };
    }
  }

  async serviceRootCommand(
    request: Request,
    currentResult: Result,
    statementNode: StatementNode,
    serviceEntry: ServiceEntry,
    context: Context
  ): Promise<Result | undefined> {
    try {
      for (const snChild of statementNode.children || []) {
        const r = await this.processCommandBlock(snChild, request, currentResult, serviceEntry, context);
        currentResult = r || currentResult;
      }
      return currentResult;
    } catch (e) {
      if (isError(e)) {
        this.logger.error(e.message);
      }
    }
  }

  async sqlCommand(
    request: Request,
    _currentResult: Result,
    statementNode: StatementNode,
    serviceEntry: ServiceEntry,
    context: Context
  ): Promise<Result> {
    const result = await this.driver.processSql(statementNode.parameter, request.parameters, {
      ...context,
      serviceEntry
    });
    if (this.rqCommandName) {
      return processRqSqlCommand(result, request, context, this);
    }
    return result;
  }

  async setCommand(request: Request, currentResult: Result, statementNode: StatementNode) {
    const overwrite = statementNode.cmd === 'set' || statementNode.cmd === 'copy';
    const nv = statementNode.parameter.split(/=/);
    const n = nv[0].trim();
    let v = nv.length > 1 ? nv[1] : '';

    v = resolveValue(v, request).toString();
    const requestValue = request.parameters[n] || '';

    if (overwrite || isEmpty(requestValue.toString())) {
      request.parameters[n] = v;
    }
    return currentResult;
  }

  async serviceIdCommand(
    request: Request,
    _currentResult: Result,
    statementNode: StatementNode,
    _serviceEntry: ServiceEntry,
    context: Context
  ) {
    const iRequest = deepClone(request);
    iRequest.serviceId = statementNode.parameter;
    return this.runIntern(iRequest, context);
  }

  async parametersCommand(
    request: Request,
    currentResult: Result,
    statementNodeIn: StatementNode,
    serviceEntry: ServiceEntry,
    context: Context
  ): Promise<Result> {
    const overwrite = statementNodeIn.cmd === 'parameters';

    const statementNode = this.parseStatement(statementNodeIn.parameter);
    if (statementNode === null) {
      return currentResult;
    }

    const result = await this.processCommandBlock(statementNode, request, currentResult, serviceEntry, context);
    if (!result || !result.header || result.header.length === 0) {
      return currentResult;
    }
    if (overwrite) {
      for (const head of result.header) {
        request.parameters[head] = '';
      }
    }
    const firstRow = toFirst(result);
    if (firstRow) {
      for (const [name, value] of Object.entries(firstRow)) {
        if (!request.parameters[name] || overwrite) {
          request.parameters[name] = value;
        }
      }
    }
    return currentResult;
  }

  async ifCommand(
    request: Request,
    currentResult: Result,
    statementNode: StatementNode,
    serviceEntry: ServiceEntry,
    context: Context
  ) {
    const ifEmpty = statementNode.cmd === 'if-empty';

    const condition = resolveValue(statementNode.parameter, request);
    let isThen = !!condition;

    isThen = ifEmpty ? !isThen : isThen;

    for (const cbChild of statementNode.children || []) {
      if ('else' === cbChild.cmd) {
        isThen = !isThen;
        continue;
      }
      if (isThen) {
        const r = await this.processCommandBlock(cbChild, request, currentResult, serviceEntry, context);
        currentResult = r || currentResult;
      }
    }

    return currentResult;
  }

  async switchCommand(
    request: Request,
    currentResult: Result,
    statementNode: StatementNode,
    serviceEntry: ServiceEntry,
    context: Context
  ) {
    const switchValue = resolveValue(statementNode.parameter, request);
    let inSwitch = false;
    let caseFound = false;

    for (const cbChild of statementNode.children || []) {
      if ('break' === cbChild.cmd) {
        inSwitch = false;
        continue;
      }
      if ('case' === cbChild.cmd) {
        const caseParameter = resolveValue(cbChild.parameter, request);
        if (caseParameter === switchValue) {
          caseFound = true;
          inSwitch = true;
        }
      }
      if ('default' === cbChild.cmd) {
        inSwitch = !caseFound || inSwitch;
        continue;
      }

      if (inSwitch) {
        const r = await this.processCommandBlock(cbChild, request, currentResult, serviceEntry, context);
        currentResult = r || currentResult;
      }
    }
    return currentResult;
  }

  async whileCommand(
    request: Request,
    currentResult: Result,
    statementNode: StatementNode,
    serviceEntry: ServiceEntry,
    context: Context
  ) {
    let counter = 0;
    while (counter < MAX_WHILE) {
      const whileCondition = resolveValue(statementNode.parameter, request);
      if (!whileCondition) {
        break;
      }
      counter++;
      for (const cbChild of statementNode.children || []) {
        const r = await this.processCommandBlock(cbChild, request, currentResult, serviceEntry, context);
        currentResult = r == null ? currentResult : r;
      }
    }
    return currentResult;
  }

  async commentCommand(request: Request, currentResult: Result, statementNode: StatementNode) {
    if (!statementNode.parameter) {
      const comment = texting(statementNode.parameter, request.parameters);
      this.logger.info(comment);
    }
    return currentResult;
  }

  async nodeCommand(
    request: Request,
    currentResult: Result,
    statementNode: StatementNode,
    serviceEntry: ServiceEntry,
    context: Context
  ) {
    const fun = this.commands.Node[statementNode.parameter];
    if (!fun) {
      this.logger.error(`No Commands.Registry.node entry found for ${statementNode.parameter}`);
      return currentResult;
    }
    const result = await fun(request, currentResult, statementNode, serviceEntry, context);
    return result || currentResult;
  }

  //
  //
  // UTILS -start-
  //
  //

  parseStatement(statement: string): StatementNode | null {
    statement = statement.trim();
    if (isEmpty(statement)) {
      return null;
    }
    let firstWhiteSpace = statement.length;
    for (let i = 0; i < statement.length; i++) {
      const ch = statement[i];
      if (/\s/.test(ch)) {
        firstWhiteSpace = i;
        break;
      }
    }

    const cmd = statement.substring(0, firstWhiteSpace).trim();
    let parameters = '';
    if (firstWhiteSpace !== statement.length) {
      parameters = statement.substring(firstWhiteSpace).trim();
    }

    if (this.isCmd(cmd)) {
      return { cmd, parameter: parameters, statement };
    }
    return { cmd: 'sql', parameter: statement, statement };
  }

  isCmd(cmd: string) {
    return this.commands.StartBlock[cmd] || this.commands.EndBlock[cmd] || this.commands.Registry[cmd];
  }

  // CORE -end-

  async processStatements(sqlStatements: string[]): Promise<Result[]> {
    const results: Result[] = [];
    for (const sqlStatement of sqlStatements) {
      const result = await this.driver.processSql(sqlStatement, {}, { maxRows: 10000 });
      results.push(result);
    }
    return results;
  }

  //
  // FROM remotequery-0.9.0.js
  //

  filteredError(_error: unknown) {
    let finalError = '';
    if (_error) {
      if (typeof _error === 'string') {
        finalError = _error;
      } else if (isError(_error)) {
        finalError = _error.message;
      } else if (typeof _error === 'object') {
        finalError = _error.toString();
      }
      if (finalError && this.isFilteredOut(this.ignoredErrors, finalError) === false) {
        this.logger.error(finalError);
      }
    }
  }

  isFilteredOut(ignoredErrors: string[], errorString: string) {
    return (ignoredErrors || []).reduce((a, e) => errorString.includes(e) || a, false);
  }

  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  getLogger(): Logger {
    return this.logger;
  }
}
