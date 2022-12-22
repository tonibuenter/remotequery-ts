/* tslint:disable:no-console */
/* tslint:disable:no-unused-expression */

import { RemoteQuery, Request as RqRequest, Result } from '../src';
import { expect } from 'chai';
import { init } from './init';

describe('test-simple', () => {
  let rq: RemoteQuery;

  before(async () => {
    rq = await init();
  });

  it('processStatements', async () => {
    const [result] = await rq.processStatements(['select * from T_APP_PROPERTIES']);
    expect(result).to.be.not.null;
    expect(result.table?.length).to.be.greaterThan(0);
  });
  it('appProperties.select', async () => {
    const request: RqRequest = { serviceId: 'appProperties.select', parameters: {}, userId: 'toni', roles: ['ADMIN'] };
    const result: Result = await rq.run(request);
    expect(result.table?.length).to.be.greaterThan(0);
  });
  it('appProperties.save', async () => {
    const name = 'test0-name';
    const value = 'test-123';

    const del: RqRequest = {
      serviceId: 'appProperties.delete',
      parameters: { name },
      userId: 'toni',
      roles: ['ADMIN']
    };

    rq.run(del);

    let r: Result;
    const insert: RqRequest = {
      serviceId: 'appProperties.insert',
      parameters: { name, value },
      userId: 'toni',
      roles: ['ADMIN']
    };
    r = await rq.run(insert);
    expect(r.rowsAffected).to.be.equal(1);
    //
    const get: RqRequest = {
      serviceId: 'appProperties.get',
      parameters: { name },
      userId: 'toni',
      roles: ['ADMIN']
    };
    r = await rq.run(get);
    const t = r.table;
    if (t) {
      expect(t[0][0]).to.be.equal(value);
    } else {
      expect.fail('Result expected!');
    }
    //
    r = await rq.run(del);
    expect(r.rowsAffected).to.be.equal(1);
  });
});
