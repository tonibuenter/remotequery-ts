/* tslint:disable:no-console */
/* tslint:disable:no-unused-expression */

import { isExceptionResult, RemoteQuery, Request as RqRequest, Result as RqResult } from '../src';
import { expect } from 'chai';
import { init } from './init';

describe('test-remotequery', () => {
  let rq: RemoteQuery;

  before(async () => {
    rq = await init();
  });

  it('appProperties.select', async () => {
    const request: RqRequest = { serviceId: 'appProperties.select', parameters: {}, userId: 'toni', roles: ['ADMIN'] };
    const result: RqResult = await rq.run(request);
    expect(result.table?.length || 0).to.be.greaterThan(0);
  });

  it('getServiceEntry: unknown serviceId', async () => {
    const unkownServiceId = '-bla-bla-';
    try {
      const se = await rq.getServiceEntry(unkownServiceId);
      if (!isExceptionResult(se)) {
        expect.fail(`No service should be found for ${unkownServiceId}`);
      }
    } catch (e) {
      expect.fail(`No Exception expected for unknown service ${unkownServiceId}`);
    }
  });

  it('getServiceEntry appProperties.select', async () => {
    const serviceId = 'appProperties.select';
    try {
      const se = await rq.getServiceEntry(serviceId);
      if (isExceptionResult(se)) {
        expect.fail(`Missing service ${serviceId}`);
      }
      expect(se.roles?.length);
    } catch (e) {
      expect.fail(`Missing service ${serviceId}`);
    }
  });
});
