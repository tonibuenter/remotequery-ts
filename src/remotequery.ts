/* WELCOME TO REMOTEQUERY for NODE JS */
/* tslint:disable:no-string-literal */
/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */

import * as fs from 'fs';
import {
  CommandsType,
  CondResult,
  ConfigType,
  Context,
  Logger,
  Request,
  Result,
  ServiceEntry,
  StatementNode
} from './types';

// CORE -start-

// export const SYSTEM_CODE = 4000;

const ANONYMOUS = 'ANONYMOUS';
const MAX_RECURSION = 40;
const MAX_INCLUDES = 100;
const MAX_WHILE = 100000;
const STATEMENT_DELIMITER = ';';
const STATEMENT_ESCAPE = '\\';
let CONTEXT_COUNTER = 1;

export const consoleLogger: Logger = {
  // tslint:disable-next-line:no-console
  debug: (msg: string) => console.debug(msg),
  // tslint:disable-next-line:no-console
  info: (msg: string) => console.info(msg),
  // tslint:disable-next-line:no-console
  warn: (msg: string) => console.warn(msg),
  // tslint:disable-next-line:no-console
  error: (msg: string) => console.error(msg)
};

export const Config: ConfigType = {
  getServiceEntrySql:
    'Example: select SERVICE_ID, STATEMENTS, TAGS, ROLES from T_SERVICE_TABLE where SERVICE_ID = :serviceId',
  saveServiceEntry: '',
  statementsPreprocessor: (s: string) => s,
  logger: consoleLogger,
  ignoredErrors: [],
  processSql: async () => ({})
};

export const Commands: CommandsType = {
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
  Registry: { Node: {} }
};

const DirectServices: Record<string, ServiceEntry> = {};
let fnCounter = 0;

export function addService(
  serviceId: string,
  roles: string[],
  tags: string[],
  serviceFunction: any,
  nodeFunctionName: string
) {
  const functionName = nodeFunctionName || 'fn_node_' + fnCounter++;
  Commands.Registry.Node[nodeFunctionName] = serviceFunction;
  const statements = 'node ' + functionName;
  DirectServices[serviceId] = { serviceId, roles, statements, tags: new Set(tags) };
  return DirectServices;
}

async function runIntern(request: Request, contextIn: any = {}) {
  const context: Context = {
    recursion: 0,
    contextId: CONTEXT_COUNTER++,
    rowsAffectedList: [],
    userMessages: [],
    systemMessages: [],
    statusCode: -1,
    ...contextIn
  };

  if (!request.userId) {
    Config.logger.warn(`Request has no userId set. Process continues with userId: ${ANONYMOUS} (${request.serviceId})`);
    request.userId = ANONYMOUS;
  }
  request.parameters = request.parameters || {};
  context.recursion++;

  //
  // GET SERVICE
  //
  const serviceEntry = await getServiceEntry(request.serviceId);
  if (!serviceEntry) {
    const exception = `No ServiceEntry found for ${request.serviceId}`;
    Config.logger.warn(exception);
    return { exception };
  }

  //
  // CHECK ACCESS
  //
  let hasAccess = false;
  request.roles = request.roles || [];
  if (isEmpty(serviceEntry.roles)) {
    hasAccess = true;
  } else {
    for (const role of request.roles) {
      if (serviceEntry.roles.includes(role)) {
        hasAccess = true;
        break;
      }
    }
  }
  if (hasAccess) {
    Config.logger.info(`Access to ${request.serviceId} for ${request.userId} :ok`);
  } else {
    Config.logger.warn(
      `No access to ${request.serviceId} for ${request.userId} (service roles: ${serviceEntry.roles}, request roles ${request.roles})`
    );
    context.statusCode = '403';
    return { exception: 'no access' };
  }

  //
  // START PROCESSING STATEMENTS
  //
  Config.logger.info(`Service ${serviceEntry.serviceId} found for ${request.userId}`);
  const statementNode = await prepareCommandBlock(serviceEntry, context);
  return await processCommandBlock(statementNode, request, {}, serviceEntry, context);
}

export async function run(request: Request, context = {}) {
  const result = await runIntern(request, context);
  const output = request.output;
  if (result && output === 'list') {
    return toList(result);
  }
  if (result && output === 'single') {
    return result.table ? result.table[0][0] : undefined;
  }
  if (result && output === 'first') {
    return toFirst(result);
  }
  return result;
}

function buildCommandBlockTree(root: StatementNode, statementList: string[], pointer: number) {
  while (pointer < statementList.length) {
    const statementNode = parse_statement(statementList[pointer]);
    pointer = pointer + 1;
    if (!statementNode) {
      continue;
    }

    root.children = root.children || [];
    root.children.push(statementNode);

    if (Commands.EndBlock[statementNode.cmd]) {
      return pointer;
    }

    if (Commands.StartBlock[statementNode.cmd]) {
      pointer = buildCommandBlockTree(statementNode, statementList, pointer);
    }
  }
  return pointer;
}

async function resolveIncludes(serviceEntry: ServiceEntry, context: Context) {
  const statements = serviceEntry.statements;
  context.includes = context.includes || {};
  const _inc = 'include';

  const statementList = tokenize(statements.trim(), STATEMENT_DELIMITER, STATEMENT_ESCAPE);
  const resolvedList: string[] = [];

  for (let stmt of statementList) {
    stmt = stmt.trim();

    if (stmt.substring(0, _inc.length) === _inc) {
      let serviceId = '';
      let se = null;
      try {
        const parsed = parse_statement(stmt);
        if (parsed === null) {
          continue;
        }
        serviceId = parsed.parameter;
        se = await getServiceEntry(serviceId);
        if (se) {
          let counter = context.includes[se.serviceId] || 0;
          counter += 1;
          if (counter < MAX_INCLUDES) {
            context.includes[se.serviceId] = counter;
            const resolvedList2 = await resolveIncludes(se, context);

            resolvedList2.forEach((s) => {
              resolvedList.push(s);
            });
          } else {
            filteredError('include command overflow:' + se.serviceId);
          }
        } else {
          filteredError(`Did not find service for include command: ${serviceId}`);
        }
      } catch (err) {
        filteredError(err);
        resolvedList.push('systemMessage:include-of-error-serviceId: ' + serviceEntry.serviceId);
      }
    } else {
      resolvedList.push(stmt);
    }
  }
  return resolvedList;
}

export async function prepareCommandBlock(se: ServiceEntry, context: Context) {
  context = context || {};
  const statementList = await resolveIncludes(se, context);
  const statementNode: StatementNode = {
    cmd: 'serviceRoot',
    parameter: se.serviceId,
    statement: '',
    children: []
  };
  buildCommandBlockTree(statementNode, statementList, 0);
  return statementNode;
}

async function processCommandBlock(
  statementNode: StatementNode,
  request: Request,
  currentResult: CondResult,
  serviceEntry: ServiceEntry,
  context: Context
) {
  context.recursion++;

  if (context.recursion > MAX_RECURSION) {
    const msg = 'recursion limit reached with: ' + MAX_RECURSION + '. stop processing.';
    Config.logger.error(msg);
    return { exception: msg };
  }

  const fun = Commands.Registry[statementNode.cmd];
  if (typeof fun === 'function') {
    try {
      return await fun(request, currentResult, statementNode, serviceEntry, context);
    } catch (e: any) {
      return { exception: e.message };
    } finally {
      context.recursion--;
    }
  } else {
    Config.logger.error(`unknown command: ${statementNode.cmd} in statement: ${statementNode.statement}`);
    return { exception: 'no command' };
  }
}

function toArr(ro: string | undefined) {
  return (ro ? ro.split(/\s*,\s*/) : []).map((s) => trim(s));
}

export async function getServiceEntry(serviceId: string) {
  let serviceEntry: ServiceEntry = DirectServices[serviceId];
  if (!serviceEntry) {
    const result = await Config.processSql(Config.getServiceEntrySql, { serviceId });
    const raw = toFirst(result);
    serviceEntry = {
      serviceId: raw.serviceId || 'notfound',
      roles: toArr(raw.roles),
      statements: raw.statements || '',
      tags: new Set(toArr(raw.tags))
    };
  }
  if (!serviceEntry) {
    return;
  }
  // if (serviceEntry.roles) {
  //   serviceEntry.roles = serviceEntry.roles.split(/\s*,\s*/);
  //   for (let i = 0; i < serviceEntry.roles.length; i++) {
  //     serviceEntry.roles[i] = trim(serviceEntry.roles[i]);
  //   }
  // } else {
  //   serviceEntry.roles = [];
  // }

  if (Config.statementsPreprocessor) {
    serviceEntry.statements = Config.statementsPreprocessor(serviceEntry.statements);
  }
  return serviceEntry;
}

//
// COMMANDs -start- ...
//

// TODO replace with a processStatements command that is used in all statement lists processing (if, while, for ...)
async function serviceRootCommand(
  request: Request,
  currentResult: Result,
  statementNode: StatementNode,
  serviceEntry: ServiceEntry,
  context: Context
) {
  for (const snChild of statementNode.children || []) {
    const r = await processCommandBlock(snChild, request, currentResult, serviceEntry, context);
    // abort
    if (r === 'abort') {
      return currentResult;
    }
    currentResult = r || currentResult;
  }
  return currentResult;
}

Commands.Registry['serviceRoot'] = serviceRootCommand;

async function sqlCommand(
  request: Request,
  currentResult: Result,
  statementNode: StatementNode,
  serviceEntry: ServiceEntry,
  context: Context
) {
  return await Config.processSql(statementNode.parameter, request.parameters, { serviceEntry, context });
}

Commands.Registry.sql = sqlCommand;

async function setCommand(request: Request, currentResult: Result, statementNode: StatementNode) {
  const overwrite = statementNode.cmd === 'set' || statementNode.cmd === 'copy';
  const nv = tokenize(statementNode.parameter, '=', '\\');
  const n = nv[0].trim();
  let v = nv.length > 1 ? nv[1] : '';

  v = resolve_value(v, request);
  const requestValue = request.parameters[n];

  if (overwrite || isEmpty(requestValue)) {
    request.parameters[n] = v;
  }
  return currentResult;
}

Commands.Registry['set'] = setCommand;
Commands.Registry['set-if-empty'] = setCommand;
Commands.Registry['copy'] = setCommand;
Commands.Registry['copy-if-empty'] = setCommand;

async function serviceIdCommand(
  request: Request,
  currentResult: Result,
  statementNode: StatementNode,
  serviceEntry: ServiceEntry,
  context: Context
) {
  const iRequest = deepClone(request);
  iRequest.serviceId = statementNode.parameter;
  return await runIntern(iRequest, context);
}

Commands.Registry['serviceId'] = serviceIdCommand;

async function parametersCommand(
  request: Request,
  currentResult: Result,
  statementNodeIn: StatementNode,
  serviceEntry: ServiceEntry,
  context: Context
) {
  const overwrite = statementNodeIn.cmd === 'parameters';

  const statementNode = parse_statement(statementNodeIn.parameter);
  if (statementNode === null) {
    return currentResult;
  }

  const result = await processCommandBlock(statementNode, request, currentResult, serviceEntry, context);
  if (!result || !result.header || result.header.length === 0) {
    return currentResult;
  }
  // empty all paramters if overwrite == true
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

Commands.Registry['parameters'] = parametersCommand;
Commands.Registry['parameters-if-empty'] = parametersCommand;

async function ifCommand(
  request: Request,
  currentResult: Result,
  statementNode: StatementNode,
  serviceEntry: ServiceEntry,
  context: Context
) {
  const ifEmpty = statementNode.cmd === 'if-empty';

  const condition = resolve_value(statementNode.parameter, request);
  let isThen = !!condition;

  isThen = ifEmpty ? !isThen : isThen;

  for (const cbChild of statementNode.children || []) {
    if ('else' === cbChild.cmd) {
      isThen = !isThen;
      continue;
    }
    if (isThen) {
      const r = await processCommandBlock(cbChild, request, currentResult, serviceEntry, context);
      currentResult = r || currentResult;
    }
  }

  return currentResult;
}

Commands.Registry['if'] = ifCommand;
Commands.Registry['if-empty'] = ifCommand;

async function switchCommand(
  request: Request,
  currentResult: Result,
  statementNode: StatementNode,
  serviceEntry: ServiceEntry,
  context: Context
) {
  const switchValue = resolve_value(statementNode.parameter, request);
  let inSwitch = false;
  let caseFound = false;

  for (const cbChild of statementNode.children || []) {
    if ('break' === cbChild.cmd) {
      inSwitch = false;
      continue;
    }
    if ('case' === cbChild.cmd) {
      const caseParameter = resolve_value(cbChild.parameter, request);
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
      const r = await processCommandBlock(cbChild, request, currentResult, serviceEntry, context);
      currentResult = r || currentResult;
    }
  }
  return currentResult;
}

Commands.Registry['switch'] = switchCommand;

async function whileCommand(
  request: Request,
  currentResult: Result,
  statementNode: StatementNode,
  serviceEntry: ServiceEntry,
  context: Context
) {
  let counter = 0;
  while (counter < MAX_WHILE) {
    const whileCondition = resolve_value(statementNode.parameter, request);
    if (!whileCondition) {
      break;
    }
    counter++;
    for (const cbChild of statementNode.children || []) {
      const r = await processCommandBlock(cbChild, request, currentResult, serviceEntry, context);
      currentResult = r == null ? currentResult : r;
    }
  }
  return currentResult;
}

Commands.Registry['while'] = whileCommand;

async function abortCommand() {
  return 'abort';
}

Commands.Registry['abort'] = abortCommand;

async function commentCommand(request: Request, currentResult: Result, statementNode: StatementNode) {
  if (!statementNode.parameter) {
    const comment = texting(statementNode.parameter, request.parameters);
    Config.logger.info(comment);
  }
  return currentResult;
}

Commands.Registry['comment'] = commentCommand;

async function nodeCommand(
  request: Request,
  currentResult: Result,
  statementNode: StatementNode,
  serviceEntry: ServiceEntry,
  context: Context
) {
  const fun = Commands.Registry.Node[statementNode.parameter];
  if (!fun) {
    Config.logger.error(`No Commands.Registry.node entry found for ${statementNode.parameter}`);
    return currentResult;
  }
  const result = await fun(request, currentResult, statementNode, serviceEntry, context);
  return result || currentResult;
}

Commands.Registry['node'] = nodeCommand;
Commands.Registry['java'] = nodeCommand;

async function noopCommand(request: Request, currentResult: Result) {
  return currentResult;
}

Commands.Registry['fi'] = noopCommand;
Commands.Registry['end'] = noopCommand;
Commands.Registry['done'] = noopCommand;
Commands.Registry['then'] = noopCommand;
Commands.Registry['else'] = noopCommand;
Commands.Registry['case'] = noopCommand;
Commands.Registry['default'] = noopCommand;
Commands.Registry['break'] = noopCommand;
Commands.Registry['do'] = noopCommand;

Commands.Registry['python'] = noopCommand;
Commands.Registry['class'] = noopCommand;
Commands.Registry['include'] = noopCommand;

//
//
// COMMANDs -end- ...
//
//

//
//
// UTILS -start-
//
//

function parse_statement(statement: string): StatementNode | null {
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

  if (isCmd(cmd)) {
    return { cmd, parameter: parameters, statement };
  }
  return { cmd: 'sql', parameter: statement, statement };
}

function isCmd(cmd: string) {
  return Commands.StartBlock[cmd] || Commands.EndBlock[cmd] || Commands.Registry[cmd];
}

function isEmpty(e: any) {
  return !e || (Array.isArray(e) && e.length === 0);
}

function trim(str: string) {
  if (!str) {
    return '';
  }
  return str.trim();
}

export function tokenize(str: string, del: string, esc: string) {
  if (!str) {
    return [];
  }
  // first we count the tokens
  let inescape = false;
  let pc = '';
  let buf = '';
  for (const c of str) {
    if (c === del && !inescape) {
      continue;
    }
    if (c === esc && !inescape) {
      inescape = true;
      continue;
    }
    inescape = false;
  }
  const tokens = [];

  // now we collect the characters and create all tokens
  let k = 0;
  for (const c of str) {
    if (c === del && !inescape) {
      tokens[k] = buf;
      buf = '';
      k++;
      pc = c;
      continue;
    }
    if (c === esc && !inescape) {
      inescape = true;
      pc = c;
      continue;
    }
    //
    // append
    //
    if (c !== del && pc === esc) {
      buf += pc;
    }
    buf += c;
    pc = c;
    inescape = false;
  }
  tokens[k] = buf;
  return tokens;
}

export function deepClone(jsonObject: any) {
  const s = JSON.stringify(jsonObject);
  return JSON.parse(s);
}

export function resolve_value(term: string, request: Request) {
  term = trim(term);
  if (term.charAt(0) === ':') {
    return request.parameters[term.substring(1)] || '';
  }
  if (term.length > 1 && term.charAt(0) === "'" && term.charAt(term.length - 1) === "'") {
    return term.substring(1, term.length - 1);
  }
  return term;
}

// CORE -end-

//
// Supplementary functions
//

export async function processSqlText(statements: string, source: string) {
  const gResult = {
    name: source || 'processSqlText-process',
    counter: 0
  };

  const lines = statements.split('\n');
  let sqlStatement = '';
  for (let i = 0; i < lines.length; i++) {
    const origLine = lines[i];
    const line = lines[i].trim();
    // comment
    if (line.startsWith('--') || !line) {
      continue;
    }
    // sqlStatement end
    if (line.endsWith(';')) {
      sqlStatement += line.substring(0, line.length - 1) + '\n';
      try {
        const result: Result = await Config.processSql(sqlStatement, {}, { maxRows: 10000 });
        logResult(result);
        gResult.counter++;
      } catch (e: any) {
        Config.logger.error(`${source} : ${i} : ${e.message}`);
      }
      sqlStatement = '';
      continue;
    }
    sqlStatement += origLine + '\n';
  }
  Config.logger.info(`${source} : ${gResult.counter} sql statements done.`);
  return gResult;
}

export async function processRqSqlText(rqSqlText: string, source: string) {
  let parameters = {};
  let statements = '';
  const gResult = {
    name: source || 'processRqSqlText-process',
    counter: 0
  };
  try {
    const lines = rqSqlText.split('\n');
    let inComment = false;
    let inStatement = false;

    for (const line2 of lines) {
      const line = line2.trim();
      if (!line) {
        continue;
      }
      // comment
      if (line.startsWith('--')) {
        if (!inComment) {
          //
          // execute collected
          //
          if (inStatement) {
            const result = await saveRQService(parameters, statements, source);
            logResult(result);
            statements = '';
            parameters = {};
            inStatement = false;
            gResult.counter++;
          }
        }
        inComment = true;
        processParameter(parameters, line.substring(2));
        continue;
      }
      inComment = false;
      inStatement = true;
      statements += line2 + '\n';
    }
    if (inStatement) {
      const result = await saveRQService(parameters, statements, source);
      logResult(result);
      gResult.counter++;
    }
  } catch (err: any) {
    filteredError(err.message);
    Config.logger.error(err.stack.toString());
  }
  Config.logger.info(`${source} : ${gResult.counter} sq sql statements done.`);
  return gResult;
}

function logResult(result: Result) {
  if (result.exception) {
    filteredError(`Result exception: ${result.exception}`);
  } else {
    Config.logger.info(`Result: rowsAffected: ${result.rowsAffected}`);
  }
}

export async function saveRQService(parameters: Record<string, string>, statements: string, source: string) {
  parameters['source'] = source;
  parameters['statements'] = statements;
  return await run({
    serviceId: Config.saveServiceEntry,
    roles: ['SYSTEM'],
    parameters,
    userId: 'SYSTEM'
  });
}

function processParameter(parameters: Record<any, any>, line: string) {
  const p = line.split('=');
  if (p.length > 1) {
    // String name = Utils.camelCase(trim(p[0]))
    const name = trim(p[0]);
    parameters[name] = trim(p[1]);
  }
}

export function statementNodeEquals(actual: StatementNode, expected: StatementNode, assert: any) {
  assert.equal(actual.cmd, expected.cmd);
  actual.children = actual.children || [];
  expected.children = expected.children || [];
  assert.equal(actual.children.length, expected.children.length);
  for (let i = 0; i < actual.children.length; i++) {
    statementNodeEquals(actual.children[i], expected.children[i], assert);
  }
}

export function toColumnList(data: Result, columnName: string) {
  let list: any = data;
  if (!Array.isArray(data)) {
    list = toList(data);
  }
  const columnList = [];
  for (const e of list) {
    if (e[columnName]) {
      columnList.push(e[columnName]);
    }
  }
  return columnList;
}

export function trunk(s: string, n: number) {
  return s && s.length > n ? s.substr(0, n - 3) + '...' : s;
}

export async function initRepository(sqlDirectories: string[], tags: string[]) {
  tags = tags || [''];

  for (const tag of tags) {
    for (const sqlDir of sqlDirectories) {
      if (!fs.existsSync(sqlDir) || !fs.lstatSync(sqlDir).isDirectory()) {
        Config.logger.warn(`Directory does not exist: ${sqlDir}`);
        continue;
      }
      const sqlfileNames = fs.readdirSync(sqlDir).filter((filename) => filename.includes(tag));
      //
      // SQL
      //
      for (const filename of sqlfileNames) {
        try {
          if (filename.endsWith('.sql') && !filename.endsWith('.rq.sql')) {
            Config.logger.info(`Start loading as SQL file: ${filename}`);
            const text = fs.readFileSync(sqlDir + '/' + filename, 'utf8');
            Config.logger.debug(text);
            // TODO let result =
            await processSqlText(text, filename);
            // TODO if (result?.exception) {
            //   filteredError(result.exception);
            // } else {
            //   Config.logger.debug(`updates: ${result}`);
            // }
          }
        } catch (err) {
          filteredError(err);
        }
      }

      //
      // RQ.SQL
      //
      for (const filename of sqlfileNames) {
        try {
          if (filename.endsWith('.rq.sql')) {
            Config.logger.info(`Start loading as RQ-SQL file: ${filename}`);
            const text = fs.readFileSync(sqlDir + '/' + filename, 'utf8');
            Config.logger.debug(text);
            const result = await processRqSqlText(text, filename);
            if (!result) {
              filteredError('Result is undefined! ');
            }
            // TODO else if (result.exception) {
            //   filteredError(result.exception);
            // } else {
            //   Config.logger.debug(`updates: ${result}`);
            // }
          }
        } catch (err) {
          filteredError(err);
        }
      }
    }
  }
}

//
// FROM remotequery-0.9.0.js
//

export function toList(serviceData: Result): Record<string, string>[] {
  if (Array.isArray(serviceData)) {
    return serviceData;
  }
  const list: Record<string, string>[] = [];
  if (serviceData.table && serviceData.header) {
    const header = serviceData.header;
    const table = serviceData.table;

    table.forEach((row) => {
      const obj: Record<string, string> = {};
      list.push(obj);
      for (let j = 0; j < header.length; j++) {
        const head = header[j];
        obj[head] = row[j];
      }
    });
  }
  return list;
}

export function toMap(data: Result, arg0: any) {
  return toMapByColumn(data, arg0);
}

export function toMapByColumn(data: Result, column: any) {
  const list = toList(data);

  const r: any = {};
  for (const o of list) {
    const key = getKey(o);
    r[key] = o;
  }
  return r;

  // TODO return list.reduce((a, e) => (a[getKey(e)] = e), {});

  function getKey(e: Record<string, string>) {
    if (typeof column === 'string') {
      return e[column];
    }
    if (typeof column === 'function') {
      return column(e);
    }
  }
}

export function toFirst(serviceData: Result) {
  return toList(serviceData)[0];
}

export function texting(templateString: string, map: Record<string, string>) {
  if (typeof map !== 'object') {
    return templateString;
  }
  Object.keys(map).forEach((name) => {
    const value = map[name];
    const r = new RegExp('\\:' + name, 'g');
    templateString = templateString.replace(r, value);
  });
  return templateString;
}

function filteredError(error: any) {
  if (error) {
    // const errorString = error.message || error.toString();
    // if (!isFilteredOutMemo(Config.ignoredErrors, errorString)) {
    Config.logger.error(error && error.toString() ? error.toString() : '');
    // }
  }
}
