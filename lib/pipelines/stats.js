import { group } from './stages.js';
import { dollarFld } from '../operators.js';

/**
 * synonym to group
 *  @see group
 */
const distinct = group;

/**
 * group/distinct with counts
 * @see group
 * @param {string|array} fieldNameOrArray a string or am array of strings corresponding to field name(s)
 * @return {array} [pipeline] stage
 */
const distinctCount = (fieldNameOrArray) => group(fieldNameOrArray, { count: { $sum: 1 } });

/**
 * calculates pearson's R corelation coefficient between 2 columns
 * @param {string} fieldNameX field name for x column
 * @param {string} fieldNameY field name for Y column
 * @return {Array} pipeline producing {'fx': "prc", "fieldNameY": "pa","R": 0.80183}
 */
const pearsonR = (fieldNameX, fieldNameY) => {
  const x = dollarFld(fieldNameX);
  const y = dollarFld(fieldNameY);
  const sumColumns = {
    $group: {
      _id: true,
      count: { $sum: 1 },
      sumX: { $sum: x },
      sumY: { $sum: y },
      sumXSquared: { $sum: { $multiply: [x, x] } },
      sumYSquared: { $sum: { $multiply: [y, y] } },
      sumXy: { $sum: { $multiply: [x, y] } },
    },
  };
  const multiplySumXSumY = { $multiply: ['$sumX', '$sumY'] };
  const multiplySumXYCount = { $multiply: ['$sumXy', '$count'] };
  const partOne = { $subtract: [multiplySumXYCount, multiplySumXSumY] };
  const multiplySumXSquaredCount = { $multiply: ['$sumXSquared', '$count'] };
  const sumXSquared = { $multiply: ['$sumX', '$sumX'] };
  const subPartTwo = { $subtract: [multiplySumXSquaredCount, sumXSquared] };
  const multiplySumySquaredCount = { $multiply: ['$sumYSquared', '$count'] };
  const sumYSquared = { $multiply: ['$sumY', '$sumY'] };
  const subPartThree = { $subtract: [multiplySumySquaredCount, sumYSquared] };
  const partTwo = { $sqrt: { $multiply: [subPartTwo, subPartThree] } };
  const pearson = { $project: { _id: 0, fieldNameX, fieldNameY, R: { $divide: [partOne, partTwo] } } };
  return [sumColumns, pearson];
};

export {
  pearsonR,
  distinct,
  distinctCount,
};
