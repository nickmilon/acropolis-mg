 
import { MgClientExt } from '../index.js';
import { mongoConnOptions } from '../config.js';

const connUri = mongoConnOptions.connUri || __mongoUrl__ || 'mongodb://localhost:27017/test';

let glClient

const mgClient = new MgClientExt(connUri, {});
mgClient.once('connectionReady', () => console.log(`connected to ${connUri}`));
mgClient.connect()
  .then((client) => {
    glClient = client;
  })
  .catch((error) => console.log(error));

export { glClient };
