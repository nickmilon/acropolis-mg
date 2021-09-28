/* eslint-disable no-console */
/* eslint-disable no-return-assign */
/* eslint-disable no-undef */
/**
 * @jest-environment node
 */

import { isInRange } from 'acropolis-nd/lib/Pythagoras.js';
import { inspectIt } from 'acropolis-nd/lib/scripts/nodeOnly.js';
import { MgClientExt } from '../index.js';
import { mongoConnOptions, testsOptions } from '../config.js';
import { group, sampleAutoSize } from '../lib/pipelines/stages.js';
import { CollectionScanner } from '../lib/aggregations/collectionScan.js';
import { populateRnd, getPearsonR } from '../lib/scripts/base.js';
import * as modelsUtils  from '../lib/models/utils.js';

const logger = (__inspect__ === true) ? console : null;
const { tesDbName, randomCollName, testCollName, populateCount, populateVersion } = testsOptions;

describe('check operations', () => {
  const connUri = mongoConnOptions.connUri || __mongoUrl__ || 'mongodb://localhost:27017/test';
  let mgClient;
  let db;
  let collRandom; let collTest;
  let result;
  beforeAll(async () => {
    mgClient = await new MgClientExt(connUri, {});
    // mgClient.once('connectionReady', () => clientConnected = true);
    await mgClient.connect();
    db = mgClient.db(tesDbName);
    collRandom = db.collection(randomCollName);
    collTest = db.collection(testCollName);
    await populateRnd(collRandom, populateCount, logger, populateVersion);
  });

  afterAll(async () => {
    await mgClient.close();
  });

  it('collection has enough records > 999', async () => {
    result = await collRandom.estimatedDocumentCount();
    expect(result).toBeGreaterThan(999);
  });

  it('scanner bucketQueries, bucketPipeline, scan', async () => {
    const buckets = 4;
    const size = await sampleAutoSize(collRandom);
    console.log({ size });
    expect(size).toBeGreaterThan(40);
    expect(size).toBeLessThan(4000);
    const docsPreCount = await collRandom.estimatedDocumentCount();
    expect(docsPreCount).toBeGreaterThan(999);
    const scanner = new CollectionScanner(collRandom, { fldName: 'cnt', buckets, size });
    const bucketQueries = await scanner.bucketQueries();
    inspectIt({ bucketQueries }, logger);
    expect(bucketQueries.length).toEqual(buckets);
    const bucketPipeline = await scanner.bucketPipeline(group(null, { docCount: { $sum: 1 } }));
    inspectIt({ bucketPipeline }, logger);
    const scan = await scanner.bucketScan(group(null, { docCount: { $sum: 1 } }));
    const dtStart = new Date();
    const scanPa = await Promise.all(scan.map((x) => x.toArray()));
    const operationMS = new Date() - dtStart;
    inspectIt({ scanPa }, logger);
    inspectIt({ buckets, size, operationMS }, logger);
    const docsInBuckets = scanPa.map((x) => x[0].docCount).reduce((sum, x) => sum + x);
    inspectIt({ docsPreCount, docsInBuckets }, logger);
    expect(docsInBuckets).toEqual(docsPreCount);
  });

  it('pearson', async () => {
    result = await (await getPearsonR(collRandom, 'doc.simple.int1', 'doc.simple.int1', logger)).results;
    expect(result[0].R).toEqual(1); // R(x,x) (same field) must be 1;
    result = await (await getPearsonR(collRandom, 'doc.simple.int1', 'doc.simple.int1Fn', logger)).results;
    expect(isInRange(result[0].R, 0.5, 0.9)).toEqual(true); // R(x,y) coz  y is function of h;
  });

  it('models', async () => {
    const doc = {};
    result = await collTest.insertOne(doc);
  });
});
