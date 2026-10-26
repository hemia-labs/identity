const assert=require('node:assert/strict');
const path=require('node:path');
const {createRequire}=require('node:module');
const {randomUUID,generateKeyPairSync}=require('node:crypto');
const backend=path.resolve(__dirname,'../../../backend');
const requireBackend=createRequire(path.join(backend,'package.json'));
const {DataSource}=requireBackend('typeorm');
const {OAuthClientEntity}=require('../../../backend/dist/src/modules/oauth/entities/oauth-client.entity');
const {OAuthClientsService}=require('../../../backend/dist/src/modules/oauth-clients/oauth-clients.service');
const port=Number(process.env.OAUTH_DESTINATION_TEST_PORT);
assert(Number.isInteger(port)&&port>0,'Use an isolated disposable database');
const db=new DataSource({type:'postgres',host:'127.0.0.1',port,username:'postgres',password:'isolated-test-only',database:'identity_destinations_test',entities:[path.join(backend,'dist/src/**/*.entity.js')],migrations:[path.join(backend,'dist/src/database/migrations/*.js')],synchronize:false,migrationsRun:false});
assert.equal(process.env.IDENTITY_ISOLATED_DATABASE, '1', 'Use postgres.docker.sh with a fresh disposable database');
(async()=>{
 await db.initialize();
 try {
  assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'"))[0].n,0);
  await db.runMigrations();
  const repository=db.getRepository(OAuthClientEntity);
  const row=await repository.save({id:randomUUID(),clientId:'legal-test',audience:'identity-api',serviceDestinations:[{resource:'https://identity.example',audience:'identity-api',scopes:['identity.oauth_clients.read']}],clientSecretHash:await requireBackend('argon2').hash('isolated-test-secret'),type:'confidential',grantTypes:['client_credentials'],redirectUris:[],responseTypes:[],scopes:['untouched'],requiresConsent:false,status:'active'});
  const {OAuthScopesService}=require('../../../backend/dist/src/modules/oauth-scopes/oauth-scopes.service');
  const {OAuthApisService}=require('../../../backend/dist/src/modules/oauth-scopes/oauth-apis.service');
  const catalog=new OAuthScopesService(db),apis=new OAuthApisService(db);
  for(const code of ['legal.consumer_context.read','additional','retained-concurrent','restored']) {
    if(!(await catalog.list()).some(s=>s.code===code))await catalog.save({code,name:code,description:'Synthetic concurrency fixture',enabled:true});
  }
  for(let i=0;i<8;i++)await apis.save({name:'Test API '+i,audience:`service${i}-api`,resource:`https://service${i}.example`,enabled:true,scopes:['legal.consumer_context.read','additional','retained-concurrent','restored']});
  const service=new OAuthClientsService(repository);
  await Promise.all(Array.from({length:8},(_,i)=>service.ensureServiceDestination(row.id,{resource:`https://service${i}.example`,audience:`service${i}-api`,scopes:['legal.consumer_context.read']})));
  let saved=await repository.findOneByOrFail({id:row.id});
  assert.equal(saved.serviceDestinations.length,9);
  await Promise.all(Array.from({length:8},()=>service.ensureServiceDestination(row.id,{resource:'https://service0.example',audience:'service0-api',scopes:['additional']})));
  saved=await repository.findOneByOrFail({id:row.id});
  assert.equal(saved.serviceDestinations.length,9);
  assert.deepEqual(saved.serviceDestinations.find(d=>d.resource==='https://service0.example').scopes,['legal.consumer_context.read','additional']);
  for(const key of ['clientSecretHash','clientId','audience','scopes','grantTypes','redirectUris','responseTypes','requiresConsent','status'])assert.deepEqual(saved[key],row[key]);
  await assert.rejects(service.ensureServiceDestination(row.id,{resource:'https://different.example',audience:'service0-api',scopes:['legal.consumer_context.read']}),e=>e.status===400);
  assert.deepEqual((await repository.findOneByOrFail({id:row.id})).serviceDestinations,saved.serviceDestinations);
  await Promise.all([
    service.removeServiceDestinationScopes(row.id,{resource:'https://service0.example',audience:'service0-api',scopes:['additional']}),
    service.ensureServiceDestination(row.id,{resource:'https://service0.example',audience:'service0-api',scopes:['retained-concurrent']}),
  ]);
  saved=await repository.findOneByOrFail({id:row.id});
  assert.deepEqual(saved.serviceDestinations.find(d=>d.resource==='https://service0.example').scopes,['legal.consumer_context.read','retained-concurrent']);
  await Promise.all(saved.serviceDestinations.map(destination=>service.removeServiceDestinationScopes(row.id,destination)));
  saved=await repository.findOneByOrFail({id:row.id});
  assert.deepEqual(saved.serviceDestinations,[]);
  for(const key of ['clientSecretHash','clientId','audience','scopes','grantTypes','redirectUris','responseTypes','requiresConsent','status'])assert.deepEqual(saved[key],row[key]);
  const {OAuthService}=require('../../../backend/dist/src/modules/oauth/oauth.service');
  const {OAuthTokenEntity}=require('../../../backend/dist/src/modules/oauth/entities/oauth-token.entity');
  const {OAuthAuthorizationCodeEntity}=require('../../../backend/dist/src/modules/oauth/entities/oauth-authorization-code.entity');
  const {JwtService}=requireBackend('@nestjs/jwt');
  const {ConfigService}=requireBackend('@nestjs/config');
  const keys=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
  const jwt=new JwtService();
  const oauth=new OAuthService(repository,db.getRepository(OAuthAuthorizationCodeEntity),db.getRepository(OAuthTokenEntity),new ConfigService({app:{issuer:'https://identity.test'}}),{}, {getActiveKey:async()=>({kid:'fixture-key',privateKey:keys.privateKey})},jwt,{},{});
  const tokenRequest={grant_type:'client_credentials',client_id:row.clientId,client_secret:'isolated-test-secret'};
  await assert.rejects(oauth.token({...tokenRequest,scope:'untouched'}),e=>e.status===400);
  await assert.rejects(oauth.token({...tokenRequest,resource:'https://service0.example',scope:'untouched'}),e=>e.status===400);
  const {EmptyOAuthServiceDestinations1792800000001}=require('../../../backend/dist/src/database/migrations/1792800000001-EmptyOAuthServiceDestinations');
  await assert.rejects(new EmptyOAuthServiceDestinations1792800000001().down(db.createQueryRunner()),/deny-all policies/);
  await service.ensureServiceDestination(row.id,{resource:'https://service0.example',audience:'service0-api',scopes:['restored']});
  const issued=await oauth.token({...tokenRequest,resource:'https://service0.example',scope:'restored'});
  const claims=await jwt.verifyAsync(issued.access_token,{publicKey:keys.publicKey,algorithms:['RS256'],issuer:'https://identity.test',audience:'service0-api'});
  assert.equal(claims.scope,'restored');
  assert.equal(claims.client_id,row.clientId);
  assert.equal(await db.getRepository(OAuthTokenEntity).count(),1);
  await assert.rejects(oauth.token({...tokenRequest,resource:'https://service0.example',scope:'untouched'}),e=>e.status===400);
  console.log('PASS real migrations, deny-all after final revocation, guarded rollback, regrant and signed scoped OAuth token');

  assert.deepEqual((await repository.findOneByOrFail({id:row.id})).serviceDestinations,[{resource:'https://service0.example',audience:'service0-api',scopes:['restored']}]);
  console.log('PASS concurrent revoke/grant, empty destination policy, regrant and unchanged credentials');
  console.log('PASS concurrent destination additions, scope merges, idempotence, conflicts and unchanged credentials/other flows');
 }finally{await db.destroy();}
})().catch(error=>{console.error(error);process.exitCode=1;});
