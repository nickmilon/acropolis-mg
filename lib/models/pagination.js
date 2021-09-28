/* eslint-disable no-param-reassign */

import { ErrAcropolisMG } from '../helpers/errors.js';


/**
 * paging Object
 * @typedef {object} pageObj
 * @property {boolean} onEnd        - Indicates we reached the End of results Array
 * @property {boolean} onBegin      - Indicates we reached the Start of results Array
 * @property {any} next             - Pointer to next page
 * @property {any} prev             - Pointer to previous page
 * @property {integer} direction    - current direction 1 = First to Last -1 = Last to First
 * @property {integer} pageSize     - current page length (results array size)
 * @property {integer} callCount    - how many times getPageObj has been called (to be used by clients for throttling etc)
 * @property {integer} ts           - UTC timestamp of operation (to be used by clients for throttling etc)
 * @example
 * {
 *     next: { _id: { '$gt': ' 20' } },
 *     prev: { _id: { '$lt': ' 16' } },
 *     onEnd: true,
 *     onBegin: false,
 *     direction: 1,
 *     pageSize: 0,
 *     callCount: 2,
 *     ts: 1632691192231
}
 */

/**
 * pageParms Object
 * @typedef {object} pageParms
 * @property {integer} [1, -1]  direction     - 1 = Beginning to End, -1 = End to Beginning
 * @property {integer} [n] limit              - max allowed elements in results defaults to class property limitDefault
 * @property {*=} first                       - overrides first element in results array (only used as an optimization)
 * @property {*=} last                        - overrides last element in results array (only used as an optimization) 
 */

/**
 * gets first and last element of an array
 * @param {Array} arr an array
 * @returns {Array} => [first_element, last_element] if array is Empty => [ undefined, undefined ] if single element => [first_element, first_element]
 */
const arrFirstLast = (arr) => {
  const { 0: first, length: l, [l - 1]: last } = arr;
  return [first, last];
};

/** Pagination a universal class for db pagination
 * Reasoning:
 *    It is well known that the usual pagination mechanism based on skip/limit is inefficient/slow especially when dealing with large data sets
 *    Therefore the need for a more efficient/faster arises when dealing with a large dataset.
 *    Following class implements and encapsulates such a mechanism, which is quite flexible and can possibly accommodate many use cases,
 *    some of which are quite simple (like the scrollDown scrollUp methods) some others can be quite complicated but still useful
 * Terminology:
 *    "doc" When we refer to documents and related variables here we mean a complete document as returned by a mongo query/aggregation
 *    or for efficiency it can be a partial document that only contain the necessary fields used in funNext and funPrevious (^ see below)
 *
 *    last and first generally refer to first and last document/partial document returned by a previously run find/aggregation operation.
 *    There can exist sophisticated use cases where we could possibly want to substitute those with an arbitrary document for efficiency
 *    for example imagine we do an aggregation with a lookup stage it can scan say 1000 parent documents while last one produced a lookup result is
 *    is the 500th document, it will be a waste of resources to start next scan from position 500 of parent document which gave us last lookup match
 *    while we know there are no lookup matches for next 500 documents so we use the 1000th document as socLast in the follow up aggregation for
 *    next page.
 *
 */
class Pagination {
  constructor(
    {
      fnNext = (doc) => ({ _id: { $gt: doc._id } }),
      fnPrev = (doc) => ({ _id: { $lt: doc._id } }),
      limitDefault = 10,
    } = {},
  ) {
    this._props = { fnNext, fnPrev, limitDefault };
  }

  /**
   *
   * @param {array} resultsArr array with data (can be empty [])
   * @param {pageObj} pageObjLast pageObj from last call (can be empty {} on first call)
   * @param {pageParms} pageParms {pageObjLast, limit, first, last}
   * @returns {pageObj} a pageObj to be used and returned on next call
   */
  async getPageObj(resultsArr, pageObjLast = {}, { direction, limit = this._props.limitDefault, first, last } = {}) {
    direction = direction || pageObjLast.direction || 1;
    if (![1, -1].includes(direction)) { throw new ErrAcropolisMG(5001, `but is:${direction}`); }
    const pageSize = resultsArr.length;
    const callCount = pageObjLast.callCount + 1 || 1;
    const pageObj = { next: undefined, prev: undefined, onEnd: false, onBegin: false, direction, pageSize, ts: Date.now(), callCount };
    let [dataFirst, dataLast] = arrFirstLast(resultsArr);
    if (direction === -1) { [dataFirst, dataLast] = [dataLast, dataFirst]; }
    dataFirst = first || dataFirst;                          // override if provided (special case see documentation)
    dataLast = last || dataLast;                             // override if provided
    if (pageSize >= limit) {
      return { ...pageObj, ...{ next: this._props.fnNext(dataLast), prev: this._props.fnPrev(dataFirst) } };
    }
    if (pageSize === 0) {
      if (direction === 1) {
        return { ...pageObj, ...{ onEnd: true, onBegin: false, next: pageObjLast.next, prev: pageObjLast.prev } };
      }
      return { ...pageObj, ...{ onEnd: false, onBegin: true, next: pageObjLast.next, prev: pageObjLast.prev } };
    }
    if (pageSize < limit) {                     // this should be the LAST in if chain
      if (direction === 1) {
        return { ...pageObj, ...{ onEnd: true, onBegin: false, next: pageObjLast.next, prev: this._props.fnPrev(dataFirst) } };
      }
      return { ...pageObj, ...{ onEnd: false, onBegin: true, next: this._props.fnNext(dataLast), prev: pageObjLast.prev } };
    }
    return false;                   // should never come here
  }
}

/** pagination a universal class for db pagination
 * Reasoning:
 *    It is well known that the usual pagination mechanism based on skip/limit is inefficient/slow especially when dealing with large data sets
 *    Therefore the need for a more efficient/faster based on indexes arises when dealing with a large dataset.
 *    Following class implements and encapsulates such a mechanism, which is quite flexible and can possibly accommodate many use cases,
 *    some of which are quite simple (like the scrollDown scrollUp methods) some others can be quite complicated but still useful
 * Terminology:
 *    "doc" When we refer to documents and related variables here we mean a complete document as returned by a mongo query/aggregation
 *    or for efficiency it can be a partial document that only contain the necessary fields used in funNext and funPrevious (^ see below)
 *
 *    docLast / docFirst generally refer to first and last document/partial document returned by a previously run find/aggregation operation.
 *    There can exist sophisticated use cases where we could possibly want to substitute those with an arbitrary document for efficiency
 *    for example imagine we do an aggregation with a lookup stage it can scan say 1000 parent documents while last one produced a lookup result is
 *    is the 500th document, it will be a waste of resources to start next scan from position 500 of parent document which gave us last lookup match
 *    while we know there are no lookup matches for next 500 documents so we use the 1000th document as socLast in the follow up aggregation for
 *    next page.
 * `` Same applies when we are streaming - we don't know those values but only at end of stream
 *
 * conditionally sets pagination headers to response object
 */

class PaginationHeracles {
  constructor(
    {
      encodeBM = doc => `${doc.__createdAt.toISOString()}|${doc._id}`,
      decodeBM = (BM) => { const BSplitted = BM.split('|'); return [new Date(BSplitted[0]), BSplitted[1]] },
      queryNext = decodedBM => ({ __createdAt: { $ge: decodedBM[0] }, _id: { $gt: decodedBM[1]} }),
      queryPrevious = decodedBM => ({ __createdAt: { $le: decodedBM[0] }, _id: { $lt: decodedBM[1] } }),
      limit,
      direction,
      docMin,
      docMax,
      res,                // optional express response object
      encodeURI = true,   // optional false only for debugging
    } = {},
  ) {
    this._props = { encodeBM, decodeBM, queryNext, queryPrevious, limit, docMin, docMax, direction, res, encodeURI };
    this._derivePropsFromReq();
  }

  /**
   * derives limit and direction from request's object query string if are not already set (will not override)
   */
  _derivePropsFromReq() {
    if (this._props.res !== undefined) {
      const rq = this._props.res.req.query
      if (rq.limit !== undefined && this._props.limit === undefined) { this._props.limit = Number.parseInt(rq.limit, 10) }
      if (this._props.direction === undefined) { this._props.direction = (rq.pagePrev === undefined) ? 1 : -1 }
    }
  }

  get docMax() { return this._props.docMax; }

  set docMax(val) { this._props.docMax = val; }

  set docMin(val) { this._props.docMin = val; }

  get docMin() { return this._props.docMin; }

  get limit() { return this._props.limit; }

  get direction() { return this._props.direction; }

  _link(doc, nextOrPrevious) {
    if (this._props.res) {
      const originalQuery = {...this._props.res.req.query}            // clone it so we don't mess with it
      originalQuery[`page${nextOrPrevious}`] = this._props.encodeBM(doc)
      let rt = Object.keys(originalQuery).map(key => `${key}=${originalQuery[key]}`).join('&');
      rt = `${this._props.res.req.originalUrl.split("?").shift()}?${rt}`
      if (this._props.encodeURI !== false) { rt = encodeURIComponent(rt)}
      return rt
    }
    return `?page${nextOrPrevious}=${this._props.encodeBM(doc)}`
  }

  linkNext(doc) { return this._link(doc, 'Next') }

  linkPrev(doc) { return this._link(doc, 'Prev') }

  /**
   * main algo
   *
   */
  _paging({ docFirst, docLast, pageSize, direction = this._pros.direction, limit = this._props.limit } = {}) {
    const pagingObj = { linkNext: null, linkPrev: null};
    if (pageSize >= limit) {
      pagingObj.linkNext = docLast;
      pagingObj.linkPrev = docFirst;
    } else if (pageSize === 0) {
      if (direction === 1 && this.docMax) { pagingObj.linkPrev = this.docMax; }             // at end set previous
      if (direction === -1 && this.docMin) { pagingObj.linkNext = this.docMin; }            // at beginning set next
    } else if (pageSize < limit) {                                                        // should be last in if chain
      if (direction === 1) { pagingObj.linkPrev = this.docFirst; }
      if (direction === -1) { pagingObj.linkNext = this.docLast; }
    }
    return pagingObj
  }

  _pagingEncode(pagingObj) {
    if (pagingObj.linkNext) { pagingObj.linkNext = this.linkNext(pagingObj.linkNext)}
    if (pagingObj.linkPrev) { pagingObj.linkPrev = this.linkPrev(pagingObj.linkPrev)}
    return pagingObj;
  }

  pagingHeaders({ docFirst, docLast, pageSize, direction = this._props.direction, limit = this._props.limit } = {}) {
    const pagingObj = this._paging({ docFirst, docLast, pageSize, direction, limit})
    pagingObj['X-Total-Count'] = pageSize;
    return this._pagingEncode(pagingObj)
  }

  _setHttpHeaders(paging) {
    const links = ['linkNext', 'linkPrev'];
    if (this._props.res !== undefined && this._props.res.headersSent === false) {
      this._props.res.setHeader('X-Total-Count', paging['X-Total-Count'])
      const linkArr = links.map(el => (paging[el] ? `<${paging[el]}>; rel="${el.substring(4).toLowerCase()}"` : null))
      this._props.res.header('Link', linkArr.filter(x => x !== null));
    }
  }

  /**
   *
   * @param {array} resultsArr results array from  find/aggregation .toArray()
   * @param {integer} direction (optional) 1 = scroll down || -1 = scroll up
   */
  pagingFromArray(resultsArr, direction = this._props.direction, setHttpHeaders = true) {
    let [docFirst] = resultsArr;
    let [docLast] = resultsArr.slice(-1);
    if (direction === -1) { [docFirst, docLast] = [docLast, docFirst]; }          // swa
    const paging = this.pagingHeaders({ docFirst, docLast, pageSize: resultsArr.length})
    if (setHttpHeaders === true) { this._setHttpHeaders(paging)}
    return paging;
  }

  static queryFromHeaders(qsFragment, encoded = true) {
    const opts = (encoded === true) ? decodeURIComponent(qsFragment) : qsFragment;
    return JSON.parse(opts);
  }
}



export { Pagination };
