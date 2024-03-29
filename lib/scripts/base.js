/* eslint-disable no-await-in-loop */

import { DummyLogger } from 'acropolis-nd/lib/Plato.js';
import { inspectIt } from 'acropolis-nd/lib/scripts/nodeOnly.js';
import { Pythagoras, Chronos, Thales } from 'acropolis-nd';
import { objRndFlat } from 'acropolis-nd/lib/Eratosthenes.js';
import { arrEquivalent } from 'acropolis-nd/lib/Zeno.js';
import { pearsonR } from '../pipelines/stats.js';

const { DateRandom } = Pythagoras;
const { randomBetween } = Pythagoras;
const { EnumBits } = Thales;

const getPearsonR = async (coll, fldNameX, fldNameY, logger = null) => {
  const pipeline = pearsonR(fldNameX, fldNameY);
  // logger.log('pipeline', JSON.stringify(pipeline, null, 4));
  const results = await coll.aggregate(pipeline).toArray();
  // inspectIt({ pipeline, results }, logger, 'pearsonR');
  return { pipeline, results };
};

const rndEnumBits_OLD = (bEnum) => {
  // const rnd = randomBetween(1, 2 ** bEnum.length);
  const flagsCount = randomBetween(1, bEnum.size); // hos many flags
  const arrFlags = [];
  const arrIntegers = [];

  do {
    const rndFInt = randomBetween(0, bEnum.size - 1);
    // console.log('ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')
    // console.log({rndFInt})
    if (!arrIntegers.includes(rndFInt)) { // unique only
      const rndFlag = bEnum.numToFlags(rndFInt);
      arrFlags.push(rndFlag);
      arrIntegers.push(rndFInt);
    }
  } while (arrFlags.length < flagsCount);
  // console.log({foo: 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', arrFlags})
  // return {foo:1}
  // maxCnt = Math.max(maxCnt, flagsCount)
  // console.log({maxCnt, flagsCount, length: arrFlags.length, arrIntegers})
  // const intFromFlags = bEnum.flagsToNum(arrFlags);
  // const flagsObjKeys = Object.keys(bEnum.flags(intFromFlags, arrFlags));

  const rt = {
    intFromFlags: bEnum.flagsToNum(arrFlags),
    arrFlags,
    flagsObjAll: bEnum.flags(intFromFlags),
    flagsObjTrue: bEnum.flags(intFromFlags, arrFlags),
    intArrFromFlags: bEnum.intArrFromFlags(arrFlags),
  };
  return rt;
};

const rndFlagsNum = (bEnum) => randomBetween(0, 2 ** (bEnum.size - 1));

const flagsDoc = (bEnum, num = 0) => {
  const numToFlags = bEnum.numToFlags(num);
  return {
    num,
    numToFlags,
    flagsToPwr2Arr: bEnum.flagsToPwr2Arr(numToFlags),
    flagsToNum: bEnum.flagsToNum(numToFlags),
    flagsToObj: bEnum.flagsToObj(num),
    flagsToObjIncFalse: bEnum.flagsToObjIncFalse(num),
  };
};

const populateRnd = async (coll, count = 1000, logger = DummyLogger, version = 0) => {
  const [currentCount, currentDoc] = await Promise.all([coll.countDocuments(), coll.findOne()]);
  if (currentCount >= count && currentDoc.version === version) { return { success: true, result: 'exists' }; }
  if (currentCount > 0) { await coll.drop(); }
  const fruits = ['orange', 'mandarin', 'lemon', 'banana', 'mango', 'strawberry', 'watermelon'];
  const fruitsEnum = new EnumBits(fruits);
  logger.time('populate');
  for (let cnt = 1; cnt <= count; cnt += 1) {
    const doc = { simple: objRndFlat(), flags: flagsDoc(fruitsEnum, rndFlagsNum(fruitsEnum))};
    await coll.insertOne({ cnt, version, doc });
  }
  logger.timeEnd('populate');
  logger.time('createIndexes');
  await coll.createIndexes([
    { key: { cnt: 1 }, unique: true },
    { key: { 'simple.dtCr': 1 } },
    { key: { 'flags.num': 1 } },
    { key: { 'flags.flagsToPwr2Arr': 1 } },
    { key: { 'flags.flagsToNum': 1 } },
    { key: { 'flags.flagsToObj': 1 } },
    { key: { 'flags.flagsToObjIncFalse': 1 } },
  ]);
  logger.timeEnd('createIndexes');
  return { success: true, result: 'ok' };
};

const populatePaging = async (coll, count = 190, version = 0) => {
  const [currentCount, currentDoc] = await Promise.all([coll.countDocuments(), coll.findOne()]);
  if (currentCount >= count && currentDoc.version === version) { return { success: true, result: 'exists' }; }
  if (currentCount > 0) { await coll.drop(); }
  const pd = (num) => num.toString().padStart(3, '0');
  for (let cnt = 1; cnt <= count; cnt += 1) {
    const doc = {
      _id: pd(cnt),
      pg03: pd(Math.ceil(cnt / 3)),
      pg04: pd(Math.ceil(cnt / 4)),
      pg10: pd(Math.ceil(cnt / 10)),
      rnd1: pd(randomBetween(1, count)),
      rnd2: pd(randomBetween(1, 10)),
      v: version,
    };
    await coll.insertOne(doc);
  }
  return { success: true, result: 'ok' };
};

export {
  populateRnd,
  populatePaging,
  getPearsonR,
};
