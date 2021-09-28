/* eslint-disable no-console */

import pkg from 'mongodb'; // import from original to bypass any issues from this lib
import { Pythagoras } from 'acropolis-nd';

import { MgClientExt } from '../../index.js';

const { isFileNameTrimmedEqual } = Pythagoras;

const { MongoClient } = pkg;

const connectAndPing = async (connUri, native = true, logger = console) => {
  let client;
  /* @v3 ------------------------------------------------
  if (native === true) {
    // @v3 client = await new MongoClient(connUri, { useUnifiedTopology: true });
  } else { client = await new MgClientExt(connUri, { useUnifiedTopology: true }); }
  */
  if (native === true) {
    client = await new MongoClient(connUri, {});
  } else { client = await new MgClientExt(connUri, {}); }

  client.once('connectionReady', () => logger.info(`connected to mongodb:[${connUri}] using ${(native) ? 'MongoClient' : 'MgClientExt'}`));
  logger.time('connect');
  await client.connect();
  const dbTest = await client.db('test');
  const pingResult = await dbTest.command({ ping: 1 });
  logger.info({ pingResult });
  client.close();
  logger.timeEnd('connect');
  return pingResult; // { ok: 1 }
};

/** if running as script {@link https://stackoverflow.com/questions/45136831/node-js-require-main-module} */
if (isFileNameTrimmedEqual(process.argv[1], import.meta.url)) {
  if (process.argv.length < 3) { console.info('need mongodb connection parameter i.e. "mongodb://localhost:27017/test"'); process.exit(0); }
  connectAndPing(process.argv[2], true) // check native client
    .then(() => connectAndPing(process.argv[2], false)) // check extended client
    .catch((error) => console.log('error while connecting', error));
}

export { connectAndPing };
