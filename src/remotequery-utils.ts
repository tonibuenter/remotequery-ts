import { consoleLogger, isError, Logger, Result, ResultX } from 'remotequery-ts-common';
import * as fs from 'fs';
import { processParameter } from './utils';
import { RemoteQuery } from './remotequery';

type GResult = { name: string; counter: number };

export interface IRemoteQueryUtils {
  processRqSqlText(rqSqlText: string, source: string): Promise<GResult>;
  initRepository(sqlDirectories: string[], tags: string[], logger: Logger): Promise<void>;
}

export class RemoteQueryUtils implements IRemoteQueryUtils {
  private rq: RemoteQuery;
  private saveServiceId: string;
  private ignoredErrors = [];
  private logger = consoleLogger;

  constructor(rq: RemoteQuery, saveServiceId: string) {
    this.rq = rq;
    this.saveServiceId = saveServiceId;
  }

  async saveRQService(parameters: Record<string, string>, statements: string, source: string): Promise<ResultX> {
    parameters.source = source;
    parameters.statements = statements;
    return this.rq.run({
      serviceId: this.saveServiceId,
      roles: ['SYSTEM'],
      parameters,
      userId: 'SYSTEM'
    });
  }

  logResult(result: Result): void {
    if (result.exception) {
      this.filteredError(`Result exception: ${result.exception}`);
    } else {
      this.logger.info(`Result: rowsAffected: ${result.rowsAffected}`);
    }
  }

  filteredError(_error: string | Error | unknown): void {
    let finalError = '';
    if (_error) {
      if (typeof _error === 'string') {
        finalError = _error;
      } else if (isError(_error)) {
        finalError = _error.message;
      }
      if (finalError && !this.isFilteredOut(this.ignoredErrors, finalError)) {
        this.logger.error(finalError);
      }
    }
  }

  isFilteredOut(ignoredErrors: string[], errorString: string): boolean {
    return (ignoredErrors || []).reduce((a: boolean, e: string) => errorString.includes(e) || a, false);
  }

  async processSqlText(statements: string, source: string): Promise<{ name: string; counter: number }> {
    const gResult = { name: source || 'processSqlText-process', counter: 0 };

    const lines = statements.split('\n');
    let sqlStatement = '';
    for (let i = 0; i < lines.length; i++) {
      const origLine = lines[i];
      const line = lines[i].trim();
      // comment
      if (line.startsWith('--') || !line) {
        continue;
      }
      // sqlStatement end
      if (line.endsWith(';')) {
        sqlStatement += line.substring(0, line.length - 1) + '\n';
        try {
          const [result] = await this.rq.processStatements([sqlStatement]);
          this.logResult(result);
          gResult.counter++;
        } catch (e) {
          this.logger.error(source + ':' + i + ': ' + e);
        }
        sqlStatement = '';
        continue;
      }
      sqlStatement += origLine + '\n';
    }
    this.logger.info(source + ' : ' + gResult.counter + ' sql statements done.');
    return gResult;
  }

  async processRqSqlText(rqSqlText: string, source: string): Promise<GResult> {
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
              const result = await this.saveRQService(parameters, statements, source);
              this.logResult(result);
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
        const result = await this.saveRQService(parameters, statements, source);
        this.logResult(result);
        gResult.counter++;
      }
    } catch (err) {
      if (isError(err)) {
        this.filteredError(err.message);
        if (err.stack) {
          this.logger.error(err.stack.toString());
        }
      }
    }
    this.logger.info(`${source} : ${gResult.counter} sq sql statements done.`);
    return gResult;
  }

  async initRepository(sqlDirectories: string[], tags: string[], logger: Logger = consoleLogger): Promise<void> {
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
              await this.processSqlText(text, filename);
            }
          } catch (err) {
            this.filteredError(err);
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
              const result = await this.processRqSqlText(text, filename);
              if (!result) {
                this.filteredError('Result is undefined! ');
              }
              // TODO else if (result.exception) {
              //   filteredError(result.exception);
              // } else {
              //   logger.debug(`updates: ${result}`);
              // }
            }
          } catch (err) {
            this.filteredError(err);
          }
        }
      }
    }
  }
}
