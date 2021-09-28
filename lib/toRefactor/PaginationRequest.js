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
 * link refs, in production should always be tru, false is only provided for debugging as it makes link human readable
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
  get pagesize() { return (this.query.pagesize !== undefined) ? parseInt(this.query.pagesize) : undefined; }
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
      }
      else if (this.pageprev !== undefined) { // at beginning set next
        headersArr.push(this.header(this.pageprev, 'next', restQuery));
      } // else empty initial results, end of story
    }
    else {
      if (first === undefined) {
        [first] = dataArr;
      } // default to first result
      if (last === undefined) {
        [last] = dataArr.slice(-1);
      } // default to last result
      if (this.pagenext !== undefined) {
        headersArr.push(this.header(this.pageEncode(first), 'prev', restQuery));
      }
      // ^^  otherwise we are in first page there is no previous
      if (dataLength >= pagesize) {
        headersArr.push(this.header(this.pageEncode(last), 'next', restQuery));
      }
      // ^^ otherwise we are in last page there is no next
    }
    if (headersArr.length >= 0) {
      this.res.setHeader('Link', headersArr);
    }
    return true;
  }
}
