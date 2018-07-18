test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--exit \
		--require should \
		--reporter spec

clean:
	@rm -rf node_modules

.PHONY: test clean