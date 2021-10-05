/* eslint-disable no-param-reassign */

import { Euclid } from 'acropolis-nd';

const { PageScroll } = Euclid;

class PageScrollMG extends PageScroll {
  constructor(
    {
      fnNext = (doc) => ({ _id: { $gt: doc._id } }),
      fnPrev = (doc) => ({ _id: { $lt: doc._id } }),
      vectorDefault = 50,
    } = {},
  ) {
    super({ fnNext, fnPrev, vectorDefault });
  }
}

export { PageScrollMG };
