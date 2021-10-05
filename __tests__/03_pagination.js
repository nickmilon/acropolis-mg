/* eslint-disable no-await-in-loop */
/* eslint-disable prefer-const */
/* eslint-disable no-console */
/* eslint-disable no-return-assign */
/* eslint-disable no-undef */
/**
 * @jest-environment node
 */

// eslint-disable-next-line import/no-unresolved
import { setTimeout } from 'timers/promises';
import { randomBetween } from 'acropolis-nd/lib/Pythagoras.js';
import { inspectIt } from 'acropolis-nd/lib/scripts/nodeOnly.js';
import { MgClientExt } from '../index.js';
import { mongoConnOptions, testsOptions } from '../config.js';
import { populatePaging } from '../lib/scripts/base.js';
import { stageOrEmpty } from '../lib/pipelines/stages.js';

import { PageScrollMG } from '../lib/models/pagination.js';

const logger = (__inspect__ === true) ? console : null;
const { tesDbName, pagingColName } = testsOptions;

const plPaging = (query, vector) => [
  ...stageOrEmpty(query, '$match'),
  { $sort: (Math.sign(vector) === 1) ? { _id: 1 } : { _id: -1 } },
  { $limit: Math.abs(vector) },
];

/**
 * @param {array} arrA 1st Array
 * @param {array} arrB 2nd Array
 * @returns {boolean} true if arr have === elements in same idx
 */
const arrIdentical = (arrA, arrB) => arrA.length === arrB.length && arrA.every((e, idx) => e === arrB[idx]);

describe('check pagination', () => {
  const pagesScroll = async (coll, vector) => {
    let query = {};
    let pg = {};
    let pl;
    // const pgRnd = new Pagination({ fnNext: (doc) => ({ _id: { $gt: doc._id } }), fnPrev: (doc) => ({ _id: { $lt: doc._id } }) });
    const pgRnd = new PageScrollMG({ fnNext: (doc) => ({ _id: { $gt: doc._id } }), fnPrev: (doc) => ({ _id: { $lt: doc._id } }) });
    let page = 0;
    let idsArr = await coll.aggregate(plPaging(query, Math.sign(vector) * 9999999999999999)).toArray(); // get all records for testing
    idsArr = idsArr.map((x) => x._id);
    const idsArrPg = [];
    inspectIt('', logger, `pagesScroll => |vector:${vector}|`, { breakLength: 140 });
    do {
      page += 1;
      pl = plPaging(query, vector);
      let resultsArr = await coll.aggregate(pl).toArray();
      pg = await pgRnd.getPageObj(resultsArr, pg, vector);
      resultsArr.forEach((x) => idsArrPg.push(x._id));
      query = (Math.sign(vector) === 1) ? pg.next : pg.prev;
      inspectIt({ resultsArr, pg, pl }, logger, `page:${page}`, { breakLength: 140 });
    } while (pg.position === 0);
    // inspectIt( { idsArr, idsArrPg }, logger, 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', { breakLength: 140 });

    if (!arrIdentical(idsArr, idsArrPg)) { throw new Error('idsArr not identical to idsArrPg'); }
    return true;
  };

  const connUri = mongoConnOptions.connUri || __mongoUrl__ || 'mongodb://localhost:27017/test';
  let mgClient;
  let db;
  let collPaging;
  beforeAll(async () => {
    mgClient = await new MgClientExt(connUri, {});
    await mgClient.connect();
    db = mgClient.db(tesDbName);
    collPaging = db.collection(pagingColName);
    // collTest = db.collection(testCollName);
    await populatePaging(collPaging, 20, 1);
  });

  afterAll(async () => {
    await mgClient.close();
    await setTimeout(1000 * 1);
  });

  it('pagination', async () => {
    const countDocs = await collPaging.countDocuments({});
    await pagesScroll(collPaging, 10);
    const pagesArr = [randomBetween(1, countDocs), randomBetween(1, countDocs - 1), countDocs + 1, 3, 5, 10];
    for (let index = 0; index < pagesArr.length; index += 1) {
      await pagesScroll(collPaging, pagesArr[index] * -1);
      await pagesScroll(collPaging, pagesArr[index]);
    }
  });
});
