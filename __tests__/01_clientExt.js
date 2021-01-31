/* eslint-disable no-return-assign */
/* eslint-disable no-undef */
/**
 * @jest-environment node
 */

import { MgClientExt } from '../index.js';
import { mongoConnOptions } from '../config.js'


// import { MgClientExt } from 'acropolis-mg';

// import { Logger } from '../legacy-export';
// Logger.setLevel('debug');
// Logger.filter('class', ['Db', 'Server', 'ReplSet', 'Pool', 'Cursor', 'Connection', 'Ping']);

describe('check class', () => {
  const connUri = mongoConnOptions.connUri || __mongoUrl__ || 'mongodb://localhost:27017/test';
  let clientConnected = false;
  let mgClient;
  let dbTest;
  let result;
  const randomValue = () => Math.floor((Math.random() * 10));

  beforeAll(async () => {
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
