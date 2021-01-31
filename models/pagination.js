/* eslint-disable no-underscore-dangle */


/** Pagination a universal class for db pagination
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
 *
 * conditionally sets pagination headers to response object
 */
class Pagination {
  constructor(
    {
      funNext = (doc) => { return { _id: { $gt: doc._id } }; },
      funPrevious = (doc) => { return { _id: { $lt: doc._id } }; },
      pageSize = 10,
      docMin,
      docMax,
    } = {},
  ) {
    this._props = { funNext, funPrevious, pageSize, docMin, docMax };
  }

  /**
   * sometimes we get to know actual value of max val a document can take in a collection well after class creation
   * docMax & docMin setters provide for that
   */
  set docMax(val) { this._props.docMax = val; }

  set docMin(val) { this._props.docMin = val; }

  get docMin() { return this._props.docMin; }

  get docMax() { return this._props.docMax; }

  get pageSize() { return this._props.pageSize; }

  next(doc) { return this._props.funNext(doc); } // returns query/$match parameters for next page

  previous(doc) { return this._props.funPrevious(doc); } // returns query/$match parameters for previous page

  /** scrollDown - scrollUp
   * simple scrolling based on last document received;
   * it is efficient as no preprocessing is required
   * @param {object} docLast  a document or partial document
   * @param {object} docFirst  a document or partial document
   * #returns {object} query for next page
   */
  scrollDown(docLast = this.docMin) {
    return { pageNext: this.next(docLast) };
  }

  scrollUp(docFirst = this.docMax) {
    return { pagePrevious: this.previous(docFirst) };
  }

  _scroll({ docFirst, docLast, pageLength, direction = 0, pageLengthRequested = this.pageSize } = {}) {
    const rt = { pageLength, direction, pageNext: null, pagePrevious: null };
    if (pageLength >= pageLengthRequested) {
      rt.pageNext = this.next(docLast);
      rt.pagePrevious = this.previous(docFirst);
    } else if (pageLength === 0) {
      if (direction === 1 && this.docMax) { rt.pagePrevious = this.previous(this.docMax); } // at end set previous
      if (direction === -1 && this.docMin) { rt.pageNext = this.next(this.docMin); } // at beginning set next
    } else if (pageLength < pageLengthRequested) { // should be last in if chain
      if (direction === 1) { rt.pagePrevious = this.previous(docFirst); }
      if (direction === -1) { rt.pageNext = this.next(docLast); }
    }
    return rt;
  }

  /**
   *
   * @param {array} dataArr results array from last find/aggregation
   * @param {integer} direction (optional) 1 = scroll down || -1 = scroll up
   */
  scroll(dataArr, direction) {
    let [docFirst] = dataArr;
    let [docLast] = dataArr.slice(-1);
    if (direction === -1) { [docFirst, docLast] = [docLast, docFirst]; } // swap
    const args = { docFirst, docLast, pageLength: dataArr.length, direction };
    return this._scroll(args);
  }

  /**
   *
   * @param {array} dataArr
   * @param {integer} direction
   * @param {string} otherQs (optional) any other query string fragment we want to add
  */
  headersArr(dataArr, direction = 0, { pathURL = '', expressResponse, otherQs, encode = true } = {}) {
    const scrollRes = this.scroll(dataArr, direction);
    const getHeader = (key) => {
      const query = scrollRes[key];
      if (query) {
        let rt = JSON.stringify({ key, query, direction });
        if (otherQs) { rt = `${rt}&${otherQs}`; }
        if (encode === true) { rt = encodeURIComponent(rt); }
        return `<link rel="${key}" href="${pathURL}${rt}">`;
      }
      return null;
    };
    const linksArr = ['pageNext', 'pagePrevious'].map(k => getHeader(k)).filter(x => (x !== null));
    if (expressResponse !== undefined) {
      expressResponse.setHeader('X-Total-Count', scrollRes.pageLength); // let client know size of data returned
      if (linksArr.length >= 0) { expressResponse.setHeader('Link', linksArr); }
    }
    return linksArr;
  }


  static queryFromHeaders(qsFragment, encoded = true) {
    const opts = (encoded === true) ? decodeURIComponent(qsFragment) : qsFragment;
    return JSON.parse(opts);
  }
}

/**
 * Pagination
 * a universal class for db pagination
 * conditionally sets pagination headers to response object
 * for paging header standards see: https://webmasters.googleblog.com/2011/09/pagination-with-relnext-and-relprev.html
 *    - https://developer.github.com/v3/guides/traversing-with-pagination/#constructing-pagination-links
 * produces url encoded response headers in the form of <link rel ="next" href="/api/endpoint?pagenext=Bookmark">
 * if client will use it to request subsequent pages is responsible:
 *    reconstruct the complete url since href contains only the path fraction of the url
 *    this is so because we don't want to mesh up reconstructing full url that was modified by intermediate proxies
 *    so we leave to client who knows better how to reconstruct full url
 * client can expect 1 2 or 0 of those headers, it depends if prev and next pages really exist
 * if a next header exists this doesn't mean 100% next page will produce actual results but guaranties it will reserve
 * a data array although in rare end-cases can be possibly empty ([]),
 * so client must be prepared to handle empty result set, this behavior can be when
 *    a) changes to underlying data between now and next call (docs deleted etc )
 *    b) if we already delivered a full page we have no idea if there is one or more documents left
 * @param { object} req  request object
 * @param { object} response object
 * @param { function} decodeBM a function to decode a paging BookMark so it can be used in queries
 * @param { function} encodeBM a function to encode a paging BookMark so  it can extract a BM from an object or mongo doc
 * @param { boolean } encodeURI (optional) true or False defaults to true. If true url encodes pageprev and pragenext
 * link refs, in production should always be true, false is only provided for debugging as it makes link human readable
 */
class PaginationRequest {
  constructor(req, res, { decodeBM = (BM) => { return { _id: BM }; }, encodeBM = doc => doc._id, encodeURI = true } = {}) {
    this.req = req;
    this.query = req.query;
    this.res = res;
    this.decodeBM = decodeBM;
    this.encodeBM = encodeBM;
    this.encodeURI = encodeURI;
  }

  get pagenext() { return this.query.pagenext; }

  get pageprev() { return this.query.pageprev; }

  get userId() { return this.req.userId; }

  get pageprevDecoded() { return (this.pageprev !== undefined) ? this.decodeBM(this.pageprev) : undefined; }

  get pagenextDecoded() { return (this.pagenext !== undefined) ? this.decodeBM(this.pagenext) : undefined; }

  get pagesize() { return (this.query.pagesize !== undefined) ? parseInt(this.query.pagesize, 10) : undefined; }

  pageEncode(resultDoc) { return this.encodeBM(resultDoc); }

  // internal function not meant to be called by instances
  header(bookMarkValue, nextOrPrev = 'next', restQuery = {}) {
    let qs = Object.assign({ [`page${nextOrPrev}`]: bookMarkValue }, restQuery);
    qs = Object.keys(qs).map(key => `${key}=${qs[key]}`).join('&');
    const href = (this.encodeURI) ? encodeURIComponent(`${this.req.path}?${qs}`) : `${this.req.path}?${qs}`;
    return `<link rel="${nextOrPrev}" href="${href}">`;
  }

  /**
   * setHeaders - Sets response paging headers
   * @param { array } dataArr response data array
   * @param { int } pagesize (optional) requested page size if different than pagesize in constructor
   * @param { object } restQuery (optional) any additional parameters we want to put in Link\s query string
   * @param { object } first (optional) defaults to first element in dataArr
   * @param { object } last (optional) defaults to last element in dataArr
   */
  setHeaders(dataArr, { pagesize = this.pagesize, restQuery = {}, first, last } = {}) {
    const dataLength = dataArr.length;
    this.res.setHeader('X-Total-Count', dataLength); // let client know size of data returned
    const headersArr = [];
    if (dataLength === 0) { // empty results
      if (this.pagenext !== undefined) {
        headersArr.push(this.header(this.pagenext, 'prev', restQuery)); // at end set previous
      } else if (this.pageprev !== undefined) { // at beginning set next
        headersArr.push(this.header(this.pageprev, 'next', restQuery));
      } // else empty initial results, end of story
    } else {
      // eslint-disable-next-line no-param-reassign
      if (first === undefined) { [first] = dataArr; } // default to first result
      // eslint-disable-next-line no-param-reassign
      if (last === undefined) { [last] = dataArr.slice(-1); } // default to last result
      if (this.pagenext !== undefined) { headersArr.push(this.header(this.pageEncode(first), 'prev', restQuery)); }
      // ^^  otherwise we are in first page there is no previous
      if (dataLength >= pagesize) { headersArr.push(this.header(this.pageEncode(last), 'next', restQuery)); }
      // ^^ otherwise we are in last page there is no next
    }
    if (headersArr.length >= 0) { this.res.setHeader('Link', headersArr); }
    return true;
  }
}

export {
  Pagination,
  PaginationRequest,
};
