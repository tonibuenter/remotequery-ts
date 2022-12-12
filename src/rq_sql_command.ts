import { Context, Request, Result, toList } from 'remotequery-ts-common';
import { RemoteQuery } from './remotequery';
import { dummyServiceEntry } from './utils';

type RqCommandName = 'set' | 'set-if-empty' | 'serviceId' | 'sql';

interface RqCommand extends Record<string, string | undefined> {
  rqCommandName: RqCommandName;
  name?: string;
  serviceId?: string;
  value?: string;
  query?: string;
}

export async function processRqSqlCommand(
  result: Result,
  request: Request,
  context: Context,
  rq: RemoteQuery
): Promise<Result> {
  const { header, table } = result;

  if (!header || !table || !header.includes(rq.rqCommandName)) {
    return result;
  }

  let currentResult = result;
  const commands = toList<RqCommand>(result);

  for (const { [rq.rqCommandName]: rqCommandName, name, value, serviceId, query = '' } of commands) {
    switch (rqCommandName) {
      case 'set': {
        request.parameters[name || ''] = value || '';
        break;
      }
      case 'set-if-empty': {
        request.parameters[name || ''] = request.parameters[name || ''] || value || '';
        break;
      }
      case 'sql': {
        const node = rq.parseStatement(query);
        if (node) {
          const result1 = await rq.driver.processSql(query, request.parameters, context);
          currentResult = result1 || currentResult;
        }
        request.parameters[name || ''] = request.parameters[name || ''] || value || '';
        break;
      }
      case 'serviceId': {
        if (serviceId) {
          const newService = { ...request, serviceId };
          currentResult = (await rq.runIntern(newService, context)) || currentResult;
        }
        request.parameters[name || ''] = request.parameters[name || ''] || value || '';
        break;
      }
    }
  }

  return currentResult;
}
