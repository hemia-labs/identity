const assert = require('node:assert/strict');
const { DataSource } = require('../../../backend/node_modules/typeorm');
const { UniqueOAuthScopeCatalog1793062800002 } = require('../../../backend/dist/src/database/migrations/1793062800002-UniqueOAuthScopeCatalog');
const db = new DataSource({type:'postgres',host:'127.0.0.1',port:Number(process.env.OAUTH_DESTINATION_TEST_PORT),username:'postgres',password:'isolated-test-only',database:'identity_destinations_test'});
assert.equal(process.env.IDENTITY_ISOLATED_DATABASE, '1', 'Use postgres.docker.sh with a fresh disposable database');
async function setup(q, conflict=false) {
 await q.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
 CREATE TABLE oauth_scopes(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,code varchar(160),audience varchar(160),name varchar(200),description varchar(2000) DEFAULT '',resource varchar(2048),enabled boolean DEFAULT true,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(audience,code));
 CREATE TABLE oauth_clients(id uuid DEFAULT gen_random_uuid(),audience varchar(160),scopes text[],service_destinations jsonb);
 CREATE TABLE oauth_authorization_codes(id uuid DEFAULT gen_random_uuid());
 INSERT INTO oauth_scopes(code,audience,name,resource,enabled) VALUES ('openid','one-api','Login',NULL,true),('openid','two-api','Login',NULL,true),('shared.read','one-api','Read','https://one',true),('shared.read','two-api','Read','https://two',false);
 INSERT INTO oauth_clients(audience,scopes,service_destinations) VALUES('one-api',ARRAY['openid','shared.read','missing.read'],'[{"audience":"two-api","resource":"https://two","scopes":["shared.read"]}]'),('empty-api','{}',NULL);`);
 if(conflict) await q.query("INSERT INTO oauth_scopes(code,audience,name,resource) VALUES('conflict','one-api','Conflict','https://conflict')");
}
(async()=>{
 assert(Number.isInteger(Number(process.env.OAUTH_DESTINATION_TEST_PORT)) && Number(process.env.OAUTH_DESTINATION_TEST_PORT)>0, 'Disposable port required');
 await db.initialize(); assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'"))[0].n,0); const q=db.createQueryRunner(); await q.connect();
 try {
  await setup(q); const before=await q.query('SELECT * FROM oauth_clients ORDER BY audience');
  await q.startTransaction(); await new UniqueOAuthScopeCatalog1793062800002().up(q); await q.commitTransaction();
  assert.equal((await q.query("SELECT count(*)::int n FROM oauth_scopes WHERE code='openid'"))[0].n,1);
  assert.equal((await q.query("SELECT count(*)::int n FROM oauth_scopes WHERE kind='protocol'"))[0].n,6);
  assert.equal((await q.query("SELECT enabled FROM oauth_scopes WHERE code='shared.read'"))[0].enabled,false);
  assert.equal((await q.query('SELECT count(*)::int n FROM oauth_scopes_before_unique_catalog'))[0].n,4);
  assert.equal((await q.query('SELECT count(*)::int n FROM oauth_api_scopes'))[0].n,3);
  assert.equal((await q.query("SELECT resource FROM oauth_apis WHERE audience='empty-api'"))[0].resource,null);
  assert.deepEqual(await q.query('SELECT * FROM oauth_clients ORDER BY audience'),before);
  await assert.rejects(q.query("INSERT INTO oauth_scopes(code,name,kind) VALUES('openid','Duplicate','protocol')"),e=>e.code==='23505');
  await setup(q,true); await q.startTransaction();
  await assert.rejects(new UniqueOAuthScopeCatalog1793062800002().up(q),/conflicting resource URLs/); await q.rollbackTransaction();
  assert.equal((await q.query('SELECT count(*)::int n FROM oauth_scopes'))[0].n,5);
  assert.equal((await q.query("SELECT to_regclass('oauth_scopes_before_unique_catalog') backup"))[0].backup,null);
  console.log('PASS: unique scopes, protocol definitions, API links, unchanged grants, backup, uniqueness and atomic conflict rollback');
 } finally {await q.release();await db.destroy();}
})().catch(e=>{console.error(e);process.exitCode=1});
