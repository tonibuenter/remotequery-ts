import { Config, filteredError, logResult, processParameter, processSqlText, run } from './remotequery';
import { isError, Logger, ResultX } from './types';
import * as fs from 'fs';
import { consoleLogger } from './utils';

export async function saveRQService(
  parameters: Record<string, string>,
  statements: string,
  source: string
): Promise<ResultX> {
  parameters.source = source;
  parameters.statements = statements;
  return run({
    serviceId: Config.saveServiceEntry,
    roles: ['SYSTEM'],
    parameters,
    userId: 'SYSTEM'
  });
}

type GResult = { name: string; counter: number };

export async function processRqSqlText(rqSqlText: string, source: string): Promise<GResult> {
  let parameters = {};
  let statements = '';
  const gResult: GResult = {
    name: source || 'processRqSqlText-process',
    counter: 0
  };
  try {
    const lines = rqSqlText.split('\n');
    let inComment = false;
    let inStatement = false;

    for (const line2 of lines) {
      const line = line2.trim();
      if (!line) {
        continue;
      }
      // comment
      if (line.startsWith('--')) {
        if (!inComment) {
          //
          // execute collected
          //
          if (inStatement) {
            const result = await saveRQService(parameters, statements, source);
            logResult(result);
            statements = '';
            parameters = {};
            inStatement = false;
            gResult.counter++;
          }
        }
        inComment = true;
        processParameter(parameters, line.substring(2));
        continue;
      }
      inComment = false;
      inStatement = true;
      statements += line2 + '\n';
    }
    if (inStatement) {
      const result = await saveRQService(parameters, statements, source);
      logResult(result);
      gResult.counter++;
    }
  } catch (err) {
    if (isError(err)) {
      filteredError(err.message);
      if (err.stack) {
        Config.logger.error(err.stack.toString());
      }
    }
  }
  Config.logger.info(`${source} : ${gResult.counter} sq sql statements done.`);
  return gResult;
}

export async function initRepository(
  sqlDirectories: string[],
  tags: string[],
  logger: Logger = consoleLogger
): Promise<void> {
  tags = tags || [''];

  for (const tag of tags) {
    for (const sqlDir of sqlDirectories) {
      if (!fs.existsSync(sqlDir) || !fs.lstatSync(sqlDir).isDirectory()) {
        logger.warn(`Directory does not exist: ${sqlDir}`);
        continue;
      }
      const sqlfileNames = fs.readdirSync(sqlDir).filter((filename) => filename.includes(tag));
      //
      // SQL
      //
      for (const filename of sqlfileNames) {
        try {
          if (filename.endsWith('.sql') && !filename.endsWith('.rq.sql')) {
            logger.info(`Start loading as SQL file: ${filename}`);
            const text = fs.readFileSync(sqlDir + '/' + filename, 'utf8');
            logger.debug(text);
            // TODO let result =
            await processSqlText(text, filename);
          }
        } catch (err) {
          filteredError(err);
        }
      }

      //
      // RQ.SQL
      //
      for (const filename of sqlfileNames) {
        try {
          if (filename.endsWith('.rq.sql')) {
            logger.info(`Start loading as RQ-SQL file: ${filename}`);
            const text = fs.readFileSync(sqlDir + '/' + filename, 'utf8');
            logger.debug(text);
            const result = await processRqSqlText(text, filename);
            if (!result) {
              filteredError('Result is undefined! ');
            }
            // TODO else if (result.exception) {
            //   filteredError(result.exception);
            // } else {
            //   logger.debug(`updates: ${result}`);
            // }
          }
        } catch (err) {
          filteredError(err);
        }
      }
    }
  }
}
