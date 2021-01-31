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
 * @param {string} fx field name for x column
 * @param {string} fy field name for Y column
 * @return {Array} pipeline producing {'fx': "prc", "fy": "pa","R": 0.80183}
 */
const pearsonR = (fx, fy) => {
  const x = dollarFld(fx);
  const y = dollarFld(fy);
  const sumColumns = {
    $group: {
      _id: true,
      count: { $sum: 1 },
      sumx: { $sum: x },
      sumy: { $sum: y },
      sumxSquared: { $sum: { $multiply: [x, x] } },
      sumySquared: { $sum: { $multiply: [y, y] } },
      sumxy: { $sum: { $multiply: [x, y] } },
    },
  };
  const multiplySumxSumy = { $multiply: ['$sumx', '$sumy'] };
  const multiplySumxyCount = { $multiply: ['$sumxy', '$count'] };
  const partOne = { $subtract: [multiplySumxyCount, multiplySumxSumy] };
  const multiplysumxSquaredCount = { $multiply: ['$sumxSquared', '$count'] };
  const sumxSquared = { $multiply: ['$sumx', '$sumx'] };
  const subPartTwo = { $subtract: [multiplysumxSquaredCount, sumxSquared] };

  const multiplySumySquaredCount = { $multiply: ['$sumySquared', '$count'] };
  const sumySquared = { $multiply: ['$sumy', '$sumy'] };
  const subPartThree = { $subtract: [multiplySumySquaredCount, sumySquared] };

  const partTwo = { $sqrt: { $multiply: [subPartTwo, subPartThree] } };
  const pearson = { $project: { _id: 0, fx, fy, R: { $divide: [partOne, partTwo] } } };
  return [sumColumns, pearson];
};

export {
  pearsonR,
  distinct,
  distinctCount,
};
