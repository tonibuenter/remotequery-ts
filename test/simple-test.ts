/* tslint:disable:no-console */
/* tslint:disable:no-unused-expression */
// noinspection SqlResolve
// noinspection Datasource

import { Config as RqConfig, Dataservice, Request as RqRequest, Result, run as rqRun } from '../src';
import * as rq_mysql from 'remotequery-ts-mysql';
import * as pino from 'pino';
import { expect } from 'chai';

describe('rq and sql_rq', () => {
  before(() => {
    rq_mysql.init({ user: 'foo', password: 'bar', host: 'localhost', database: 'eventdb' });
    Dataservice.processSql = rq_mysql.processSql;
    RqConfig.getServiceEntrySql = 'select * from T_SERVICE where SERVICE_ID = :serviceId';
    RqConfig.saveServiceEntry = 'saveService';
    RqConfig.logger = pino({
      level: 'info',
      prettyPrint: {
        colorize: true
      }
    });
  }); // the tests container
  it('processSql', async () => {
    const result: Result = await rq_mysql.processSql('select * from T_APP_PROPERTIES', {}, { maxRows: 100 });
    expect(result).to.be.not.null;
    expect(result.table?.length).to.be.greaterThan(0);
  });
  it('appProperties.select', async () => {
    const request: RqRequest = { serviceId: 'appProperties.select', parameters: {}, userId: 'toni', roles: ['ADMIN'] };
    const result: Result = await rqRun(request);
    expect(result.table?.length).to.be.greaterThan(0);
  });
});
