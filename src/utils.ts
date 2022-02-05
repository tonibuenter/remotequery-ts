import { Logger } from './types';

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
