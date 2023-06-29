/**
 * @fileOverview some useful constants
 * @exportsFix mgEvents
 *
*/

/**
 * mongo events with severity arbitrarily assigned by ne
 * useful in logging
 * @type {object}
*/
const mgEvents = {
  all: 'deprecated',
  authenticated: 'info',
  close: 'warn',
  commandFailed: 'warn',
  commandStarted: 'verbose',
  commandSucceeded: 'verbose',
  connectionCheckOutFailed: 'warn',
  connectionCheckOutStarted: 'silly',
  connectionCheckedIn: 'silly',
  connectionCheckedOut: 'silly',
  connectionClosed: 'verbose',
  connectionCreated: 'silly',
  connectionPoolCleared: 'verbose',
  connectionPoolClosed: 'verbose',
  connectionPoolCreated: 'info',
  connectionReady: 'silly',
  error: 'error',
  fullsetup: 'deprecated',
  ha: 'deprecated',
  joined: 'deprecated',
  left: 'deprecated',
  parseError: 'warn',
  ping: 'deprecated',
  reconnect: 'deprecated',
  serverClosed: 'warn',
  serverDescriptionChanged: 'info',
  serverHeartbeatFailed: 'warn',
  serverHeartbeatStarted: 'silly',
  serverHeartbeatSucceeded: 'silly',
  serverOpening: 'info',
  timeout: 'warn',
  topologyClosed: 'warn',
  topologyDescriptionChanged: 'warn',
  topologyOpening: 'info',
};

export { mgEvents };
