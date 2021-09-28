/**
 * relations_pc: (mongodb parent child relations representation)
 * followers of X=find({'_id.p': X }), following X=find({'_id.c': X })
 */

const { facet } = require('./common');
// aggregation pipelines ==========================================================================

const plMutual = (parentId, collName, includeOnly = [], outArrName = 'mutual') => {
  const match = () => {
    if (includeOnly instanceof Array && includeOnly.length === 0) { return { '_id.p': parentId }; }
    return { '_id.p': parentId, '_id.c': { $in: includeOnly } };
  };
  return [
    { $match: match() },
    {
      $lookup:
        {
          from: collName,
          let: { p: '$_id.p', c: '$_id.c' },
          pipeline: [
            {
              $match:
                { $expr: { $and: [{ $eq: ['$_id.p', '$$c'] }, { $eq: ['$_id.c', '$$p'] }] } },
            }],
          as: 'temp',
        }
    },
    { $match: { temp: { $ne: [] } } },
    { $group: { _id: null, [outArrName]: { $push: '$_id.c' } } },
    { $project: { [outArrName]: 1, count: 1, _id: 0 } },
  ];
};

const plRelatives = (id, pORc = 'p', pagenext = null, pageprev = null, pagesize = null) => {
  const [idP, idC] = (pORc === 'p') ? ['_id.p', '_id.c'] : ['_id.c', '_id.p'];
  const match = () => {
    if (pagenext !== null) { return { $match: { [idP]: id, [idC]: { $gt: pagenext } } }; }
    if (pageprev !== null) { return { $match: { [idP]: id, [idC]: { $lt: pageprev } } }; }
    return { $match: { [idP]: id } };
  };
  const addSortIfPaging = () => {
    if (pagenext === null && pageprev === null) { return []; }
    return [{ $sort: { [idC]: 1 } }];
  };
  const addLimitIfPagesize = () => ((pagesize === null) ? [] : { $limit: pagesize });
  return [
    match(),
    ...addSortIfPaging(),
    { $project: { c: `$${idC}`, _id: 0 } },
    { $group: { _id: null, children: { $push: '$c' } } },
    { $project: { children: true, _id: false } },
    ...addLimitIfPagesize(),
  ];
};

/**
 * @danger it will OVERWRITE output collection (toCollName)
 * @param {*} toCollName
 * @param {*} fieldName
 * @param {array} match optional extra match operator
 */
const plArrayToRelation = (toCollName, fieldName, match = []) => {
  const dollarFieldName = `$${fieldName}`;
  return [
    ...match,
    { $project: { [fieldName]: 1 } },
    { $unwind: dollarFieldName },
    { $project: { _id: { p: '$_id', c: dollarFieldName } } },
    { $out: toCollName },
  ];
};

// classes =======================================================================================
class MgRel {
  constructor(db, collName = 'test') {
    this.db = db;
    this.collName = collName;
    this.collTest = db.collection(collName);
    this.coll = db.collection(collName);
  }

  // class internals don't touch don't call don't use ---------------------------------------------
  static getId(idParent, idChild) {
    return { _id: { p: idParent, c: idChild } };
  }

  static plChildren(id, pORc = 'p', { pagesize, pagenext, pageprev } = {}) {
    const [idP, idC] = (pORc === 'p') ? ['_id.p', '_id.c'] : ['_id.c', '_id.p'];
    const match = () => {
      if (pagenext !== undefined) { return { $match: { [idP]: id, [idC]: { $gt: pagenext } } }; }
      if (pageprev !== undefined) { return { $match: { [idP]: id, [idC]: { $lt: pageprev } } }; }
      return { $match: { [idP]: id } };
    };
    const addSortIfPaging = () => ((pagenext === undefined && pageprev === undefined) ? [] : [{ $sort: { [idC]: 1 } }]);
    const addLimitIfPageSize = () => ((pagesize === undefined) ? [] : [{ $limit: pagesize }]);
    return [
      ...[match()],
      ...addSortIfPaging(),
      { $project: { _id: `$${idC}` } },
      ...addLimitIfPageSize(),
    ];
  }

  static plChildrenArray(id, pORc = 'p', { pagesize, pagenext, pageprev } = {}) {
    const pl = this.plChildren(id, pORc, { pagesize, pagenext, pageprev });
    const plGrp = [{ $group: { _id: null, children: { $push: '$_id' } } }, { $project: { children: 1, _id: 0 } }];
    return [...pl, ...plGrp];
  }

  plChildrenFetch(id, pORc = 'p', { project, pagesize, pagenext, pageprev } = {}) {
    const addProject = () => ((project === undefined) ? [] : [{ $project: project }]);
    const pl = this.constructor.plChildren(id, pORc, { pagesize, pagenext, pageprev });
    const plLookup = [
      {
        $lookup:
          {
            from: this.collNameRef,
            let: { matchId: '$_id' },
            pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$matchId'] } } }, ...addProject()],
            as: 'temp',
          },
      },
      { $unwind: '$temp' },
      { $replaceRoot: { newRoot: '$temp' } },
    ];
    return [...pl, ...plLookup];
  }

  relativesArr(id, pORc = 'p', { pagesize, pagenext, pageprev, sort } = {}) {
    // very efficient keysExamined:5 docsExamined:0!!  0ms
    const [idP, idC, rt] = (pORc === 'p') ? ['_id.p', '_id.c', 'c'] : ['_id.c', '_id.p', 'p'];
    const query = () => {
      if (pagenext !== undefined) { return { [idP]: id, [idC]: { $gt: pagenext } }; }
      if (pageprev !== undefined) { return { [idP]: id, [idC]: { $lt: pageprev } }; }
      return { [idP]: id };
    };
    const options = () => {
      const opt = this.addCom('relativesArr', { projection: { [idC]: 1, _id: 0 }, batchSize: 50000 });
      if (sort !== undefined) {
        opt.sort = sort;
      } else if (pagenext !== undefined || pageprev !== undefined) {
        opt.sort = { [idC]: 1 }; // @note: sort can fuck up with projection
      }
      if (pagesize !== undefined) { opt.limit = pagesize; }
      return opt;
    };
    return this.coll.find(query(), options()).toArray()
      .then(results => results.map(el => el._id[rt]))
      .catch((err) => { throw err; });
  }

  /**
   *
   * @param {*} id
   * @param {*} $project { p: 1 = all c where p is id, c: 1 = all p where id is c, m: 1 all mutual}
   */
  static plRelationsAll(id, $project = { p: 1, c: 1, m: 1 }) {
    const fc = facet([['p', this.plChildrenArray(id, 'p')], ['c', this.plChildrenArray(id, 'c')]]);
    const pl = [
      { $match: { $or: [{ '_id.c': id }, { '_id.p': id }] } },
      { $project: { _id: 1 } },
      ...[fc],
      {
        $project: {
          p: { $cond: { if: { $eq: ['$p.children', []] }, then: [], else: { $arrayElemAt: ['$p.children', 0] } } },
          c: { $cond: { if: { $eq: ['$c.children', []] }, then: [], else: { $arrayElemAt: ['$c.children', 0] } } },
        }
      },
      ...($project.m === 1) ? [{ $addFields: { m: { $setIntersection: ['$p', '$c'] } } }] : [],
      ...[{ $project }],
    ];
    return pl;
  }

  async test() {
    // return this.collTest.insertOne({ foo: 11 });
    try {
      return this.collTest.findOne();
    } catch (err) { throw err; }
  }

  addCom(amendment = '', otherOptions = {}) {
    otherOptions.comment = `[nm|${this.constructor.name}|${amendment}]`;
    return otherOptions;
  }


  // operations -----------------------------------------------------------------------------------
  /**
   * returns: => { n: 1, ok: 1} if added or if duplicate => { n: 0, ok: 0, error: err.code }
   */
  childAdd(idParent, idChild, restOfDoc = {}, options = {}) {
    const _id = MgRel.getId(idParent, idChild);
    return this.coll.insertOne({ ..._id, ...restOfDoc }, options)
      .then((result) => {
        return { ...result.result, ..._id }; // result.result coz we have raw result object here
      })
      .catch((err) => {
        if (err.code === 11000) return { n: 0, ok: 0, _id, error: err.code }; // duplicate
        throw err;
      });
  }

  childDelete(idParent, idChild, options = {}) {
    const _id = MgRel.getId(idParent, idChild);
    return this.coll.deleteOne(_id, options)
      .then((result) => {
        return { ...result.result, ..._id }; // result.result coz we have raw result object here
      })
      .catch((err) => { throw err; });
  }

  // return this.coll.find(MgRel.getId(id, idToCheck), this.addCom('hasChild', { projection: { _id: 1 } }))
  isChild(id, idToCheck) {
    return this.coll.find(MgRel.getId(id, idToCheck), this.addCom('hasChild')).count()
      .then(result => result === 1)
      .catch((err) => { throw err; });
  }

  isParent(id, idToCheck) {
    return this.coll.find(MgRel.getId(idToCheck, id), this.addCom('hasChild')).count()
      .then(result => result === 1)
      .catch((err) => { throw err; });
  }

  isMutual(id1, id2) {
    // efficient: IXSCAN { _id: 1 } keysExamined:4 docsExamined:0 0ms
    const cond = { $or: [MgRel.getId(id1, id2), MgRel.getId(id2, id1)] };
    return this.coll.find(cond, this.addCom('isMutual')).count()
      .then(result => result === 2)
      .catch((err) => { throw err; });
  }

  mutualGet(idParent, includeOnly = []) {
    const pl = plMutual(idParent, this.collName, includeOnly);
    return this.coll.aggregate(pl, this.addCom('mutualGet')).toArray()
      .then(results => ((results.length === 0) ? results : results[0].mutual))
      .catch(err => err);
  }

  relativesGetQuery(id, pORc = 'p', pagenext = null, pageprev = null, pagesize = null) {
    // very efficient keysExamined:5 docsExamined:0!!  0ms
    // pORc='p', pagenext=null, pageprev=null, pagesize=null
    const [idP, idC, rt] = (pORc === 'p') ? ['_id.p', '_id.c', 'c'] : ['_id.c', '_id.p', 'p'];
    const query = () => {
      if (pagenext !== null) { return { [idP]: id, [idC]: { $gt: pagenext } }; }
      if (pageprev !== null) { return { [idP]: id, [idC]: { $lt: pageprev } }; }
      return { [idP]: id };
    };
    const options = () => {
      const opt = this.addCom('relativesGetQuery', { projection: { [idC]: 1 }, batchSize: 50000 });
      // @note: no need to sort it comes out sorted coz of index used
      if (pagesize !== null) { opt.limit = pagesize; }
      return opt;
    };
    return this.coll.find(query(), options()).toArray()
      .then(results => results.map(el => el._id[rt]))
      .catch((err) => { throw err; });
  }

  relativesGetAggr(id, pORc = 'p', pagenext = null, pageprev = null, pagesize = null) {
    // prefer relativesGetQuery as more efficient
    const pl = plRelatives(id, pORc, pagenext, pageprev, pagesize = null);
    return this.coll.aggregate(pl, this.addCom('relativesGetAggr')).toArray()
      .then(results => ((results.length === 0) ? [] : results[0].children))
      .catch((err) => { throw err; });
  }

  async relativesGetIn(id, pORc = 'p', pipeLine, { pagesize, pagenext, pageprev, sort } = {}) {
    try {
      const relativesArrIDs = await this.relativesArr(id, pORc, { pagesize, pagenext, pageprev, sort });
      pipeLine = [{ $match: { _id: { $in: relativesArrIDs } } }, ...pipeLine];
      return await this.collRef.aggregate(pipeLine, this.addCom('relativesGetIn')).toArray();
    } catch (err) {
      throw err;
    }
  }

  /**
   * getInCollRef
   * @param {array} IDsArr (array of IDs)
   * @param {int} pagesize
   * @param {*} pagenext (id)
   * @param {*} pageprev (id)
   * @param {object} projection
   * @returns {promise} with array of items from collRef included in IDsArr including fields in projection
   */
  async getInCollRef(IDsArr, { pagesize, pagenext, pageprev, projection = {} } = {}) {
    const opts = this.addCom('getInCollRef', { projection });
    if (pagenext !== undefined) {
      IDsArr = IDsArr.splice(IDsArr.findIndex(k => k === pagenext) + 1);
    } else if (pageprev !== undefined) {
      IDsArr = IDsArr.splice(0, IDsArr.findIndex(k => k === pageprev));
    }
    if (pagesize !== undefined) { IDsArr = IDsArr.splice(0, pagesize); }
    try {
      return await this.collRef.find({ _id: { $in: IDsArr } }, opts).toArray();
    } catch (err) {
      throw err;
    }
  }
}

// ================================================================================================
// followers of X=find({'_id.p': X }), following X=find({'_id.c': X })
class FollowRel extends MgRel {
  constructor(db, collName = 'test', collNameRef = 'accounts', cntFollowers = null, cntFollowing = null) {
    super(db, collName); // call the super class constructor and pass in parameters
    this.collNameRef = collNameRef;
    this.collRef = db.collection(collNameRef);
    this.cntFollowers = cntFollowers;
    this.cntFollowing = cntFollowing;
  }

  // class internals don't touch don't call don't use ---------------------------------------------
  countsIncDec(idUser, what = this.cntFollowers, val = 1) {
    return this.collRef.updateOne({ _id: idUser }, { $inc: { [what]: val } })
      .then(result => result)
      .catch((err) => { throw err; });
  }

  async followOrUnfollow(idUser, idUserToFollowOrUnFollow, op = 1) {
    // op 1 = follow -1 = un-follow
    // @returns {"op": {"n": 1, "ok": 1,"_id": {"p": "XX","c": "YY"}},"followers": 1,"following": 1}
    const opResult = {};
    try {
      if (op === 1) {
        opResult.op = await this.childAdd(idUserToFollowOrUnFollow, idUser, { dt: new Date() });
      } else { opResult.op = await this.childDelete(idUserToFollowOrUnFollow, idUser); }
      if (opResult.op.n === 1) {
        const [cntFollowers, cntFollowing] = await Promise.all([
          this.countsIncDec(idUserToFollowOrUnFollow, this.cntFollowers, op),
          this.countsIncDec(idUser, this.cntFollowing, op),
        ]);
        opResult.followers = cntFollowers.result.n;
        opResult.following = cntFollowing.result.n;
        // ^^ @TODO: should check if sum of n = 3 but lets wait for transactions in mongo v 3.8
      }
      return opResult;
    } catch (err) { throw err; }
  }

  followOrUnfollowOnlyId(idUser, idUserToFollowOrUnfollow, op = 1) {
    // op 1 = follow -1 = unfollow
    // @todo: make it a transaction when transactions will be available in mongodb v 3.8
    const operationFunction = () => {
      if (op === 1) {
        return this.childAdd(idUserToFollowOrUnfollow, idUser, { dt: new Date() });
      } else { return this.childDelete(idUserToFollowOrUnfollow, idUser); }
    };
    return operationFunction()
      .then((result) => {
        if (result.n === 1) {
          return Promise.all([
            this.countsIncDec(idUserToFollowOrUnfollow, this.cntFollowers, op),
            this.countsIncDec(idUser, this.cntFollowing, op),
          ])
            .then(resultsCounts => idUserToFollowOrUnfollow);
        } else { return null; }
      })
      .catch((err) => { throw err; });
  }

  relationCreateIndexes() {
    return Promise.all([
      this.coll.createIndex({ '_id.p': 1, '_id.c': 1 }, { background: true }),
      this.coll.createIndex({ '_id.c': 1, '_id.p': 1 }, { background: true }),
    ])
      .then(results => results)
      .catch(err => err);
  }

  async arrToRelation(fieldName = 'following', match = [], createIndexes = true) {
    // @danger: it will overwrite output collection
    const pl = plArrayToRelation(this.collName, fieldName, match);
    const results = {};
    const agrOpt = this.addCom('arrToRelation', { allowDiskUse: true });
    try {
      results.aggregate = await this.collRef.aggregate(pl, agrOpt).toArray();
      if (createIndexes === true) { results.indexes = await this.relationCreateIndexes(); }
      return results;
    } catch (err) { throw err; }
  }

  plFollow(userId, condition, fieldName = 'isFollowing') {
    return [
      {
        $lookup:
          {
            from: this.collName,
            let: { matchId: condition },
            pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$matchId'] } } }, { $project: { _id: 1 } }],
            as: fieldName,
          },
      },
      { $addFields: { [fieldName]: { $cond: { if: { $eq: [`$${fieldName}`, []] }, then: false, else: true } } } },
    ];
  }


  /** *********************************************************************************************
   *  exposed functions following functions is what a class user should be concerned with
   *  everything above is implementation abstraction layer and should not be called directly
   */

  /**
   * areFriends this should be called to check for friends
   * don't check if user is in friends array since it is expensive
   * @description checks for friendship between 2 users
   * @param {*} idUser1
   * @param {*} idUser2
   * @returns { Promise Boolean } true if those 2 users follow each other false otherwise
   */
  areFriends(idUser1, idUser2) { return this.isMutual(idUser1, idUser2); }

  /**
   * isFollowing, isFollower
   * @param {*} idUser
   * @param {*} idUserToCheck
   * @returns { Promise Boolean }
   */
  isFollowing(idUser, idUserToCheck) { return this.isParent(idUser, idUserToCheck); }

  isFollower(idUser, idUserToCheck) { return this.isChild(idUser, idUserToCheck); }

  /**
   * plFollowing plFollower
   * @param {_id} userId against which will check
   * @param {string} fieldName adds this field in aggregation output
   * @returns {array} a sub-pipeline to be added as last stage in any aggregation on this.collRef that includes _id
   */
  plFollowing(userId, fieldName = 'isFollowing') { return this.plFollow(userId, { p: '$_id', c: userId }, fieldName); }

  plFollower(userId, fieldName = 'isFollower') { return this.plFollow(userId, { p: userId, c: '$_id' }, fieldName); }

  /**
   * follow
   * @param {string} idUser mandatory
   * @param {string} idUserToFollow mandatory
   * @returns {promise-object} in the form:
   * {"op": {"n": 1, "ok": 1, "_id": { "p": "xxx","c": "yyy"} }, "followers": 1, "following": 1}
   * where op.n if 1 => success, _id of created relationship, followers/following increment
   */
  follow(idUser, idUserToFollow) { return this.followOrUnfollow(idUser, idUserToFollow, 1); }

  /**
   * unfollow
   * @param {string} idUser mandatory
   * @param {string} idUserToUnFollow mandatory
   * @returns {promise-object} in the form:
   * {"op": {"n": 1, "ok": 1, "_id": { "p": "xxx","c": "yyy"} }, "followers": 1, "following": 1
   * where op.n if 1 => success, _id of deleted relationship, followers/following increment
   * op.n can be 0 if unsuccessful as when relationship already exists
   */
  unfollow(idUser, idUserToUnFollow) { return this.followOrUnfollow(idUser, idUserToUnFollow, -1); }

  /**
   * followBatch
   * @param {string} idUser
   * @param {array} idArrUsersToFollow
   * @returns {promise-array} of follow operations as described above
   *  - check elements for op.n = 1 to know if successful
   */
  followBatch(idUser, idArrUsersToFollow) {
    // @todo can be made more efficient by batching counter inc
    return Promise.all(idArrUsersToFollow.map(id => this.follow(idUser, id)))
      .then(results => results)
      .catch((err) => { throw err; });
  }

  /**
   * unfollowBatch
   * @param {string} idUser mandatory
   * @param {array}  idArrUsersToUnFollow mandatory
   * @returns {promise-array} of unfollow operations as described above
   *  - check elements for op.n = 1 to know if successful
   */
  unfollowBatch(idUser, idArrUsersToUnFollow) {
    // @todo can be made more efficient by batching counter inc
    return Promise.all(idArrUsersToUnFollow.map(id => this.unfollow(idUser, id)))
      .then(results => results)
      .catch((err) => { throw err; });
  }

  /**
   * friendsGet
   * gets friends of a user
   * @param {*} idUser mandatory
   * @param {array} includeOnly optional Ids to check against
   * @returns { promise - array } array of friends [_id, _id, ....]
   */
  friendsGet(idUser, includeOnly = []) { return this.mutualGet(idUser, includeOnly); }

  async friendsGetPage(idUser, { pagesize, pagenext, pageprev, projection = {} } = {}) {
    const pl = this.constructor.plRelationsAll(idUser, { m: 1 });
    try {
      const results = await this.coll.aggregate(pl).toArray();
      return this.getInCollRef(results[0].m, { pagesize, pagenext, pageprev, projection });
    } catch (err) { throw err; }
  }

  /**
   * @param {*}  idUser.
   * @returns{0bj}  { followers: x, following: y, friends: z }
   */
  async countsFFF(idUser) {
    const pl = [
      ...this.constructor.plRelationsAll(idUser),
      ...[{ $project: { followers: { $size: '$p' }, following: { $size: '$c' }, friends: { $size: '$m' } } }],
    ];
    try {
      return await this.coll.aggregate(pl).toArray();
    } catch (err) { throw err; }
  }

  /**
   * followersGet
   * gets friends of a user
   * @param {string}  idUser mandatory
   * @param {string}  pagenext optional userId if non null returns followers after given userId
   * @param {string}  pageprev optional userId if not null present returns followers before given userId
   * @param {int}     pagesize optional if non null limits returned array size to this value
   * @returns { promise-Array } array of followers [_id, _id, ...] or [] if none found (sorted by _id)
   */
  followersGet(idUser, pagenext = null, pageprev = null, pagesize = null) {
    return this.relativesGetQuery(idUser, 'p', pagenext, pageprev, pagesize); // more efficient
  }

  /**
   * followingGet
   * gets friends of a user
   * @param {string}  idUser mandatory
   * @param {string}  pagenext optional userId if non null returns following after given userId
   * @param {string}  pageprev optional userId if not null present returns following before given userId
   * @param {int}     pagesize optional if non null limits returned array size to this value
   * @returns {promise-array} sorted by _id, array of following [_id, _id, ...] or [] if none found
   */
  followingGet(idUser, pagenext = null, pageprev = null, pagesize = null) {
    return this.relativesGetQuery(idUser, 'c', pagenext, pageprev, pagesize); // more efficient
  }

  /**
   * userGet provided for backward compatibility with pre-refactoring standards
   * @note  use it rarely during the transition period and only get the information you actually need from
   * by specifying the projectAux object, especially avoid { friends: 1} since getting friends for a user with
   * many friends is still an expensive operation
   * after transition period getting information from aux array should use specific functions provided hare
   * i.e: followersGet etc  and USE paging to avoid unnecessary costs of querying/transmitting large arrays
   * @param {string} idUser idUser mandatory
   * @param {object} projectAux a projection object for aux fields to include
   * @param {object} project projection of normal user fields to include ad in findOne parms
   * @returns {promise-(object || null)} reconstructs a user object compatible with pre-refactoring standards
   */
  async userGet(idUser, projectAux = { friends: 0, followers: 1, following: 1 }, project = {}) {
    try {
      const [user, friends, followers, following] = await Promise.all([
        this.collRef.findOne({ _id: idUser }, { projection: project }),
        (projectAux.friends === 1) ? this.friendsGet(idUser) : undefined,
        (projectAux.followers === 1) ? this.followersGet(idUser) : undefined,
        (projectAux.following === 1) ? this.followingGet(idUser) : undefined,
      ]);
      if (user) { [user.friends, user.followers, user.following] = [friends, followers, following]; }
      return user;
    } catch (err) { throw err; }
  }

  /**
   * afterDeleteUser must be called after deleting a user from main collection
   *
   * @param {string} idUser mandatory
   * @returns { Promise object } { ok: 1 }
   */
  async afterDeleteUser(idUser) {
    // @todo: currently inefficient should use $in with chunks in array to batch decrement followers count
    // and deleteMany( {'_id.p': idUser})) to delete relations
    try {
      const following = await this.followingGet(idUser);
      await this.unfollowBatch(idUser, following);
      return { ok: 1 };
    } catch (err) { throw err; }
  }
}

module.exports = {
  MgRel,
  FollowRel,
};
