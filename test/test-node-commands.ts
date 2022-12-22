/* tslint:disable:no-console */
/* tslint:disable:no-unused-expression */

import { RemoteQuery, Request as RqRequest, Result as RqResult, toList } from '../src';
import { expect } from 'chai';
import { init } from './init';

describe('test-node-commands', () => {
  let rq: RemoteQuery;

  before(async () => {
    rq = await init();
  });

  it('node1_address.test1', async () => {
    const request: RqRequest = { serviceId: 'node1_address.test1', parameters: {} };
    const result: RqResult = await rq.run(request);
    const list = toList<{ firstName: string; lastName: string }>(result);
    expect(2).to.equals(list.length);
    expect('sebastian').to.equals(list[0].firstName);
    expect('meier').to.equals(list[0].lastName);
    expect('alfred').to.equals(list[1].firstName);
    expect('heim').to.equals(list[1].lastName);
  });
});
