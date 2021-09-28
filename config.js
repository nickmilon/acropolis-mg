/**
 *  configuration module
 *  dbConn1: [arbitrary_connection_name, mongo uri string, options]
 *  if  mongo uri is null will get foobar value from env variable arbitrary_connection_name
 *  i.e.:  export dbWork="mongodb://localhost:27617"
 *  @todo: get from package when json imports are available const { name, version } = require('./package.json');
 *  @todo: put in on .gitignore and have a sim-linked copy so doesn't get overridden in pulls or git update-index --assume-unchanged
 */

import { MgClientExt } from './lib/ext/clientExt.js';

/**
 * options for document update
 * @typedef {Object} docUpdateOpts
 * @property {string} [DateTimeCreated = 'DtCrt']  field name for DateTimeCreated
 * @property {string} [DateTimeUpdated = 'DtUpd' ] field name for DateTimeUpdated
*/
const docUpdateOpts = {
  DateTimeCreated: 'DtCrt',
  DateTimeUpdated: 'DtUpd',
};

const mongoConnOptions = {
  connUri: 'mongodb://localhost:27517/test',
  connOptions: {},
};

const testsOptions = {
  tesDbName: 'test',
  randomCollName: 'random',
  testCollName: 'test',
  pagingColName: 'paging',
  populateCount: 1000,  // must be  > 999
  populateVersion: 1,
};

export {
  docUpdateOpts,
  MgClientExt,
  mongoConnOptions,
  testsOptions,
};
