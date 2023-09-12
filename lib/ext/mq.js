export const createCollCapped = async ({ db, collName = 'mq', size = 100 * (1024 ** 2), max = 0 } = {}) => {
  return db.createCollection(collName, { capped: true, size, max });
};

export class MgMq extends Object {
  constructor(mgc, db, { collName = 'mq', size = 100 * (1024 ** 2), max = 100000 } = {}) {
    super();
    this.opts = { mgc, db, collName, size, max };
    // setImmediate(this.init);
  }

  async init() {
    // console.dir({ opts: this.opts })
    const res = await this.opts.mgc.extGetCollection(this.opts.db, this.opts.collName);
    if (res === undefined) {
      this.mqColl = await createCollCapped(this.opts);
    } else this.mqColl = res;
  }

  async findLast(query = {}, limit = 1) { return this.mqColl.find(query, { sort: { $natural: -1 }, limit }); } // stream

  async findFirst(query, limit = 1) { return this.mqColl.find(query, { limit }); } // stream

  async findFirstOne() { return this.mqColl.findOne(); } // object | null

  async findLastOne() { return this.mqColl.findOne({}, { sort: { $natural: -1 } }); } // object | null
}
