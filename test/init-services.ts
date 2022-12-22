/* tslint:disable:no-console */
import { RemoteQuery, Result } from '../src';

export function initServices(rq: RemoteQuery): void {
  rq.registerNode('node1_address', async (): Promise<Result> => {
    return {
      header: ['firstName', 'lastName'],
      table: [
        ['sebastian', 'meier'],
        ['alfred', 'heim']
      ]
    };
  });
}
