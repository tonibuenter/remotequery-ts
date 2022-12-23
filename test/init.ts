/* tslint:disable:no-console */
import path from 'path';
import { MySqlDriver } from 'remotequery-ts-mysql';
import { Driver, Logger, RemoteQuery, RemoteQueryUtils } from '../src';
import { consoleLogger } from 'remotequery-ts-common';
import { initServices } from './init-services';

const repoDirs = [path.join(__dirname, './sql')];
const tags = ['init0', 'init1', 'init2'];

let rq: RemoteQuery;

export async function init(): Promise<RemoteQuery> {
  if (rq) {
    console.info('initialized');
    return rq;
  }

  //
  // INIT SQL
  //
  const logger: Logger = consoleLogger;

  const logger1: Logger = {
    debug: () => {
      return;
    },
    info: () => {
      return;
    },
    warn: (msg: string) => console.warn(msg),
    error: (msg: string) => console.error(msg)
  };

  logger1.debug('db debug');

  const mySqlDriver: MySqlDriver = new MySqlDriver({
    user: 'foo',
    password: 'bar',
    host: 'localhost',
    database: 'testdb'
  });
  mySqlDriver.setServiceEntrySql('select * from T_SERVICES where SERVICE_ID = :serviceId');
  mySqlDriver.setSqlLogger(consoleLogger);
  mySqlDriver.setLogger(logger1);
  await initNEXTVAL(mySqlDriver, console);

  const driver: Driver = mySqlDriver;

  rq = new RemoteQuery(driver);

  rq.setLogger(logger);
  rq.setRqCommandName('cmd');

  //
  // INIT initNEXTVAL
  //

  // TODO  rq.Config.ignoredErrors

  const rqu = new RemoteQueryUtils(rq, 'saveService');
  await rqu.initRepository(repoDirs, tags);

  initServices(rq);

  return rq;
}

async function initNEXTVAL(rqDriver: Driver, logger: Logger) {
  await rqDriver.processSqlDirect('drop function if exists nextval', [], -1);

  const createNextvalFun = `
    CREATE FUNCTION NEXTVAL()
      RETURNS BIGINT
      DETERMINISTIC
      LANGUAGE SQL
    BEGIN
      set @maxcounter := (select max(i.COUNTER) from T_SEQUENCE i);
        delete from T_SEQUENCE where COUNTER <> @maxcounter;
      update T_SEQUENCE set COUNTER = COUNTER + 1;
      return  (select max(COUNTER) from T_SEQUENCE);
    END
    `;

  const result = await rqDriver.processSqlDirect(createNextvalFun, [], -1);
  if (result.exception) {
    logger.error(result.exception);
  } else {
    logger.info(JSON.stringify(result));
  }
}
