// Cross-repository contract integration: real services, guards, OAuth and disposable PostgreSQL.
// HTTP adapters only supply Nest request/context plumbing; PayPal is an explicit deterministic fixture.
const assert = require('node:assert/strict');
const { randomUUID, generateKeyPairSync } = require('node:crypto');
const { createServer } = require('node:http');
const { createRequire } = require('node:module');
const path = require('node:path');
const roots = {
 identity: path.resolve(__dirname, '../../..'),
 legal: path.resolve(__dirname, '../../../../../legal'),
 billing: path.resolve(__dirname, '../../../../../billing'),
 balanz: path.resolve(__dirname, '../../../../../balanz'),
 console: path.resolve(__dirname, '../../../../../console'),
};
const pkg = Object.fromEntries(Object.entries(roots).map(([name, root]) => [name, createRequire(path.join(root, name === 'identity' ? 'backend/package.json' : 'apps/api/package.json'))]));
pkg.identity('reflect-metadata');
const { ConfigService } = pkg.identity('@nestjs/config');
const { Reflector } = pkg.identity('@nestjs/core');
const { JwtService } = pkg.identity('@nestjs/jwt');
const { DataSource } = pkg.identity('typeorm');
const port = Number(process.env.PAYMENTS_FLOW_TEST_PORT);
if (!Number.isInteger(port) || port < 15000 || port > 65535) throw new Error('PAYMENTS_FLOW_TEST_PORT must identify a disposable PostgreSQL instance on a dynamic port');
const compiled = name => path.join(roots[name], name === 'identity' ? 'backend/dist/src' : ['balanz','console'].includes(name) ? 'apps/api/dist' : 'apps/api/dist/src');
const load = (name, file, symbol) => require(path.join(compiled(name), file))[symbol];
const databases = [], servers = [], redisClients = [], nestApps = [];
async function database(name) {
 const db = new DataSource({type:'postgres',host:'127.0.0.1',port,username:'postgres',password:'isolated-test-only',database:name+'_flow',synchronize:false,entities:[compiled(name)+'/**/*.entity.js'],migrations:[compiled(name)+'/database/migrations/*.js']});
 await db.initialize(); databases.push(db); assert(db.migrations.length>0 && db.entityMetadatas.length>0,'Build required: '+name); await db.runMigrations(); return db;
}
async function server(corsOrigin) {
 let handle = async () => { throw Object.assign(new Error('Route not configured'), {status:404}); };
 const s = createServer(async (req,res) => {
  try {
   req.response=res;
   if(corsOrigin) {res.setHeader('access-control-allow-origin',corsOrigin);res.setHeader('access-control-allow-credentials','true');res.setHeader('access-control-allow-headers','content-type');res.setHeader('access-control-allow-methods','GET,POST,OPTIONS');if(req.method==='OPTIONS'){res.statusCode=204;res.end();return;}}
   const text = await Array.fromAsync(req).then(b=>Buffer.concat(b).toString());
   const url = new URL(req.url, 'http://127.0.0.1');
   req.path=url.pathname; req.query=Object.fromEntries(url.searchParams); req.params={};
   req.body=text ? req.headers['content-type']?.includes('application/x-www-form-urlencoded') ? Object.fromEntries(new URLSearchParams(text)) : JSON.parse(text) : {};
   req.header=req.get=name=>req.headers[name.toLowerCase()];
   const value=await handle(req); res.setHeader('content-type','application/json'); res.end(JSON.stringify(value ?? {}));
  } catch(e) { res.statusCode=e.status ?? e.getStatus?.() ?? 500; res.setHeader('content-type','application/json');res.end(JSON.stringify({message:e.message})); console.error('HTTP',req.method,req.url,res.statusCode,e.message); }
 });
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve)); servers.push(s);
 return {origin:'http://127.0.0.1:'+s.address().port,handle:fn=>{handle=fn;}};
}
function context(req, controller, method) {return {switchToHttp:()=>({getRequest:()=>req}),getClass:()=>controller.constructor,getHandler:()=>controller[method]};}
async function json(url, body, token) {const r=await fetch(url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const value=await r.json();if(!r.ok)throw Object.assign(new Error(value.message),{status:r.status});return value;}
async function main() {
 const [idHttp,legalHttp,billingHttp,balanzHttp]=await Promise.all([server(),server(),server(),server()]);
 const identity=await database('identity'), legal=await database('legal'), billing=await database('billing');
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const kid='payments-isolated-test'; const privatePem=privateKey.export({format:'pem',type:'pkcs8'}), publicPem=publicKey.export({format:'pem',type:'spki'});
 const repo=(name, db, entity)=>db.getRepository(entity);
 const OAuthClient=load('identity','modules/oauth/entities/oauth-client.entity','OAuthClientEntity');
 const clientManager=new (load('identity','modules/oauth-clients/oauth-clients.service','OAuthClientsService'))(identity.getRepository(OAuthClient));
 const oauth=new (load('identity','modules/oauth/oauth.service','OAuthService'))(
  identity.getRepository(OAuthClient),identity.getRepository(load('identity','modules/oauth/entities/oauth-authorization-code.entity','OAuthAuthorizationCodeEntity')),identity.getRepository(load('identity','modules/oauth/entities/oauth-token.entity','OAuthTokenEntity')),
  new ConfigService({app:{issuer:idHttp.origin}}),null,{getActiveKey:async()=>({kid,privateKey:privatePem})},new JwtService(),null,null,
 );
 const verify=async(req,audience,scope)=>{const claims=await new JwtService().verifyAsync((req.headers.authorization||'').replace(/^Bearer /,''),{publicKey:publicPem,issuer:idHttp.origin,audience,algorithms:['RS256']});assert.equal(claims.grant_type,'client_credentials');assert(claims.scope.split(' ').includes(scope));return claims;};
 idHttp.handle(async req=>{
  if(req.path==='/oauth/token')return oauth.token(req.body);
  if(req.path==='/oauth/introspect')return oauth.introspect(req.body);
  if(req.path==='/.well-known/jwks.json')return {keys:[{...publicKey.export({format:'jwk'}),kid,alg:'RS256',use:'sig'}]};
  await verify(req,'identity-api',req.method==='GET'?'identity.oauth_clients.read':'identity.oauth_clients.write');
  if(req.path.endsWith('/oauth-clients')&&req.method==='GET')return clientManager.findAll();
  if(req.path.endsWith('/oauth-scopes'))return identity.query('SELECT id,audience,code,name,resource,enabled FROM oauth_scopes ORDER BY audience,code');
  if(req.path.endsWith('/service-destinations'))return clientManager[req.method==='DELETE'?'removeServiceDestinationScopes':'ensureServiceDestination'](req.path.split('/').at(-2),req.body);
  throw Object.assign(new Error('Unknown Identity route'),{status:404});
 });
 const destination=(resource,audience,scopes)=>({resource,audience,scopes});
 const identityScopes=['identity.tokens.introspect','identity.oauth_clients.read','identity.oauth_clients.write'];
 const legalScopes=['legal.integration.acceptances.prepare','legal.integration.acceptances.create','legal.integration.acceptances.validate'];
 const paymentScopes=['billing.integration.catalog.read','billing.integration.checkout.create','billing.integration.checkout.read','billing.integration.licenses.read'];
 const seedClient=(clientId,destinations)=>clientManager.create({clientId,audience:destinations[0].audience,type:'confidential',grantTypes:['client_credentials'],scopes:[],requiresConsent:false,serviceDestinations:destinations});
 const consoleClient=await seedClient('console-identity-admin',[destination(idHttp.origin,'identity-api',identityScopes),destination(legalHttp.origin,'legal-api',['legal.systems.read','legal.systems.write']),destination(billingHttp.origin,'billing-api',['billing.integrations.read','billing.integrations.manage'])]);
 const legalClient=await seedClient('legal-service',[destination(idHttp.origin,'identity-api',identityScopes)]);
 const billingClient=await seedClient('billing-service',[destination(idHttp.origin,'identity-api',identityScopes)]);
 const consumerClient=await seedClient('balanz-service',[destination(billingHttp.origin,'billing-api',[paymentScopes[0]])]);
 for(const [audience,resource,scopes] of [['identity-api',idHttp.origin,identityScopes],['legal-api',legalHttp.origin,legalScopes],['billing-api',billingHttp.origin,paymentScopes],['balanz-api',balanzHttp.origin,['legal.consumer_context.read','billing.webhooks.deliver','billing.connections.check']]])
  for(const code of scopes) await identity.query('INSERT INTO oauth_scopes(audience,code,name,resource) VALUES($1,$2,$2,$3) ON CONFLICT(audience,code) DO UPDATE SET resource=excluded.resource',[audience,code,resource]);
 const issue=async(client,audience,scope)=> (await oauth.token({grant_type:'client_credentials',client_id:client.clientId,client_secret:client.clientSecret,audience,scope})).access_token;
 // The same credential will receive payments functions and Legal collector permissions.
 await assert.rejects(issue(consumerClient,'billing-api',paymentScopes[1]));
 const legalConfig=new ConfigService({sso:{issuer:idHttp.origin,tokenUrl:idHttp.origin+'/oauth/token'},legalService:{clientId:legalClient.clientId,clientSecret:legalClient.clientSecret,introspectionUrl:idHttp.origin+'/oauth/introspect',catalogClientId:consoleClient.clientId,production:false},legalIntegrations:{directoryUrl:idHttp.origin+'/api/v1/oauth-clients',production:false}});
 const tokens=new (load('legal','modules/auth/service-token.service','ServiceTokenService'))(legalConfig);
 const directory=new (load('legal','modules/legal/integrations/registry/integration-clients.service','IntegrationClientsService'))(legalConfig,tokens);
 const systems=new (load('legal','modules/legal/systems/systems.service','SystemsService'))(legal,legalConfig,directory);
 const registry=new (load('legal','modules/legal/integrations/registry/integration-registry.service','IntegrationRegistryService'))(legal,legalConfig,systems);
 const catalogController=new (load('legal','modules/legal/systems/systems.controller','SystemCatalogController'))(systems,registry);
 const catalogGuard=new (load('legal','modules/legal/systems/system-catalog.guard','SystemCatalogGuard'))(legalConfig,tokens);
 const legalEntity=(file,symbol)=>load('legal','modules/legal/entities/'+file+'.entity',symbol);
 const entityNames=[['legal-issuer','LegalIssuer'],['legal-application','LegalApplication'],['legal-document','LegalDocument'],['legal-document-version','LegalDocumentVersion'],['legal-acceptance-rule','LegalAcceptanceRule'],['legal-acceptance','LegalAcceptance'],['legal-notification','LegalNotification']];
 const publicationEntity=legalEntity('legal-publication','LegalPublication'),assetEntity=legalEntity('legal-publication-asset','LegalPublicationAsset');
 const storage=new (load('legal','modules/storage/s3-storage.service','S3StorageService'))({nodeEnv:'test',bucket:'isolated-documents',signedUrlTtlSeconds:300});
 const published=new (load('legal','modules/legal/services/legal.service','LegalService'))(...entityNames.map(([f,s])=>legal.getRepository(legalEntity(f,s))),null,null,legal.getRepository(publicationEntity),legal.getRepository(assetEntity),legal,null,storage,null);
 const acceptance=new (load('legal','modules/legal/integrations/acceptance/external-acceptance.service','ExternalAcceptanceService'))(legal,registry,new (load('legal','modules/legal/integrations/acceptance/external-context.service','ExternalContextService'))(registry,tokens),published,new (load('legal','modules/legal/authorization/legal-acceptance-validation.service','LegalAcceptanceValidationService'))(legalConfig,legal));
 const acceptanceController=new (load('legal','modules/legal/integrations/integration.controller','ExternalAcceptanceController'))(acceptance);
 const integrationGuard=new (load('legal','modules/legal/integrations/acceptance/integration-auth.guard','IntegrationAuthGuard'))(legalConfig,tokens,new Reflector());
 legalHttp.handle(async req=>{
  const root='/v1/legal/system-catalog/';
  if(req.path.startsWith(root)) {
   await catalogGuard.canActivate(context(req,catalogController,'list'));
   const route=req.path.slice(root.length);
   if(route==='systems'&&req.method==='GET')return catalogController.list();
   if(route==='capabilities')return req.method==='POST'?catalogController.saveCapability(req.body,req):catalogController.capabilities();
   if(route==='choices')return catalogController.choices();
   if(route==='integration-options')return catalogController.integrationOptions(req);
   if(route==='integrations')return catalogController.saveIntegration(req,req.body);
   if(route==='service-destinations/validate')return catalogController.validateServiceDestination(req.body);
   if(route==='systems/validate')return catalogController.validate(req.body,req,req.query.id);
   if(route==='systems')return catalogController.create(req.body,req);
   if(route.startsWith('systems/'))return catalogController.update(route.split('/')[1],req.body,req);
  }
  const method=req.path.endsWith('/acceptance-requests')?'prepare':req.path.endsWith('/acceptances/validate')?'validate':req.path.endsWith('/acceptances')?'accept':null;
  if(method){await integrationGuard.canActivate(context(req,acceptanceController,method));return acceptanceController[method](req,req.body);}
  throw Object.assign(new Error('Unknown Legal route'),{status:404});
 });
 const legalIssuer=randomUUID(),applicationId=randomUUID(),subjectId=randomUUID();
 await legal.query("INSERT INTO issuers(id,key,name,legal_name,type,country_code,default_locale) VALUES($1,'flow','Flow','Flow','company','MX','es-MX')",[legalIssuer]);
 await legal.query("INSERT INTO applications(id,issuer_id,key,name) VALUES($1,$2,'flow','Flow')",[applicationId,legalIssuer]);
 const documentIds=[];
 for(let n=0;n<2;n++) {
  const d=randomUUID(),v=randomUUID(),rule=randomUUID(),hash='a'.repeat(64); documentIds.push(d);
  await legal.query("INSERT INTO documents(id,issuer_id,application_id,key,locale,title,document_type) VALUES($1,$2,$3,$4,'es-MX','Flow terms','terms_and_conditions')",[d,legalIssuer,applicationId,'doc'+n]);
  await legal.query("INSERT INTO document_versions(id,document_id,version,status,content_hash) VALUES($1,$2,'1.0.0','published',$3)",[v,d,hash]);
  await legal.query("INSERT INTO acceptance_rules(id,document_id,version_id,issuer_id,application_id,acceptance_mode) VALUES($1,$2,$3,$4,$5,'individual')",[rule,d,v,legalIssuer,applicationId]);
  const pub=await legal.getRepository(publicationEntity).save({documentId:d,documentVersionId:v,issuerId:legalIssuer,applicationId,documentType:'terms_and_conditions',productId:'balanz_cfdi',documentKey:'doc'+n,version:'1.0.0',status:'published',effectiveFrom:new Date(),rulesSnapshot:[],contentHash:hash,requestedByIdentityIssuer:idHttp.origin,requestedBySubjectId:subjectId});
  const stored=await storage.putImmutable('flow/'+d+'.html',Buffer.from('<p>Isolated contractual fixture</p>'),'text/html');
  await legal.getRepository(assetEntity).save({publicationId:pub.id,kind:'html',s3Bucket:stored.bucket,s3ObjectKey:stored.key,s3VersionId:stored.versionId,contentType:stored.contentType,sizeBytes:stored.size,sha256:stored.sha256});
 }
 const actor={identityIssuer:idHttp.origin,subjectId,actorType:'user',traceId:randomUUID(),permissions:['legal.systems.read','legal.systems.write']};
 const system=await systems.save({code:'balanz',name:'Balanz isolated',enabled:true,configuration:{legalAcceptances:{identityIssuer:'urn:hemia:balanz',productCode:'balanz_cfdi',contextService:'context'}},services:[{code:'context',name:'Contract context',url:balanzHttp.origin+'/api/v1/payments/legal/context',audience:'balanz-api',resource:balanzHttp.origin,enabled:true},{code:'receiver',name:'License receiver',url:balanzHttp.origin+'/api/v1/billing/webhook',audience:'balanz-api',resource:balanzHttp.origin,enabled:true},{code:'check',name:'Backend check',url:balanzHttp.origin+'/api/v1/payments/integration-status',audience:'balanz-api',resource:balanzHttp.origin,enabled:true}],clients:[]},actor);
 // Further factories are kept below so fixture rows and real grants can be inspected in one run.
 await runPayments({idHttp,legalHttp,billingHttp,balanzHttp,identity,legal,billing,clientManager,oauth,issue,verify,consoleClient,legalClient,billingClient,consumerClient,system,applicationId,documentIds,subjectId,actor});
 console.log('PASS Identity → Console → Legal → Billing → @hemia/payments → Balanz contractual flow');
}
async function runPayments(f) {
 const {idHttp,legalHttp,billingHttp,balanzHttp,identity,legal,billing,consoleClient,legalClient,billingClient,consumerClient,system,applicationId,documentIds,subjectId,issue}=f;
 const connection={issuer:idHttp.origin,tokenUrl:idHttp.origin+'/oauth/token',clientId:consumerClient.clientId,baseUrl:billingHttp.origin+'/api/v1',audience:'billing-api',resource:billingHttp.origin,productCode:'balanz_cfdi',successUrl:balanzHttp.origin+'/paid',cancelUrl:balanzHttp.origin+'/cancel',allowHttpLoopback:true,receiver:{audience:'balanz-api',billingClientId:billingClient.clientId,consoleClientId:consoleClient.clientId},legal:{baseUrl:legalHttp.origin,audience:'legal-api',resource:legalHttp.origin,verificationClientId:legalClient.clientId}};
 const settings={legal:{issuer:idHttp.origin,jwksUrl:idHttp.origin+'/.well-known/jwks.json',baseUrl:legalHttp.origin,contextClientId:legalClient.clientId,production:false},payments:{connection,clientSecret:consumerClient.clientSecret},billingApi:{connectionsClientId:consoleClient.clientId},BILLING_WEBHOOK_CLIENT_ID:billingClient.clientId};
 const balanz=await require('./payments-balanz.fixture.cjs')({host:'127.0.0.1',port,username:'postgres',password:'isolated-test-only',database:'balanz_flow'},{userId:subjectId,config:settings});
 databases.push(balanz.db);
 nestApps.push(balanz.app);
 let rejectDelivery=false;
 balanzHttp.handle(async req=>{
  if(req.path==='/api/v1/payments/webhooks/license' && req.method==='POST' && rejectDelivery)
    throw Object.assign(new Error('Injected receiver outage'),{status:503});
  return balanz.proxy(req);
 });
 // Correct the selected fixture endpoint through the real system API model before activating.
 system.services.find(s=>s.code==='receiver').url=balanzHttp.origin+'/api/v1/payments/webhooks/license';
 await legal.query('UPDATE systems SET services=$1 WHERE id=$2',[JSON.stringify(system.services),system.id]);
 const billingConfig=new ConfigService({app:{nodeEnv:'test'},auth:{audience:'billing-api',requiredIssuer:idHttp.origin,jwksUri:idHttp.origin+'/.well-known/jwks.json'},sso:{issuer:idHttp.origin,tokenUrl:idHttp.origin+'/oauth/token',clientId:billingClient.clientId,clientSecret:billingClient.clientSecret},hemiaLegal:{baseUrl:legalHttp.origin,tokenUrl:idHttp.origin+'/oauth/token',clientId:billingClient.clientId,clientSecret:billingClient.clientSecret}});
 const billingFixture=await require('./payments-billing.fixture.cjs')({db:billing,config:billingConfig,organizationId:balanz.organizationId});
 let billingRequests=0;
 billingHttp.handle(req=>{billingRequests++;return billingFixture.handle(req);});
 const consoleConfig=new ConfigService({hemiaId:{baseUrl:idHttp.origin,adminPrefix:'/api/v1',service:{tokenUrl:'/oauth/token',clientId:consoleClient.clientId,clientSecret:consoleClient.clientSecret,scopes:'identity.oauth_clients.read identity.oauth_clients.write'}},legalAdmin:{baseUrl:legalHttp.origin,billingBaseUrl:billingHttp.origin}});
 const transport=new (load('console','modules/legal-system-catalog/console-service.client','ConsoleServiceClient'))(consoleConfig);
 const legalAdmin=new (load('console','modules/legal-system-catalog/legal-system-catalog.client','LegalSystemCatalogClient'))(consoleConfig,transport);
 const billingAdmin=new (load('console','modules/legal-system-catalog/billing-admin.client','BillingAdminClient'))(consoleConfig,transport);
 const identityAdmin=new (load('console','integrations/hemia-id/hemia-id-admin.client','HemiaIdAdminClient'))(consoleConfig);
 const redisPort=Number(process.env.PAYMENTS_FLOW_REDIS_PORT);
 if(!Number.isInteger(redisPort)||redisPort<15000||redisPort>65535)throw new Error('PAYMENTS_FLOW_REDIS_PORT must identify a disposable Redis instance');
 const redis=new (pkg.console('ioredis'))({host:'127.0.0.1',port:redisPort,maxRetriesPerRequest:1});redisClients.push(redis);await redis.ping();
 const catalogLock=new (load('console','modules/legal-system-catalog/system-catalog.lock','SystemCatalogLock'))(redis);
 const systemOAuth=new (load('console','modules/legal-system-catalog/system-oauth.service','SystemOAuthService'))(legalAdmin,identityAdmin,billingAdmin,consoleConfig,catalogLock);
 const connections=new (load('console','modules/legal-system-catalog/system-connections.service','SystemConnectionsService'))(legalAdmin,billingAdmin,systemOAuth,transport,consoleConfig,catalogLock);
 const operator={user:{sub:subjectId,iss:idHttp.origin}};
 const selection={systemId:system.id,clientId:consumerClient.clientId,capabilities:[{code:'payments',functions:['catalog','checkout','licenses','receiver']},{code:'legalAcceptances',functions:['collector']}],payments:{productCode:'balanz_cfdi',organizationScope:'organizations',organizationIds:[balanz.organizationId],receiverService:'receiver',checkService:'check',successUrl:connection.successUrl,cancelUrl:connection.cancelUrl},legal:{applicationId,documentIds}};
 const reportsHttp=await server();
 await identity.query("INSERT INTO oauth_scopes(audience,code,name,resource) VALUES('reports-api','reports.read','Leer reportes',$1)",[reportsHttp.origin]);
 await legalAdmin.request('POST','capabilities',operator,{code:'reports',name:'Reportes',functions:[{code:'reader',name:'Leer reportes',scopes:[{audience:'reports-api',code:'reports.read'}]}],schema:{fields:[{key:'reportCode',label:'Reporte',type:'string',format:'code',required:true,functions:['reader']}]}});
 const newClient=clientId=>f.clientManager.create({clientId,audience:'billing-api',type:'confidential',grantTypes:['client_credentials'],scopes:[],requiresConsent:false,serviceDestinations:[]});
 const reportsClient=await newClient('reports-reader');
 const preparedSystem=(code,configuration)=>legalAdmin.request('POST','systems',operator,{code,name:code,enabled:true,configuration,services:[],clients:[]});
 const reportsSystem=await preparedSystem('reports_consumer',{reports:{}});
 const catalogClient=await newClient('catalog-reader');
 const catalogSystem=await preparedSystem('catalog_consumer',{payments:{}});
 const licenseClient=await newClient('license-reader');
 const licenseSystem=await preparedSystem('license_consumer',{payments:{}});
 if(process.env.PAYMENTS_FLOW_KEEP_SERVERS==='1') {
  const uiOrigin=process.env.PAYMENTS_FLOW_UI_ORIGIN||'http://localhost:5176';
  const consoleHttp=await server(uiOrigin); const sessionCookie=randomUUID();
  consoleHttp.handle(async req=>{
   if(req.path==='/auth/login'){req.response.setHeader('set-cookie',`console_session=${sessionCookie}; HttpOnly; SameSite=Lax; Path=/`);req.response.statusCode=302;req.response.setHeader('location',uiOrigin+'/es/catalogs/systems/connections/new?preset=payments');return {};}
   const authenticated=req.headers.cookie?.split(';').some(c=>c.trim()==='console_session='+sessionCookie);
   if(req.path==='/auth/session')return authenticated?{authenticated:true,user:{...operator.user,email:'admin@example.test',name:'Operador de prueba'}}:{authenticated:false};
   if(!authenticated)throw Object.assign(new Error('Fixture session required'),{status:401});
   if(req.path==='/legal/system-catalog/connections/options')return connections.options(operator);
   if(req.path==='/legal/system-catalog/connections/options/payments')return connections.paymentOptions(operator);
   if(req.path==='/legal/system-catalog/connections/options/legal')return connections.legalOptions(operator);
   if(req.path==='/legal/system-catalog/connections/activate')return connections.activate(operator,req.body);
   throw Object.assign(new Error('Unknown Console fixture route'),{status:404});
  });
  console.log('UI_FIXTURE_READY '+JSON.stringify({apiBaseUrl:consoleHttp.origin.replace('127.0.0.1','localhost'),loginUrl:consoleHttp.origin.replace('127.0.0.1','localhost')+'/auth/login',uiOrigin,systemId:system.id,applicationId,documentIds,organizationId:balanz.organizationId,clientId:consumerClient.clientId,productCode:'balanz_cfdi',successUrl:connection.successUrl,cancelUrl:connection.cancelUrl,receiverService:'receiver',checkService:'check',genericSystems:{reports:reportsSystem.id,catalog:catalogSystem.id,licenses:licenseSystem.id},pid:process.pid}));
  await new Promise(()=>{});
 }
 const beforeGeneric=billingRequests;
 const baseOptions=await connections.options(operator);
 assert(baseOptions.capabilities.some(cap=>cap.code==='reports'));
 const reportSelection={systemId:reportsSystem.id,clientId:reportsClient.clientId,capabilities:[{code:'reports',functions:['reader'],configuration:{reportCode:'monthly'}}]};
 const configuredReports=await connections.activate(operator,reportSelection);
 assert.equal(configuredReports.status,'configured',JSON.stringify(configuredReports.steps));
 assert.equal(configuredReports.ready,false);
 assert.equal(billingRequests,beforeGeneric,'Arbitrary capability and base options must not query Billing');
 const reportsRepeat=await connections.activate(operator,{...reportSelection,clientId:undefined});
 assert.equal(reportsRepeat.status,'configured','Single existing backend identity must be reusable');
 assert.equal(billingRequests,beforeGeneric);
 await issue(reportsClient,'reports-api','reports.read');
 assert.equal((await legal.query('SELECT count(*)::int n FROM external_identity_sources WHERE system_id=$1',[reportsSystem.id]))[0].n,0);
 const configuredCatalog=await connections.activate(operator,{systemId:catalogSystem.id,clientId:catalogClient.clientId,capabilities:[{code:'payments',functions:['catalog']}],payments:{productCode:'balanz_cfdi'}});
 assert.equal(configuredCatalog.status,'configured',JSON.stringify(configuredCatalog.steps));assert.equal(configuredCatalog.ready,false);
 const catalogConnection=JSON.parse(configuredCatalog.configuration.PAYMENTS_CONNECTION);
 assert.equal(catalogConnection.successUrl,undefined);assert.equal(catalogConnection.cancelUrl,undefined);
 const catalogSdk=require(path.join(roots.billing,'packages/payments/dist/index.js')).createPaymentsClient({...catalogConnection,clientSecret:catalogClient.clientSecret});
 assert((await catalogSdk.catalog.listPlans()).length>0);
 const [catalogPolicy]=await billing.query('SELECT policy FROM billing_service_clients WHERE client_id=$1',[catalogClient.clientId]);
 assert.deepEqual(catalogPolicy.policy.organizationIds,[]);assert.deepEqual(catalogPolicy.policy.allowedReturnOrigins,[]);
 assert.equal((await legal.query('SELECT count(*)::int n FROM external_identity_sources WHERE system_id=$1',[catalogSystem.id]))[0].n,0);
 assert.equal(configuredCatalog.configuration.LEGAL_API_BASE_URL,undefined);
 const configuredLicenses=await connections.activate(operator,{systemId:licenseSystem.id,clientId:licenseClient.clientId,capabilities:[{code:'payments',functions:['licenses']}],payments:{productCode:'balanz_cfdi',organizationScope:'organizations',organizationIds:[balanz.organizationId]}});
 assert.equal(configuredLicenses.status,'configured',JSON.stringify(configuredLicenses.steps));assert.equal(configuredLicenses.ready,false);
 const licenseConnection=JSON.parse(configuredLicenses.configuration.PAYMENTS_CONNECTION);
 assert.equal(licenseConnection.successUrl,undefined);assert.equal(licenseConnection.cancelUrl,undefined);
 const licenseSdk=require(path.join(roots.billing,'packages/payments/dist/index.js')).createPaymentsClient({...licenseConnection,clientSecret:licenseClient.clientSecret});
 assert.equal((await licenseSdk.licenses.resolve(balanz.organizationId)).active,false);
 assert.equal((await legal.query('SELECT count(*)::int n FROM external_identity_sources WHERE system_id=$1',[licenseSystem.id]))[0].n,0);
 await assert.rejects(issue(licenseClient,'legal-api','legal.integration.acceptances.create'));
 console.log('PASS arbitrary capability without Billing, catalog without Legal/organization/return URLs, licenses without Legal and reused backend identity');
 const started=performance.now();
 const activated=await connections.activate(operator,selection);
 assert.equal(activated.ready,true,JSON.stringify(activated.steps));
 const repeated=await connections.activate(operator,selection);
 assert.equal(repeated.ready,true,JSON.stringify(repeated.steps));
 assert.equal((await legal.query('SELECT count(*)::int n FROM external_identity_sources WHERE system_id=$1',[system.id]))[0].n,1);
 assert.equal((await identity.query('SELECT count(*)::int n FROM oauth_clients WHERE client_id=$1',[consumerClient.clientId]))[0].n,1);
 assert.deepEqual((await legal.query("SELECT roles FROM system_clients WHERE system_id=$1 AND client_id=$2 AND capability_code='payments'",[system.id,consumerClient.clientId]))[0].roles.sort(),['catalog','checkout','licenses','receiver']);
 assert.equal(JSON.parse(activated.configuration.PAYMENTS_CONNECTION).baseUrl,connection.baseUrl);
 console.log('PASS Console activation and retry through authenticated APIs; elapsed '+Math.round(performance.now()-started)+'ms (not a browser usability timing)');
 const consumerToken=await issue(consumerClient,'billing-api','billing.integration.catalog.read');
 const claims=new JwtService().decode(consumerToken); for(const key of ['organization_id','tenant_id','roles','permissions'])assert.equal(key in claims,false);
 await assert.rejects(issue(consumerClient,'billing-api','billing.integrations.manage'));
 const prepared=await balanz.legal.prepare(balanz.session,randomUUID());
 assert.equal(prepared.documents.length,documentIds.length);
 const acceptInput={requestId:prepared.requestId,idempotencyKey:randomUUID(),confirmations:prepared.documents.map(d=>({documentVersionId:d.documentVersionId,contentHash:d.contentHash,accepted:true}))};
 const accepted=await balanz.legal.accept(balanz.session,acceptInput);
 assert.equal((await balanz.legal.accept(balanz.session,acceptInput)).legalAcceptanceId,accepted.legalAcceptanceId);
 const sdk=require(path.join(roots.billing,'packages/payments/dist/index.js')).createPaymentsClient({...connection,clientSecret:consumerClient.clientSecret});
 assert((await sdk.catalog.listPlans()).length>0);
 const checkoutInput={organizationId:balanz.organizationId,userId:subjectId,planCode:'basic',planPriceCode:'monthly',legalAcceptanceId:accepted.legalAcceptanceId,idempotencyKey:randomUUID()};
 const checkout=await sdk.checkout.create(checkoutInput);
 assert.equal((await sdk.checkout.create(checkoutInput)).checkoutId,checkout.checkoutId);
 await assert.rejects(sdk.checkout.create({...checkoutInput,organizationId:randomUUID(),idempotencyKey:randomUUID()}));
 await assert.rejects(sdk.checkout.create({...checkoutInput,userId:randomUUID(),idempotencyKey:randomUUID()}));
 await billingFixture.activate(checkout.checkoutId);
 const license=await sdk.licenses.resolve(balanz.organizationId);
 assert.equal(license.active,true);
 assert.equal((await licenseSdk.licenses.resolve(balanz.organizationId)).active,true);
 rejectDelivery=true;
 await billingFixture.deliveries.deliver();
 assert.equal((await billing.query('SELECT delivered_at FROM billing_license_deliveries WHERE organization_id=$1 AND product_code=$2',[balanz.organizationId,'balanz_cfdi']))[0].delivered_at,null);
 rejectDelivery=false;
 await billing.query("UPDATE billing_license_deliveries SET next_attempt_at=clock_timestamp() WHERE organization_id=$1 AND product_code='balanz_cfdi'",[balanz.organizationId]);
 await billingFixture.deliveries.deliver();
 assert((await billing.query('SELECT delivered_at FROM billing_license_deliveries WHERE organization_id=$1 AND product_code=$2',[balanz.organizationId,'balanz_cfdi']))[0].delivered_at);
 const access=await balanz.access.get({organizationId:balanz.organizationId,membershipId:balanz.membershipId});
 assert.equal(access.active,true);
 assert.equal((await sdk.checkout.status(checkout.checkoutId)).checkoutId,checkout.checkoutId);
 const shared=await systemOAuth.save(operator,{code:'shared_reader',name:'Second catalog consumer',enabled:true,configuration:{payments:{}},services:[],clients:[{oauthIssuer:idHttp.origin,clientId:consumerClient.clientId,capabilityCode:'payments',roles:['catalog'],enabled:true}]});
 const saved=(await legalAdmin.request('GET','systems',operator)).find(s=>s.id===system.id);
 const {id:systemId,...disabled}=saved;
 await systemOAuth.save(operator,{...disabled,enabled:false},systemId);
 await issue(consumerClient,'billing-api','billing.integration.catalog.read');
 await assert.rejects(issue(consumerClient,'billing-api','billing.integration.checkout.create'));
 await assert.rejects(issue(billingClient,'balanz-api','billing.webhooks.deliver'));
 await assert.rejects(issue(consoleClient,'balanz-api','billing.connections.check'));
 const {id:sharedId,...sharedDraft}=shared;
 await systemOAuth.save(operator,{...sharedDraft,enabled:false},sharedId);
 await assert.rejects(issue(consumerClient,'billing-api','billing.integration.catalog.read'));
 await assert.rejects(balanz.legal.prepare(balanz.session,randomUUID()));
 assert.equal((await legal.query('SELECT enabled FROM systems WHERE id=$1',[systemId]))[0].enabled,false);
 assert.deepEqual((await identity.query('SELECT service_destinations FROM oauth_clients WHERE client_id=$1',[consumerClient.clientId]))[0].service_destinations,[]);
 await systemOAuth.save(operator,{...disabled,enabled:true},systemId);
 await issue(consumerClient,'billing-api','billing.integration.checkout.create');
 await identity.query("UPDATE oauth_clients SET status='suspended' WHERE client_id=$1",[consumerClient.clientId]);
 await systemOAuth.save(operator,{...disabled,enabled:false},systemId);
 assert.equal((await legal.query('SELECT enabled FROM systems WHERE id=$1',[systemId]))[0].enabled,false);
 console.log('PASS reactivation from explicit empty grants and catalog disablement after OAuth client suspension');

 console.log('PASS shared-system grants retained until last binding disabled; new tokens denied after revocation');
 console.log('PASS legal prepare/accept/retry, signed evidence, SDK catalog/checkout/license, cross-org/user denial, real PayPal event processor, retryable license delivery and Balanz access');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 await Promise.all(nestApps.map(app=>app.close()));
 for(const server of servers)server.closeAllConnections();
 await Promise.all(servers.map(s=>new Promise(resolve=>s.close(resolve))));
 for(const db of databases.reverse())if(db.isInitialized)await db.destroy();
 await Promise.all(redisClients.map(redis=>redis.quit()));
});
