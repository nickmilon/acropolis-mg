/* eslint-disable no-return-assign */
/* eslint-disable no-undef */
/**
 * @jest-environment node
 */

import { DummyLogger, inspectIt } from 'acropolis-nd/lib/Plato.js';
import { MgClientExt } from '../index.js';
import { mongoConnOptions } from '../config.js';
import { connectAndPing } from '../lib/scripts/connect.js';
// result = await connectAndPing(connUri, true, DummyLogger); // check native client first
// expect(async () => { await connectAndPing(connUri, true, DummyLogger); }).toNotThrow();

// eslint-disable-next-line no-console
console.info('*** set __inspect__ variable in package.json to true || false to view/hide test details ***');

describe('check class', () => {
  const connUri = mongoConnOptions.connUri || __mongoUrl__ || 'mongodb://localhost:27017/test';
  let clientConnected = false;
  let mgClient;
  let dbTest;
  let result;
  const randomValue = () => Math.floor((Math.random() * 10));

  beforeAll(async () => {
    expect(() => { connectAndPing(connUri, true, DummyLogger); }).not.toThrow();
    // connectAndPing (connUri, true, DummyLogger);
    mgClient = await new MgClientExt(connUri, {});
    mgClient.once('connectionReady', () => clientConnected = true);
    await mgClient.connect();
    dbTest = mgClient.db('test');
  });

  afterAll(async () => {
    await mgClient.close();
  });

  it('ping Ms to db should be reasonable < 500 Millisecond', async () => {
    result = await dbTest.command({ ping: 1 });
    expect(result.ok).toEqual(1);
    expect(clientConnected).toEqual(true);
    result = await mgClient.extPingMs(10);
    expect(result).toBeLessThan(500);
  });

  it('gets and methods', () => {
    result = mgClient.extEvents;
    expect(result).toEqual(expect.arrayContaining(['connectionReady', 'ping'])); // some events
    result = mgClient.extDefaultDbName();
    expect(result).toEqual('test');
  });

  it('should insert a document', async () => {
    const coll = dbTest.collection('jest');
    const value = randomValue();
    result = await coll.insertOne({ value });
    expect(result.result.ok).toEqual(1);
    const insertedDoc = await coll.findOne({ _id: result.insertedId });
    expect(insertedDoc.value).toEqual(value);
  });

  it('use dot notation', async () => {
    const collObj = await mgClient.extCollectionsObj();
    const value = randomValue();
    result = await collObj.jest.insertOne({ value });
    const insertedDoc = await collObj.jest.findOne({ _id: result.insertedId });
    expect(insertedDoc.value).toEqual(value);
  });
});
