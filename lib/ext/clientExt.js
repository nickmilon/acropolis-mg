/* eslint-disable no-await-in-loop */
/* eslint-disable no-underscore-dangle */

import { MongoClient } from 'mongodb';

/**
 * @fileOverview The MgClientExt extends MongoClient native node mongodb client
 * it provides some added functionality and highly opinionated best practices
 * @exports MgClientExt
 * @example cl = new MgClientExt()
 *
*/

/**
 * Creates a new MgClientΕχτ instance extending MongoClient official node mongodb client
 * provides some added functionality with sensible defaults and some useful methods on top of official driver
 * all extra methods and getters names are prefixed with 'ext' to distinguish from native code
 * @class MgClientExt
 * @extends MongoClient
 * @since 0.0.1
 * @param {string} [url = 'mongodb://localhost:27017/test'] The connection URI string
 * @param {object} options [options] Optional settings see: {@link http://mongodb.github.io/node-mongodb-native/3.6/api/MongoClient.html}
 * @param {object} extOpts extended options
 * @fires ChangeStream#close
 * @fires ChangeStream#resumeTokenChanged
 * @return {MgClientExt} a MgClientExt instance.
 */
class MgClientExt extends MongoClient {
  constructor(url, options, { extLogger = null, extName = '' } = {}) {
    const superOptions = { // some sensible defaults
      connectTimeoutMS: 10000,
      // @v3 useUnifiedTopology: true,
      forceServerObjectId: false,
      // @v4 poolSize: 100,
      maxPoolSize: 100, // @v4
      useNewUrlParser: true,
      // loggerLevel: 'info', deprecated after v4
      driverInfo: { name: 'acropolis-mg' },
      // @v4 validateOptions: true,
      ...options, // any options provided override defaults
    };
    super(url, superOptions);
    this.extName = extName;
    this.extLogger = extLogger;
    this._workCollections = null;
    this._props = { superOptions };
  }

  /**
   *
   * @param {Object} db database
   * @returns {Array} collections info
   * ]{ name: 'upload.files', type: 'collection', options: {},
   * info: { readOnly: false, uuid: UUID {...}, idIndex: { v: 2, key: { _id: 1 }, name: '_id_' } }]
   */
  async extListCollections(db) {
    return db.listCollections().toArray();
  }

  /**
   *
   * @param {Object} db object
   * @param {string} collName name of collection
   * @returns {Object}  collection if exists or undefined if not
   */
  async extGetCollection(db, collName) {
    const collections = await db.collections();
    return collections.find((coll) => coll.collectionName === collName);
  }

  /**
  * registers a listener for an event
   * @param {string} eventName name of event
   * @return {object} level warn info etc what logger supports
   * @param {string} level  longing level
   * @param {object} logger the logger
  */
  extLogEvent(eventName, level = 'info', logger = this.extLogger) {
    if (logger) { this.on(eventName, (event) => logger[level]({ [eventName]: event })); }
  }

  /**
   * @param {object} options { noListener: true, returnNonCachedInstance: true}
   * @return {object} [db = default db (as provided in connection uri || test]
  */
  extDefaultDb({ noListener = true, returnNonCachedInstance = true } = {}) {
    return this.db(undefined, { returnNonCachedInstance, noListener });
  }

  /**
   * @return {string} default db name (as provided in connection uri)
  */
  extDefaultDbName() {
    if (this._props.defaultDbName === undefined) { this._props.defaultDbName = this.extDefaultDb().databaseName; }
    return this._props.defaultDbName; // instantiate db only once
  }

  /**
   * @param {(string|undefined)} [dbName] name of database
   * @param {string} [collName] name of collection
   * @return {object}  [collection with default options]
   * @todo will not work with name spaces that contain more than one dot
  */
  extCollection(dbName, collName) { return this.db(dbName).collection(collName); }

  /**
   * @param {string} collName a collection
   * @return {object}  [collection] a collection in default db
  */
  extDefaultCollection(collName) { return this.extDefaultDb().collection(collName); }

  /**
   * @param {string} [nameSpace = 'test.test'] nameSpace of the form 'dbName.collectionName'
   * @return {object}  [collection]
   * @todo will not work with name spaces that contain more than one dot
  */
  extCollectionFromNS(nameSpace = 'test.test') {
    const [dbName, collectionName] = nameSpace.split('.');
    return this.extCollection(dbName, collectionName);
  }

  /**
   * a db dedicated for system/app control operations
   * @return {object}  [db = a db for system control]
   */
  extControlDb() { return this.db('extControl', { returnNonCachedInstance: false, noListener: false }); }

  /**
   * provides an object of the form {collection_name: collection_object} convenient for using dot notation while accessing collections
   * should be used carefully since it instantiates all collections
   * @async
   * @param {string} [dbName = db name or undefined for default db] name of db
   * @return {object} [{collection1, collection2 etc}]
   * @example
   * const dbFoo = await mgClient.extCollectionsObj('dbFoo');
   * await dbFoo.a_collection_name.insertOne({value})
  */
  async extCollectionsObj(dbName) {
    const collections = await this.db(dbName).collections();
    return Object.fromEntries(collections.map((coll) => [coll.collectionName.replace('.', '_'), coll]));
  }

  /**
   * Estimates ping Ms to database using ping mongoDb command (not to be confused with os ping )
   * @async
   * @param {number} [tries=10] how many times to execute ping before averaging results
   * @return {number} average ping Milliseconds
  */
  async extPingMs(tries = 1) {
    const db = this.extDefaultDb();
    let cnt = 0;
    const dtStart = new Date();
    do {
      cnt += 1;
      await db.command({ ping: 1 });
    } while (cnt <= tries);
    return Math.round((new Date() - dtStart) / tries);
  }
}

export { MgClientExt };
