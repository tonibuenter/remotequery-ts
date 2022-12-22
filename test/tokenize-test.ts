/* tslint:disable:no-console */
/* tslint:disable:no-unused-expression */
import { expect } from 'chai';

import { tokenize } from '../src';

const tokenize1 = (s: string) => tokenize(s);

describe('test-tokenize', () => {
  it('token simple', async () => {
    const s = 'abc\\;ef';
    const expected = ['abc;ef'];
    checkResult(s, expected);
  });

  it('token esc', async () => {
    const tokens = tokenize1('abc;ef');
    expect(tokens).to.eql(['abc', 'ef']);
  });
  it('token del-esc', async () => {
    const tokens = tokenize1(';;;abc;ef');
    expect(tokens).to.eql(['abc', 'ef']);
  });
  it('token multiline', async () => {
    const s = ' Hello;Wor\nld  ;\nthis ; is a test ';
    console.log(s);
    checkResult(s, ['Hello', 'Wor\nld', 'this', 'is a test']);
  });
});

function checkResult(s: string, exspected: string[]) {
  expect(tokenize1(s)).to.eql(exspected, 'util tokenize failed');
}
