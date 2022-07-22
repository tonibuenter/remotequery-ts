import { Logger, Request, Result, Simple } from './remotequery-types';

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

export function tokenize(str: string, del: string, esc: string): string[] {
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

export function toArr(ro: string | undefined): string[] {
  return (ro ? ro.split(/\s*,\s*/) : []).map((s) => trim(s));
}

export function noopCommand(_: Request, currentResult: Result): Result {
  return currentResult;
}

export function isEmpty(e: undefined | null | string | Simple[]): boolean {
  return !e || (Array.isArray(e) && e.length === 0);
}

export function trim(str: string): string {
  if (!str) {
    return '';
  }
  return str.trim();
}

export function deepClone<O = never>(jsonObject: O): O {
  const s = JSON.stringify(jsonObject);
  return JSON.parse(s);
}

export function processParameter(parameters: Record<string, Simple>, line: string): void {
  const p = line.split('=');
  if (p.length > 1) {
    const name = trim(p[0]);
    parameters[name] = trim(p[1]);
  }
}

export function resolveValue(term: string, request: Request): Simple {
  term = trim(term);
  if (term.charAt(0) === ':') {
    return request.parameters[term.substring(1)] || '';
  }
  if (term.length > 1 && term.charAt(0) === "'" && term.charAt(term.length - 1) === "'") {
    return term.substring(1, term.length - 1);
  }
  return term;
}

export function toMap(data: Result, column: string): Record<string, Record<string, string>> {
  const list = toList(data);

  const r: Record<string, Record<string, string>> = {};
  for (const o of list) {
    const key = o[column];
    r[key] = o;
  }
  return r;
}

export function toFirst(serviceData: Result): Record<string, string> | undefined {
  return toList(serviceData)[0];
}

export function texting(templateString: string, map: Record<string, Simple>): string {
  if (typeof map !== 'object') {
    return templateString;
  }
  Object.keys(map).forEach((name) => {
    const value = map[name];
    const r = new RegExp('\\:' + name, 'g');
    templateString = templateString.replace(r, value.toString());
  });
  return templateString;
}

export function toColumnList(data: Result | Record<string, string>[], columnName: string): string[] {
  let list: Record<string, string>[];
  if (!Array.isArray(data)) {
    list = toList(data);
  } else {
    list = data;
  }
  const columnList = [];
  for (const e of list) {
    if (e[columnName]) {
      columnList.push(e[columnName]);
    }
  }
  return columnList;
}

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
