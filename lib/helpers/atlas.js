/**
 * snippet to get --host from mongodb atlas configuration for use in shell commands like mongorestore etc
 * @param {string} replicaSet i.e: 'xxxx-shard-yyyy'
 * @param {Array} nodesArr i.e:  ['west-2-primary-prod-shard-00-00-XXXX.mongodb.net:27017', 'west-2-primary-prod-shard-00-01-XXXX.mongodb.net:27017', etc]
 * @return {string} --host parameter
 */
const atlasHost = (replicaSet, nodesArr) => `${replicaSet}/${nodesArr.join(',')}`;

export { atlasHost };
