/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */

import { inspect } from 'util';
import { Pythagoras } from 'acropolis-nd';
import { MgClientExt } from '../../index.js';
import { mongoConnOptions } from '../../config.js';
import { group } from '../pipelines/stages.js';
import { CollectionScanner } from '../aggregations/collectionScan.js';


const { DateRandom } = Pythagoras;

const tesDbName = 'test'; // redshiftdb-production';
const testColName = 'rand1m'; // streets';

const inspectObj = (obj, { showHidden = false, depth = 5, colors = true } = {}) => {
  console.info('---------:----------\n', inspect(obj, { showHidden, depth, colors }), '\n--------------------');
};

const examples = async (command) => {
  const connUri = mongoConnOptions.connUri || __mongoUrl__ || 'mongodb://localhost:27017/test';
  const mgClient = await new MgClientExt(connUri, {});
  mgClient.once('connectionReady', () => console.log(`connected to ${connUri}`));
  console.time('connect');
  await mgClient.connect();
  console.timeEnd('connect');
  const db = mgClient.db('test');
  const close = async () => {
    await mgClient.close();
  };

  async function populate(totalCount = 10000) {
    const coll = db.collection('random');
    // if (await coll.count() === totalCount) { return 'exists'; }
    await coll.deleteMany();
    console.time('populate');
    const dtRnd = new DateRandom(new Date(Date.UTC(2018, 0, 1)), new Date(Date.UTC(2018, 11, 31)));
    let cnt = 1;
    while (cnt <= totalCount) {
      const rnd = {
        int1: Math.trunc(Math.random() * totalCount, 0),
        int2: Math.trunc(Math.random() * totalCount, 0),
        dtCr: dtRnd.randomDt(),
        ts: dtRnd.randomTs(),
        str: Math.random().toString(36).substr(2, 5),
      };
      rnd.int1Fn = rnd.int1 * Math.trunc(Math.random() * 10, 0);
      rnd.dt = new Date(rnd.ts);
      await coll.insertOne({ cnt, rnd });
      cnt += 1;
    }
    console.timeEnd('populate');
    await coll.createIndex({ cnt: 1 }, { unique: true });
    return true;
  }
  async function demo() {
    const coll = db.collection('random');
    console.time('demo');
    const scanner = new CollectionScanner(coll, { fldName: 'cnt', buckets: 4, size: 100 });
    const bucketQueries = await scanner.bucketQueries();
    console.timeEnd('demo');
    // inspectObj({ bucketQueries });
    console.log('await scanner.bucketQueries()\n', JSON.stringify(bucketQueries, null, 4));
    const bucketPipeline = await scanner.bucketPipeline(group(null, { docCount: { $sum: 1 } }));
    console.log(' await scanner.bucketPipeline(group(null, { docCount: { $sum: 1 } }))\n', JSON.stringify(bucketPipeline, null, 4));

  }
  switch (command) {
  case 'populate': await populate(); break;
  case 'demo': await demo(); break;
  default:
    break;
  }

  await close();
};

const args = process.argv.slice(2);
const arg0Arr = ['populate', 'demo'];
console.log('argv', process.argv);

if (args.length === 0) { console.info(`arguments: ${arg0Arr}`); process.exit(0); }
if (!arg0Arr.includes(args[0])) { console.info(`valid arguments: ${arg0Arr}`); process.exit(0); }

examples(args[0])
  .then((val) => {
    console.log('done', val);
  }).catch((error) => console.log(error));

export { examples };
