import { ErrAcropolis } from 'acropolis-nd/lib/Hamartia.js';

/**
 * this class is for use in this library only do not subclass it use @see ErrAcropolis instead
 * @private
 * @class ErrAcropolisMG
 * @extends {ErrAcropolis}
 */
class ErrAcropolisMG extends ErrAcropolis {
  constructor(code, extraMsg = '') {
    super(code, extraMsg);
  }

  static errorDict() {
    return {
      5001: 'Pagination: direction should be 1 or -1',
      1003: 'EnumBits: flags must be unique',
    };
  }
}

export { ErrAcropolisMG };
