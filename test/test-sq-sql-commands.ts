/* tslint:disable:no-console */
/* tslint:disable:no-unused-expression */

import { RemoteQuery, Request as RqRequest, Result as RqResult, toList } from '../src';
import { expect } from 'chai';
import { init } from './init';

describe('test-remotequery', () => {
  let rq: RemoteQuery;

  before(async () => {
    rq = await init();
  });

  it('rqSqlCommand.test1', async () => {
    const request: RqRequest = { serviceId: 'rqSqlCommand.test1', parameters: {} };
    const result: RqResult = await rq.run(request);
    const list = toList<{ name: string; value: string }>(result);

    if (list && list.length > 0) {
      expect(list[0].value).to.equals('world');
    } else {
      expect.fail('No result returned!');
    }
  });
});
