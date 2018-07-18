'use strict'
//
// ────────────────────────────────────────────────────────────────────────────
//   :::::: D E P E N D E N C I E S : :  :   :    :     :        :            :
// ────────────────────────────────────────────────────────────────────────────
//
  const Koa = require('koa'),

    request = require('supertest'),
    session = require('./');

//
// ────────────────────────────────────────────────────────────────────────────
//   :::::: H E L P E R S : :  :   :    :     :        :          :           :
// ────────────────────────────────────────────────────────────────────────────
//
  function App(options) {
    const app = new Koa();

    app.keys = ['a', 'b'];
    app.use(session(options));

    return app;
  }

//
// ────────────────────────────────────────────────────────────────────────────
//   :::::: T E S T S : :  :   :    :     :        :          :               :
// ────────────────────────────────────────────────────────────────────────────
//
  describe('Koa Session', function () {
    let cookie = null;

    describe('when options.cookie.signed = true', function () {

      describe('when app.keys are set', function () {
        it('should work', async function () {
          const app = new Koa();

          app.keys = ['a', 'b'];
          app.use(session());

          app.use(async function (ctx) {
            ctx.session.message = 'hi';
            ctx.body = ctx.session;
          });

          await request(app.listen())
                                    .get('/')
                                    .expect(200);
        });
      });

      describe('when app.keys are not set', function () {
        it('should throw', async function () {
          const app = new Koa();

          app.use(session());

          app.use(async function (ctx) {
            ctx.session.message = 'hi';
            ctx.body = ctx.session;
          });

          await request(app.listen())
                                    .get('/')
                                    .expect(500);
        })
      });

    });

    describe('when options.cookie.signed = false', function () {
      describe('when app.keys are not set', function () {
        it('should work', async function () {
          const app = new Koa();

          app.use(session({ cookie: { signed: false } }));

          app.use(async function (ctx) {
            ctx.session.message = 'hi';
            ctx.body = ctx.session;
          });

          await request(app.listen())
                                    .get('/')
                                    .expect(200);
        })
      })
    });

    describe('when the session contains a ;', function () {
      it('should still work', async function () {
        const app = App();

        app.use(async function (ctx) {
          if (ctx.method === 'POST') {
            ctx.session.string = ';';
            ctx.status = 204;
          }
          else {
            ctx.body = ctx.session.string;
          }
        });

        const server = app.listen(),
          res = await request(server).post('/').expect(204);
        cookie = res.headers['set-cookie'];

        await request(server)
                            .get('/')
                            .set('Cookie', cookie.join(';'))
                            .expect(';');

      });

    });

    describe('new session', function () {

      describe('when not accessed', function () {
        it('should not Set-Cookie', async function () {
          const app = App();

          app.use(async function (ctx) {
            ctx.body = 'greetings';
          })

          const res = await request(app.listen())
                                                .get('/')
                                                .expect(200);

          res.header.should.not.have.property('set-cookie');
        });
      });

      describe('when accessed and not populated', function () {
        it('should not Set-Cookie', async function () {
          const app = App();

          app.use(async function (ctx) {
            ctx.session;
            ctx.body = 'greetings';
          });

          const res = await request(app.listen())
                                                .get('/')
                                                .expect(200);

          res.header.should.not.have.property('set-cookie');
        });
      });

      describe('when populated', function () {
        it('should Set-Cookie', async function () {
          const app = App();
          app.use(async function (ctx) {
            ctx.session.message = 'hello';
            ctx.body = '';
          })

          const res = await request(app.listen())
                                                .get('/')
                                                .expect('Set-Cookie', /koa:sess/)
                                                .expect(200);

          cookie = res.header['set-cookie'].join(';');
        });

        it('should not Set-Cookie', async function () {
          const app = App();

          app.use(async function (ctx) {
            ctx.body = ctx.session;
          });

          const res = await request(app.listen())
                                                .get('/')
                                                .expect(200);

          res.header.should.not.have.property('set-cookie');
        });
      });

    });

    describe('saved session', function () {

      describe('when not accessed', function () {
        it('should not Set-Cookie', async function () {
          const app = App();

          app.use(async function (ctx) {
            ctx.body = 'aklsdjflasdjf';
          });

          const res = await request(app.listen())
                                                .get('/')
                                                .set('Cookie', cookie)
                                                .expect(200);

          res.header.should.not.have.property('set-cookie');
        })
      });

      describe('when accessed but not changed', function () {
        it('should be the same session', async function () {
          const app = App();

          app.use(async function (ctx) {
            ctx.session.message.should.equal('hello');
            ctx.body = 'aklsdjflasdjf';
          });

          await request(app.listen())
                                    .get('/')
                                    .set('Cookie', cookie)
                                    .expect(200);
        })

        it('should not Set-Cookie', async function () {
          const app = App();

          app.use(async function (ctx) {
            ctx.session.message.should.equal('hello');
            ctx.body = 'aklsdjflasdjf';
          });

          const res = await request(app.listen())
                                                .get('/')
                                                .set('Cookie', cookie)
                                                .expect(200);

          res.header.should.not.have.property('set-cookie');
        })
      });

      describe('when accessed and changed', function () {
        it('should Set-Cookie', async function () {
          const app = App();

          app.use(async function (ctx) {
            ctx.session.money = '$$$';
            ctx.body = 'aklsdjflasdjf';
          });

          await request(app.listen())
                                    .get('/')
                                    .set('Cookie', cookie)
                                    .expect('Set-Cookie', /koa:sess/)
                                    .expect(200);
        })
      });

    });

    describe('when session = ', function () {

      describe('null', function () {
        it('should expire the session', async function () {
          const app = App();

          app.use(async function (ctx) {
            ctx.session = null;
            ctx.body = 'asdf';
          });

          await request(app.listen())
                                    .get('/')
                                    .expect('Set-Cookie', /koa:sess/)
                                    .expect(200);

        })
      })

      describe('{}', function () {
        it('should not Set-Cookie', async function () {
          const app = App();

          app.use(async function (ctx) {
            ctx.session = {};
            ctx.body = 'asdf';
          });

          const res = await request(app.listen())
                                                .get('/')
                                                .expect(200);

          res.header.should.not.have.property('set-cookie');
        })
      })

      describe('{a: b}', function () {
        it('should create a session', async function () {
          const app = App();

          app.use(async function (ctx) {
            ctx.session = { message: 'hello' };
            ctx.body = 'asdf';
          });

          await request(app.listen())
                                    .get('/')
                                    .expect('Set-Cookie', /koa:sess/)
                                    .expect(200);

        })
      })

      describe('anything else', function () {
        it('should throw', async function () {
          const app = App();

          app.use(async function (ctx) {
            ctx.session = 'asdf';
          });

          await request(app.listen())
                                    .get('/')
                                    .expect(500);
        })
      })

    });

    describe('when an error is thrown downstream and caught upstream', function () {
      it('should still save the session', async function () {
        const app = new Koa();
        app.keys = ['a', 'b'];

        app.use(async function (ctx, next) {
          try {
            await next();
          }
          catch (err) {
            ctx.status = err.status;
            ctx.body = err.message;
          }
        });

        app.use(session());

        app.use(async function (ctx, next) {
          ctx.session.name = 'funny';

          await next();
        });

        app.use(async function (ctx, next) {
          ctx.throw(401);
        });

        await request(app.listen())
                                  .get('/')
                                  .expect('Set-Cookie', /koa:sess/)
                                  .expect(401);
      })
    });

  });