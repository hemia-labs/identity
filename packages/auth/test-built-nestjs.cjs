const assert = require("node:assert/strict");
const core = require("./dist/core");
const nest = require("./dist/nestjs");
const moduleDefinition = nest.SsoModule.forRootAsync({
  useFactoryConfig: () => ({}),
  store: { provide: nest.SESSION_STORE, useValue: {} },
});
assert.equal(nest.AccessClient, core.AccessClient);
assert.ok(
  moduleDefinition.providers.some(
    (provider) => provider.provide === core.SsoCore,
  ),
);
assert.ok(moduleDefinition.exports.includes(core.SsoCore));
console.log("Built NestJS/core DI class identity PASS");
(async () => {
  const Controller = moduleDefinition.controllers[0];
  for (const [error, expected] of [[new core.AccessContextError(503, 'private'), 'access_unavailable'], [new core.AccessContextError(403, 'private'), 'access_denied'], [new Error('private'), 'auth_failed']]) {
    const controller = new Controller({ completeCallback: async () => { throw error; }, buildErrorRedirect: reason => reason }, {});
    const result = await controller.callback('secret-code', 'secret-state', { cookie: () => assert.fail('No session on failure') });
    assert.equal(result.url, expected);
  }
  console.log('Callback closed error codes PASS');
  const esmCore = await import('./dist/core/index.mjs');
  const esmNest = await import('./dist/nestjs/index.mjs');
  const esmModule = esmNest.SsoModule.forRootAsync({
    useFactoryConfig: () => ({}),
    store: { provide: esmNest.SESSION_STORE, useValue: {} },
  });
  assert.equal(esmNest.AccessClient, esmCore.AccessClient);
  assert.ok(esmModule.providers.some(provider => provider.provide === esmCore.SsoCore));
  console.log('ESM NestJS/core DI class identity PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
