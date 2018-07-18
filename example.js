'use strict'

const session = require('./'),
      Koa     = require('koa'),

      app     = new Koa();

app.keys = ['some secret hurr'];

app.use(session());

app.use(ctx => {

  if ('/favicon.ico' == ctx.path){
    return;
  }

  const n = ctx.session.views || 0;

  ctx.session.views += n;
  ctx.body = n + ' views';
});

app.listen(3000, () => console.log('listening on port 3000') );

