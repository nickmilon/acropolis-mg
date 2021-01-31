/* eslint-disable no-console */
/* eslint-disable no-return-assign */
/* eslint-disable no-undef */
/**
 * @jest-environment node
 */

import { inspect } from 'util'
import { MgClientExt } from '../index.js';
import { mongoConnOptions } from '../config.js';
import { group, sampleAutoSize } from '../lib/pipelines/stages.js';
import { CollectionScanner } from '../lib/aggregations/collectionScan.js';

const tesDbName = 'test'; // redshiftdb-production';
const testColName = 'random'; // streets';

const inspectObj = (obj, { showHidden = false, depth = 5, colors = true } = {}) => {
  if (__inspect__) {
    console.info('---------:----------\n', inspect(obj, { showHidden, depth, colors }), '\n--------------------'); 
  }
};

describe('check class', () => {
  const connUri = mongoConnOptions.connUri || __mongoUrl__ || 'mongodb://localhost:27017/test';
  let mgClient;
  let db;
  let coll;
  let result;
  // const randomValue = () => Math.floor((Math.random() * 10));

  beforeAll(async () => {
    mgClient = await new MgClientExt(connUri, {});
    // mgClient.once('connectionReady', () => clientConnected = true);
    await mgClient.connect();
    db = mgClient.db(tesDbName);
    coll = db.collection(testColName);
  });

  afterAll(async () => {
    await mgClient.close();
  });

  it('collection has enough records >100', async () => {
    result = await coll.count();
    expect(result).toBeGreaterThan(100);
  });

  it('scanner bucketQueries, bucketPipeline, scan', async () => {
    const buckets = 4;
    const size = await sampleAutoSize(coll);
    expect(size).toBeGreaterThan(100);
    expect(size).toBeLessThan(4000);
    const docsPreCount = await coll.count();
    expect(docsPreCount).toBeGreaterThan(9999);
    const scanner = new CollectionScanner(coll, { fldName: 'cnt', buckets, size });
    const bucketQueries = await scanner.bucketQueries();
    inspectObj({ bucketQueries });
    expect(bucketQueries.length).toEqual(buckets);
    const bucketPipeline = await scanner.bucketPipeline(group(null, { docCount: { $sum: 1 } }));
    inspectObj({ bucketPipeline });
    const scan = await scanner.bucketScan(group(null, { docCount: { $sum: 1 } }));
    const dtStart = new Date();
    const scanPa = await Promise.all(scan.map((x) => x.toArray()));
    const operationMS = new Date() - dtStart;
    inspectObj({ scanPa });
    inspectObj({ buckets, size, operationMS });
    const docsInBuckets = scanPa.map((x) => x[0].docCount).reduce((sum, x) => sum + x);
    inspectObj({ docsPreCount, docsInBuckets });
    expect(docsInBuckets).toEqual(docsPreCount);
  });
});
