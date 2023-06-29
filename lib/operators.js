import { Chronos } from 'acropolis-nd';

const { dtOffsetDays, objFromKeyVal } = Chronos;

/**
 *
 * concatenates $ + field name
 * @param {string} fieldName  name of a field
 * @returns {String} $ + fieldName
 */
const dollarFld = (fieldName) => `$${fieldName}`;

/**
 * builds a range query
 * @param {string} fieldName name of field
 * @param {any | undefined } start of range (if undefined startOperator will be omitted)
 * @param {any} end of range if undefined start will be omitted)
 * @param {string} [startOperator='$gte'] endOperator to use for start
 * @param {string} [endOperator='$lt'] operator to use for end
 * @return {object}  a query object which can be used directly on mongo queries or in pipelines as value to $match
 * @example
 * queryRange('surname', 'A', 'D') >> { surname: { '$gte': 'A', '$lt': 'D' } }
 * queryRange('surname', undefined, 'D') >> { surname: { '$lt': 'D' } }
 */
const queryRange = (fieldName, start, end, startOperator = '$gte', endOperator = '$lt') => {
  const rt = { ...objFromKeyVal(startOperator, start), ...objFromKeyVal(endOperator, end) };
  return (Object.keys(rt).length) ? { [fieldName]: rt } : {};
};

/**
 * builds a date range query from a base date + | -  number of days offset
 * @param {string} fieldName name of field
 * @param {Date} [date=new Date()] starting day
 * @param {integer} [daysOffset=0] offset in days (can be negative)
 * @return {object}  a query object which can be used directly on mongo queries or in pipelines as value to $match
 * @example
 * queryDayRange('updatedAt', new Date('2021-01-01T00:00Z'), 0) >>  {updatedAt: { '$gte': 2021-01-01T00:00:00.000Z, '$lt': 2021-01-02T00:00:00.000Z }}
 * queryDayRange('updatedAt', new Date('2021-01-01T00:00Z'), 1) >>  {updatedAt: { '$gte': 2021-01-01T00:00:00.000Z, '$lt': 2021-01-03T00:00:00.000Z }}
 * queryDayRange('updatedAt', new Date('2021-01-01T00:00Z'), -1) >> {updatedAt: { '$gte': 2020-12-31T00:00:00.000Z, '$lt': 2021-01-02T00:00:00.000Z }}
 */
const queryDayRange = (fieldName, date = new Date(), daysOffset = 0) => {
  if (daysOffset >= 0) { return queryRange(fieldName, date, dtOffsetDays(date, daysOffset + 1), '$gte', '$lt'); }
  return queryRange(fieldName, dtOffsetDays(date, daysOffset), dtOffsetDays(date, 1), '$gte', '$lt');
};

export {
  dollarFld,
  queryRange,
  queryDayRange,
};
