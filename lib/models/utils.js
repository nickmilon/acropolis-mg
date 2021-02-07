/* eslint-disable no-param-reassign */

import * as documentConstants from './config.js';

const { DateTimeCreated, DateTimeUpdated } = documentConstants;

/**
 * sets document's fld to current dateTime or timestamp;
 * @param {Object} [document={}] a mongodb document
 * @param {Date} [dt=new Date()] date to set;
 * @param {string} [fld=DateTimeCreated] name of field (defaults to DateTimeCreated constant)
 * @param {boolean} [asTimestamp=false] timestamp if true date otherwise
 * @return {undefined} nothing
 */

const docSetDt = (document = {}, dt = new Date(), fld = DateTimeCreated, asTimestamp = false) => {
  document[fld] = (asTimestamp === false) ? dt : dt.getTime();
};
const docSetDtCrt = (document = {}, dt = new Date(), asTimestamp = false) => docSetDt(document, dt, DateTimeCreated, asTimestamp);
const docSetDtUpd = (document = {}, dt = new Date(), asTimestamp = false) => docSetDt(document, dt, DateTimeUpdated, asTimestamp);
const docSetDtUpdCrt = (document = {}, dt = new Date(), asTimestamp = false) => {
  docSetDt(document, dt, DateTimeCreated, asTimestamp);
  docSetDt(document, dt, DateTimeUpdated, asTimestamp);
};

export {
  docSetDt,
  docSetDtCrt,
  docSetDtUpd,
  docSetDtUpdCrt,
};
