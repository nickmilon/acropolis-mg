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

/* tests 
  it('test', async () => {
    res = await mgMQ.mqColl.deleteMany({});

    strictEqual(res.acknowledged, true, 'delete any previous docs');
    strictEqual(await mgMQ.findFirstOne(), null, 'null if empty');
    strictEqual(await mgMQ.findLastOne(), null, 'null if empty');
    res = await mgMQ.findLast().then(rs => rs.toArray);
    strictEqual(res.length, 0, 'empty Array');
    res = await mgMQ.findFirst().then(rs => rs.toArray);
    strictEqual(res.length, 0, 'empty Array');
    for (let index = 1; index < 11; index += 1) {
      res = await mgMQ.mqColl.insertOne({ _id: index, row: index });
      strictEqual(res.insertedId, index);
    }
    ({ row: res } = await mgMQ.findFirstOne());
    strictEqual(res, 1, 'first row');
    ({ row: res } = await mgMQ.findLastOne());
    strictEqual(res, 10, 'last row');
    res = await mgMQ.findFirst({}, 10);
    res = await res.toArray();
    strictEqual(res[9].row, 10, 'last row');
    res = await mgMQ.findLast({}, 10);
    res = await res.toArray();
    strictEqual(res[9].row, 1, 'first row');
  });
*/