/**
 * remaps some legacy packaged to ESM import  so we don't re-import all the time
 * @todo: revisit when things get stable
 * for other libraries use;
 *    import { createRequire } from 'module';
 *    const require = createRequire(import.meta.url);
*/
import * as mongodb from 'mongodb';

export const {
  Admin,
  AggregationCursor,
  BSONRegExp,
  Binary,
  Chunk,
  Code,
  Collection,
  CommandCursor,
  CoreConnection,
  CoreServer,
  Cursor,
  DBRef,
  Db,
  Decimal128,
  Double,
  GridFSBucket,
  GridStore,
  Int32,
  Logger,
  Long,
  Map,
  MaxKey,
  MinKey,
  MongoClient,
  MongoError,
  MongoNetworkError,
  Mongos,
  ObjectID,
  ObjectId,
  ReadPreference,
  ReplSet,
  Server,
  Symbol,
  Timestamp,
  connect,
  instrument,
} = mongodb.default;
