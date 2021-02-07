/* eslint-disable no-await-in-loop */

import { inspectIt, DummyLogger } from 'acropolis-nd/lib/Plato.js';
import { Pythagoras, Chronos, Thales } from 'acropolis-nd';

import { arrEquivalent } from 'acropolis-nd/lib/Zeno.js';
import { pearsonR } from '../pipelines/stats.js';

const { DateRandom } = Chronos;
const { randomBetween } = Pythagoras;
const { EnumBits } = Thales;

const getPearsonR = async (coll, fldNameX, fldNameY, logger = null) => {
  const pipeline = pearsonR(fldNameX, fldNameY);
  // logger.log('pipeline', JSON.stringify(pipeline, null, 4));
  const results = await coll.aggregate(pipeline).toArray();
  inspectIt({ pipeline, results }, logger, 'pearsonR');
  return { pipeline, results };
};

const docRndSimple = (maxRandom = 100000, dateStart = new Date(Date.UTC(2017, 0, 1)), dateEnd = new Date(Date.UTC(2020, 11, 31))) => {
  const dtRnd = new DateRandom(dateStart, dateEnd);
  const rnd = {
    int1: randomBetween(1, maxRandom),
    int2: randomBetween(1, maxRandom),
    dtCr: dtRnd.randomDt(),
    ts: dtRnd.randomTs(),
    str: Math.random().toString(36).substr(2, 5),
  };
  rnd.int1Fn = rnd.int1 * Math.trunc(Math.random() * 10, 0);
  rnd.dt = new Date(rnd.ts);
  return rnd;
};

const rndEnumBits = (bEnum) => {
  // const rnd = randomBetween(1, 2 ** bEnum.length);
  const flagsCount = randomBetween(1, bEnum.length); // hos many flags
  const arrFlags = [];
  const arrIntegers = [];
  do {
    const rndFInt = randomBetween(0, bEnum.length - 1);
    if (!arrIntegers.includes(rndFInt)) { // unique only
      const rndFlag = bEnum.keys[rndFInt];
      arrFlags.push(rndFlag);
      arrIntegers.push(rndFInt);
    }
  } while (arrFlags.length < flagsCount);
  // maxCnt = Math.max(maxCnt, flagsCount)
  // console.log({maxCnt, flagsCount, length: arrFlags.length, arrIntegers})

  const intFromFlags = bEnum.intFromFlags(arrFlags);
  // const flagsObjKeys = Object.keys(bEnum.flags(intFromFlags, arrFlags));
  const rt = {
    intFromFlags: bEnum.intFromFlags(arrFlags),
    arrFlags,
    flagsObjAll: bEnum.flags(intFromFlags),
    flagsObjTrue: bEnum.flags(intFromFlags, arrFlags),
    intArrFromFlags: bEnum.intArrFromFlags(arrFlags),
  };
  if (flagsCount !== arrFlags.length) { throw new Error('EnumBits: flagsCount !== arrFlags.length'); } // check loop
  if (!arrEquivalent(bEnum.flagsFromIntArrLookUp(intFromFlags), arrFlags)) { throw new Error('EnumBits: flags != flagsFromIntArrLookUp'); }
  if (!arrEquivalent(bEnum.flagsFromIntArrScan(intFromFlags), arrFlags)) { throw new Error('EnumBits: flags != flagsFromIntArrScan'); }
  if (!arrEquivalent(Object.keys(rt.flagsObjTrue), arrFlags)) { throw new Error('EnumBits: flagsFromArr != arrFlags '); }
  return rt;
};

const populateRnd = async (coll, count = 10000, logger = DummyLogger, version = 2) => {
  const [currentCount, currentDoc] = await Promise.all([coll.countDocuments(), coll.findOne()]);
  if (currentCount >= count && currentDoc.version === version) { return { success: true, result: 'exists' }; }
  if (currentCount > 0) { await coll.drop(); }
  const fruits = ['orange', 'mandarin', 'lemon', 'banana', 'mango', 'strawberry', 'watermelon'];
  const fruitsEnum = new EnumBits(fruits);
  logger.time('populate');
  for (let cnt = 1; cnt <= count; cnt += 1) {
    const doc = { simple: docRndSimple(), flags: rndEnumBits(fruitsEnum, cnt) };
    await coll.insertOne({ cnt, version, doc });
  }
  logger.timeEnd('populate');
  logger.time('createIndexes');
  await coll.createIndexes([
    { key: { cnt: 1 }, unique: true },
    { key: { 'simple.dtCr': 1 } },
    { key: { 'flags.intFromFlags': 1 } },
    { key: { 'flags.arrFlags': 1 } },
    { key: { 'flags.flagsObjTrue': 1 } },
    { key: { 'flags.intArrFromFlags': 1 } },
  ]);
  logger.timeEnd('createIndexes');
  return { success: true, result: 'ok' };
};

export {
  populateRnd,
  docRndSimple,
  getPearsonR,
};
