import { dollarFld } from '../operators.js';

/**
 * @typedef {object} ParentChildFieldNames [{ parentFieldName = 'p', childFieldName = 'c'}={}]
 */

/**
 * constructs a pipeline to normalize a collection by extracting data contained as Array of _ids to a separate collection
 * with reference to parent collection document _id
 * @param {String} toCollName output collection name
 * @param {String} fieldName field containing relation objects
 * @param {Array} [match=[]] a $mach stage if any
 * @param {ParentChildFieldNames} options names
 * @return {Array} pipeline
 */
const arrayToRelation = (toCollName, fieldName, match = [], { parentFieldName = 'p', childFieldName = 'c' } = {}) => {
  const pl = [
    ...match,
    { $project: { [fieldName]: 1 } },
    { $unwind: dollarFld },
    { $project: { _id: { [parentFieldName]: '$_id', [childFieldName]: dollarFld } } },
    { $out: toCollName },
  ];
  return pl;
};

/**
 * pads contents of a field with padChr, output on same field if toField = null
 * for an alternative {@link  http://www.kamsky.org/stupid-tricks-with-mongodb/aggregation-helper-functions-lpad}
 * @param {string} fromField source field
 * @param {object} options [{ size = 10, toField = null, padChr = ' ', padRight = false }={}]
 * @return {Array} pipeline stage
 */
const fieldPad = (fromField, { size = 10, toField = null, padChr = ' ', padRight = false } = {}) => {
  // eslint-disable-next-line no-param-reassign
  if (toField === null) { toField = fromField; } // replace original field
  const padStr = padChr.repeat(size);
  const concatAr = [{ $substr: [padStr, 0, { $subtract: [size, { $strLenCP: dollarFld(fromField) }] }] }, dollarFld(fromField)];
  return [{ $addFields: { [toField]: { $concat: (padRight === true) ? concatAr.reverse() : concatAr } } }];
};

export {
  arrayToRelation,
  fieldPad,
};
