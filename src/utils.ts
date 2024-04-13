import { RegistryObj, Request, Result, SRecord, toList, trim } from 'remotequery-ts-common';

export function tokenize(str: string): string[] {
  const rx = /(\\.|[^;])+/gmu;
  return (str.match(rx) || []).map((t) => t.trim().replace('\\;', ';'));
}

export async function identCommand({ currentResult }: RegistryObj): Promise<Result> {
  return Promise.resolve(currentResult);
}

export function isEmpty(e: undefined | null | string | SRecord): boolean {
  return !e || (Array.isArray(e) && e.length === 0);
}

export function deepClone<O = never>(jsonObject: O): O {
  const s = JSON.stringify(jsonObject);
  return JSON.parse(s);
}

export function processParameter(parameters: SRecord, line: string): void {
  const p = line.split('=');
  if (p.length > 1) {
    const name = trim(p[0]);
    parameters[name] = trim(p[1]);
  }
}

export function resolveValue(term: string, request: Request): string {
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

export function texting(templateString: string, map: SRecord): string {
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
