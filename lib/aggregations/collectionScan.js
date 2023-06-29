/* eslint-disable no-param-reassign */
import { bucketSample } from '../pipelines/stages.js';
// const bucketSample = (fldName = '_id', buckets = 10, sampleSize = 1000) => [

/**
 * some versions ago mongodb used to have a collection scan command which was deprecated
 * @see {@link https://jira.mongodb.org/browse/SERVER-24274}
 * this class attempts to emulate the functionality of that scan command i.e.: scan a collection in parallel
 * Unfortunately because Node is single threaded there are no guaranties that this solution will be
 * any faster/more efficient than serially scanning the collection,
 * it depends on the kind/load of processing to be done and other factors (cpu power of mongo server etc)
 * Alternatively you can possibly use the class methods provided to partition the data then
 * delegate the parts for parallel processing via some work que.
 * My benchmarks show that best efficiency comes from buckets = mongo server cpu cores X 2
 * @class CollectionScanner
 */
class CollectionScanner {
  /**
   * Creates an instance of CollectionScanner.
   * @param {Object} collection a collection
   * @param {Object} bucketSampleOpts {@see bucketSample} if size === 'auto' will be overridden by a proper size value
   */
  constructor(collection, bucketSampleOpts) {
    this.props = { collection, bucketSampleOpts };
  }

  /**
   *
   * provides query bounds for partitioning data in a collection
   * @param {*} [bucketSampleOpts=this.props.bucketSampleOpts] bucketSampleOpts
   * @return {array} of queries
   * @memberof CollectionScanner
   */
  async bucketQueries(bucketSampleOpts = this.props.bucketSampleOpts) {
    const { fldName, buckets } = bucketSampleOpts;
    if (buckets <= 1) { return {}; } // buckets <= 1 is meaningless
    const pipeline = bucketSample(bucketSampleOpts);
    const groups = await this.props.collection.aggregate(pipeline).toArray();
    let elCnt = 0;
    const queries = groups.map((el) => {
      elCnt += 1;
      if (elCnt === groups.length) { return { [fldName]: { $gte: el._id.min } }; } // first
      if (elCnt === 1) { return { [fldName]: { $lt: el._id.max } }; }
      return { [fldName]: { $gte: el._id.min, $lt: el._id.max } };
    });
    return queries;
  }

  async bucketPipeline(pipeline = [], bucketSampleOpts = this.props.bucketSampleOpts) {
    const bq = await this.bucketQueries(bucketSampleOpts);
    return bq.map((el) => ([{ $match: el }, ...pipeline]));
  }

  /**
   *
   * @param {array} pipeline a pipeline
   * @param {*} [bucketSampleOpts=this.props.bucketSampleOpts] bucketSampleOpts
   * @param {Object} [aggrOptions={}] any extra aggregation options i.e.: {comment: 'xxxx'}
   * @returns {Array}  [array of AggregationCursors]
   */
  async bucketScan(pipeline = [], bucketSampleOpts = this.props.bucketSampleOpts, aggrOptions = { comment: 'bucketScan' }) {
    const plArr = await this.bucketPipeline(pipeline, bucketSampleOpts);
    return plArr.map((el) => this.props.collection.aggregate(el, aggrOptions));
  }
}

export { CollectionScanner };
