# koa-session-redis

 Redis store-based session middleware for Koa.

 Based on [koa-session](https://github.com/koajs/session)

## Installation

```sh
$ npm install etstd/koa-session-redis#next
```

## Notice
Set your redis connection configuration in options.store

## Example
  example (using redis without specific configuration)

```js
const session = require('koa-session-redis');

const Koa = require('koa');
const app = new Koa();

app.keys = ['some secret hurr'];
app.use(session({
    store: {
      host: process.env.SESSION_PORT_6379_TCP_ADDR || '127.0.0.1',
      port: process.env.SESSION_PORT_6379_TCP_PORT || 6379,
      ttl: 3600,
    },
  },
));

app.use(async function( ctx ){
  let n = ctx.session.views || 0;
  ctx.session.views = ++n;
  ctx.body = n + ' views';
})

app.listen(3000);
console.log('listening on port 3000');
```

## Semantics

  This module provides "guest" sessions, meaning any visitor will have a session,
  authenticated or not. If a session is _new_ a Set-Cookie will be produced regardless
  of populating the session.

## API

## Cookies

  The cookies opts is set by `cookie` object, simply passed to
  [cookie](https://github.com/defunctzombie/node-cookie) module.
  And the rest is same with `koa-session`;

### Options


  The cookie name is controlled by the `key` option, which defaults
  to "koa:sess". All other options are passed to `ctx.cookies.get()` and
  `ctx.cookies.set()` allowing you to control security, domain, path,
  and signing among other settings.

### Session#isNew

  Returns __true__ if the session is new.

### Destroying a session

  To destroy a session simply set it to `null`:

```js
ctx.session = null;
```

## License

  MIT
