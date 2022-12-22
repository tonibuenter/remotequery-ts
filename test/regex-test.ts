/* tslint:disable:no-console */
/* tslint:disable:no-unused-expression */
import { expect } from 'chai';

/*
\w : word character
. : any character

 */
describe('test-tokenize', () => {
  it('rexex basjc', async () => {
    const rx = /A(\w*)L/g;
    const rx2 = /A(.*)L/g;
    const s = 'Das ist ein ApfeL. \\Auf english APPL!';
    console.log('s', s);

    console.log('test', rx.test(s));

    console.log('match', s.match(rx));
    console.log('match2', s.match(rx2));

    console.log('rx.flags', rx.flags);
    console.log('rx.global', rx.global);
  });

  it('token simple', async () => {
    const r = /(\\.|[^;])+/g;
    const s = 'Das;ist;ein;; test\\;fall';
    console.log('s', s);

    console.log('token simple match', s.match(r));
    console.log('token simple match', s.replace('aa', 'bb'));
  });

  it('type of symbol', async () => {
    expect(typeof Symbol.for('hello')).to.equals('symbol');
  });
  it('symbol equals', async () => {
    expect(Symbol('hello')).to.not.equals(Symbol('hello'));
  });
  it('Symbol.for equals', async () => {
    expect(Symbol.for('hello')).to.equals(Symbol.for('hello'));
  });
  it('/a/[Symbol.match]("abc")', async () => {
    expect('abc'.match(/a/)).to.eql(/a/[Symbol.match]('abc'));
  });
});
