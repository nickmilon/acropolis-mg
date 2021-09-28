/* eslint-disable no-return-await */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */


import { inspectIt } from 'acropolis-nd/lib/scripts/nodeOnly.js';
import { populateRnd, getPearsonR } from './base.js';
import { MgClientExt } from '../../index.js';
import { mongoConnOptions } from '../../config.js';
import { group } from '../pipelines/stages.js';
import { CollectionScanner } from '../aggregations/collectionScan.js';
import { fileNameTrimmedEqual } from '../../nodeStuff.js';

// const tesDbName = 'test';
// const testColName = 'rand1m'; // streets';

const examples = async (command) => {
  const connUri = mongoConnOptions.connUri || __mongoUrl__ || 'mongodb://localhost:27017/test';
  const mgClient = await new MgClientExt(connUri, {});
  mgClient.once('connectionReady', () => console.log(`connected to ${connUri}`));
  console.time('connect');
  await mgClient.connect();
  console.timeEnd('connect');
  const db = mgClient.db('test');
  async function demo() {
    const coll = db.collection('random');
    console.time('demo');
    const scanner = new CollectionScanner(coll, { fldName: 'cnt', buckets: 4, size: 100 });
    const bucketQueries = await scanner.bucketQueries();
    console.timeEnd('demo');
    inspectIt({ bucketQueries }, console);
    console.log('await scanner.bucketQueries()\n', JSON.stringify(bucketQueries, null, 4));
    const bucketPipeline = await scanner.bucketPipeline(group(null, { docCount: { $sum: 1 } }));
    console.log(' await scanner.bucketPipeline(group(null, { docCount: { $sum: 1 } }))\n', JSON.stringify(bucketPipeline, null, 4));
  }
  switch (command) {
  case 'populate': return await populateRnd(db.collection('random'), 10000, console);
  case 'demo': return await demo();
  case 'pearson': return await getPearsonR(db.collection('random'), 'rnd.int1', 'rnd.int1Fn', console);
  default: break;
  }
};

/** if running as script {@link https://stackoverflow.com/questions/45136831/node-js-require-main-module} */
if (fileNameTrimmedEqual(process.argv[1], import.meta.url)) {
  const arg0Arr = ['populate', 'demo', 'pearson'];
  if (process.argv.length < 3) { console.info(`need  one of ${arg0Arr} as parameter`); process.exit(0); }
  const args = process.argv.slice(2);
  examples(args[0])
    .then((val) => {
      console.log('done', val);
      process.exit(0);
    }).catch((error) => console.log(error));
}

export { examples };
