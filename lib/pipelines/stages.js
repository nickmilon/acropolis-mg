import { dollarFld } from '../operators.js';

/**
 * snippet constructs a pipeline if stage is not an empty object
 * @param {Object} [stage={}] stage parameters
 * @param {string} [operator='$match'] a pipeline stage operator
 * @return {Array} pipeline can be empty
 * @example
 * stageOrEmpty('$match', {foo: 'bar'}) >>  { '$match': { foo: 'bar' } } ]
 * stageOrEmpty('$match', {}) >> []
 */
const stageOrEmpty = (stage = {}, operator = '$match') => ((Object.keys(stage).length) ? [{ [operator]: stage }] : []);

/**
 * method to construct $group pipeline stage
 * @param {string|array|null} fieldNameOrArray a string or am array of strings corresponding to field name(s)
 * @param {Object} [rest={}] other $group operators if any
 * @return {array} [pipeline] stage
 * @example
 * group('address.country') >> [ { '$group': { _id: '$address.country' } } ]
 * group(['address.country', 'address.city']) >> [{"$group":{"_id":{"address_country":"$address.country","address_city":"$address.city"}}}]
 * group('country', {populationTotal: {$sum: '$population'}}) >> [{"$group":{"_id":"$country","populationTotal":{"$sum":"$population"}}}]
 */
const group = (fieldNameOrArray, rest = {}) => {
  const _id = () => {
    if (typeof fieldNameOrArray === 'string') { return dollarFld(fieldNameOrArray); }
    if (fieldNameOrArray === null) { return fieldNameOrArray; } // for simple counts
    return Object.fromEntries(fieldNameOrArray.map((x) => [x.replace('.', '_'), dollarFld(x)]));
  };
  return [{ $group: { _id: _id(), ...rest } }];
};

/**
 * creates a projection object to be used by $project
 * @param {string} fldStr space separated field names i.e: 'fieldName1 fieldName2'
 * @param {string} [prefix=''] any name space prefix to use before field names i.e. 'teams.scores.' (defaults to '')
 * @param {1 | 0} [include=1] 1 to include fields 0 to exclude fields (defaults to 1)
 * @return {array} [pipeline] stage
 * @example projectFromStr('name surname title','address.',  0) >> { 'address.name': 0, 'address.surname': 0, 'address.title': 0 }
 */
const projectFromStr = (fldStr, prefix = '', include = 1) => Object.fromEntries(fldStr.split(' ').map((x) => [`${prefix}${x}`, include]));

/**
 * options for bucketSample
 * @typedef {Object} bucketSampleOpts
 * @property {string} [fldName = '_id']  field name (data on the field must be unique)
 * @property {string} [buckets = 10] field name for DateTimeUpdated
 * @property {string} [size = 1000] Optional platform information
*/

/**
 * creates am auto bucket sample stage
 * @param {bucketSampleOpts} options bucketSample
 * @return {array} [pipeline] stage
 * @example bucketSample() >> [{ '$sample': { size: 1000 } }, { '$bucketAuto': { groupBy: '$_id', buckets: 10 } }]
 */
const bucketSample = ({ fldName = '_id', buckets = 10, size = 1000 } = {}) => [
  ...(size === 0) ? [] : [{ $sample: { size } }],
  { $bucketAuto: { groupBy: dollarFld(fldName), buckets } },
];

/**
 * @static
 * @param {Object} collection a collection
 * @param {*} buckets {@see bucketSample}
 * @return {integer}  suggested size
*/
const sampleAutoSize = async (collection) => {
  const docsPreCount = await collection.countDocuments();
  return Math.min(Math.floor(docsPreCount * 0.048), Math.min(2000, docsPreCount)); // < 5%
};

/**
 * method to construct $facet pipeline stage
 * @param {array} facetArr of the form [ [facetName, pipeline] [facetName, pipeline] ...etc ]
 * @returns {array} [pipeline] replacing any dots in field names with _ as . is note allowed in mongo field names
 * @example
 * facet([['distinct_countries', group('country')], ['distinct_cities', group('city')]]) >>
 * {"$facet":{"distinct_countries":[{"$group":{"_id":"$country"}}],"distinct_cities":[{"$group":{"_id":"$city"}}]}}
*/
const facet = (facetArr) => ({ $facet: Object.assign(...facetArr.map((d) => ({ [d[0]]: d[1] }))) });

/**
 *
 * @param {array} pl a valid pipeline will not catch any errors if not valid pipelineS
 * @returns {bool} true if last stage of pipeline is $out || $merge
 * @example
 * plHasOutputStage([{$match: {id:1}}, {$out:1}]) > true
 * plHasOutputStage([{$match: {id:1}}]) > false
 */
const hasOutputStage = (pl) => ['$out', '$merge'].includes(Object.keys(pl[pl.length - 1])[0]);

export {
  stageOrEmpty,
  facet,
  group,
  projectFromStr,
  bucketSample,
  sampleAutoSize,
  hasOutputStage,
};
