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

  it('rqSqlCommand.test2', async () => {
    const request: RqRequest = { serviceId: 'rqSqlCommand.test2', parameters: {} };
    const result: RqResult = await rq.run(request);
    const list = toList<{ name: string; value: string }>(result);

    if (list && list.length > 0) {
      expect(list[0].value).to.equals('müller');
    } else {
      expect.fail('No result returned!');
    }
  });

  it('rqSqlCommand.test3', async () => {
    const request: RqRequest = { serviceId: 'rqSqlCommand.test3', parameters: {} };
    const result: RqResult = await rq.run(request);
    const list = toList<{ name: string; value: string }>(result);

    if (list && list.length > 0) {
      expect('müller').to.equals(list[0].value);
    } else {
      expect.fail('No result returned!');
    }
  });
});
