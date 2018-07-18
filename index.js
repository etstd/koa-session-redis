'use strict';
/**
 * Module dependencies.
 */
const promisify = require('util').promisify,

      debug     = require('debug')('koa-session-redis'),
      uid       = require('uid2'),
      redis     = require('redis');

/**
 * Initialize session middleware with `opts`:
 *
 * - `key` session cookie name ["koa:sess"]
 * - all other options are passed as cookie options
 *
 * @param {Object} [opts]
 * @api public
 */

module.exports = function ( opts = { } ) {
  let key, client, redisOption, cookieOption;

  // key
  key = opts.key || 'koa:sess';
  debug('key config is: %s', key);

  //redis opts
  redisOption = opts.store || {};
  debug('redis config all: %j', redisOption);
  debug('redis config port: %s', redisOption.port || (redisOption.port = 6379));
  debug('redis config host: %s', redisOption.host || (redisOption.host = '127.0.0.1'));
  debug('redis config options: %j', redisOption.options || (redisOption.options = {}));
  debug('redis config db: %s', redisOption.db || (redisOption.db = 0));
  debug('redis config ttl: %s', redisOption.ttl);

  //cookies opts
  cookieOption = opts.cookie || {};
  debug('cookie config all: %j', cookieOption);
  debug('cookie config overwrite: %s', (cookieOption.overwrite === false) ? false : (cookieOption.overwrite = true));
  debug('cookie config httpOnly: %s', (cookieOption.httpOnly === false) ? false : (cookieOption.httpOnly = true));
  debug('cookie config signed: %s', (cookieOption.signed === false) ? false : (cookieOption.signed = true));
  debug('cookie config maxAge: %s', (typeof cookieOption.maxAge !== 'undefined') ? cookieOption.maxAge : (cookieOption.maxAge = redisOption.ttl * 1000 || null));

  //redis client for session
  client = redis.createClient(
    redisOption.port,
    redisOption.host,
    redisOption.options
  );

  client.select(redisOption.db, function () {
    debug('redis changed to db %d', redisOption.db);
  });

  client.get = promisify(client.get);
  client.set = promisify(client.set);
  client.del = promisify(client.del);
  client.ttl = redisOption.ttl ? function expire(key) { client.expire(key, redisOption.ttl); }: function () {};

  client.on('connect', function () {
    debug('redis is connecting');
  });

  client.on('ready', function () {
    debug('redis ready');
    debug('redis host: %s', client.host);
    debug('redis port: %s', client.port);
    debug('redis parser: %s', client.reply_parser.name);
    debug('redis server info: %j', client.server_info);
  });

  client.on('reconnect', function () {
    debug('redis is reconnecting');
  });

  client.on('error', function (err) {
    debug('redis encouters error: %j', err.stack || err);
  });

  client.on('end', function () {
    debug('redis connection ended');
  });

  return async function ( ctx, next ) {
    try {
      let sess = null, sid  = null, json = null;

      // to pass to Session()
      ctx.cookieOption = cookieOption;
      ctx.sessionKey = key;
      ctx.sessionId = null;

      sid = ctx.cookies.get(key, cookieOption);

      if (sid) {
        debug('sid %s', sid);
        try {
          json = await client.get(sid);
        }
        catch (e) {
          debug('encounter error %s', e);
          json = null;
        }
      }

      if (json) {
        ctx.sessionId = sid;
        debug('parsing %s', json);
        try {
          sess = new Session(ctx, JSON.parse(json));
        } 
        catch (err) {
          // backwards compatibility:
          // create a new session if parsing fails.
          // `JSON.parse(string)` will crash.
          if (!(err instanceof SyntaxError)) throw err;
          sess = new Session(ctx);
        }
      } 
      else {
        sid = ctx.sessionId = uid(24);
        debug('new session');
        sess = new Session(ctx);
      }

      ctx.__defineGetter__('session', function () {
        // already retrieved
        if (sess) return sess;
        // unset
        if (false === sess) return null;
      });


      ctx.__defineSetter__('session', function (val) {
        if (null === val) return sess = false;
        if ('object' === typeof val) return sess = new Session(this, val);
        throw new Error('ctx.session can only be set as null or an object.');
      });

      try {
        await next();
      } 
      catch (err) {
        throw err;
      } 
      finally {
        if (undefined === sess) {
          // not accessed
        } 
        else if (false === sess) {
          // remove
          ctx.cookies.set(key, '', cookieOption);
          await client.del(sid);
        } 
        else if (!json && !sess.length) {
          // do nothing if new and not populated
        } 
        else if (sess.changed(json)) {
          // save
          json = sess.save();
          await client.set(sid, json);
          client.ttl(sid);
        }
      };
    }
    catch ( error ) {
      throw error;
    };
  };
};

/**
 * Session model.
 *
 * @param {Context} ctx
 * @param {Object} obj
 * @api private
 */

function Session(ctx, obj) {
  this._ctx = ctx;
  if (!obj) this.isNew = true;
  else for (var k in obj) this[k] = obj[k];
}

/**
 * JSON representation of the session.
 *
 * @return {Object}
 * @api public
 */

Session.prototype.inspect = Session.prototype.toJSON = function () {
  var self = this;
  var obj = {};

  Object.keys(this).forEach(function (key) {
    if ('isNew' === key) return;
    if ('_' === key[0]) return;
    obj[key] = self[key];
  });

  return obj;
};

/**
 * Check if the session has changed relative to the `prev`
 * JSON value from the request.
 *
 * @param {String} [prev]
 * @return {Boolean}
 * @api private
 */

Session.prototype.changed = function (prev) {
  if (!prev) return true;
  this._json = JSON.stringify(this);
  return this._json !== prev;
};

/**
 * Return how many values there are in the session object.
 * Used to see if it's "populated".
 *
 * @return {Number}
 * @api public
 */

Session.prototype.__defineGetter__('length', function () {
  return Object.keys(this.toJSON()).length;
});

/**
 * populated flag, which is just a boolean alias of .length.
 *
 * @return {Boolean}
 * @api public
 */

Session.prototype.__defineGetter__('populated', function () {
  return !!this.length;
});

/**
 * Save session changes by
 * performing a Set-Cookie.
 *
 * @api private
 */

Session.prototype.save = function () {
  var ctx = this._ctx,
      json = this._json || JSON.stringify(this),
      sid = ctx.sessionId,
      opts = ctx.cookieOption,
      key = ctx.sessionKey;

  debug('save %s', json);
  ctx.cookies.set(key, sid, opts);
  return json;
};
