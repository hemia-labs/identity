const { createRequire } = require('node:module');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const root=path.resolve(__dirname,'../../../../../billing/apps/api');
const req=createRequire(root+'/package.json');
const load=(file,symbol)=>req(root+'/dist/src/'+file+'.js')[symbol];
const {Reflector}=req('@nestjs/core');
const entities=req(root+'/dist/src/modules/billing-shared');
module.exports=async function({db,config,organizationId}) {
 const repo=name=>db.getRepository(entities[name]);
 const audit=new (load('modules/audit/billing-audit.service','BillingAuditService'))(repo('BillingAuditLogEntity'));
 const resolver=new (load('modules/catalog/billing-plan-catalog.resolver','BillingPlanCatalogResolver'))();
 const policyRepo=db.getRepository(load('common/entities/billing-service-client.entity','BillingServiceClientEntity'));
 const registry=new (load('common/services/billing-service-client-registry.service','BillingServiceClientRegistryService'))(policyRepo);
 const policy=new (load('common/services/billing-service-policy.service','BillingServicePolicyService'))(config,registry);
 let paypalCalls=0;
 const paypal={
  createSubscription:async({requestId})=>{paypalCalls++;return {id:'I-'+requestId,approvalUrl:'https://www.sandbox.paypal.com/checkoutnow?token=isolated-fixture'};},
  getSubscription:async id=>({id,status:'ACTIVE',raw:{id,status:'ACTIVE',billing_info:{next_billing_time:new Date(Date.now()+30*86400000).toISOString(),last_payment:{time:new Date().toISOString(),amount:{currency_code:'MXN',value:'100.00'}}}}}),
 };
 const checkout=new (load('modules/checkout/billing-checkout.service','BillingCheckoutService'))(db,new (load('modules/checkout/clients/hemia-legal-client.service','HemiaLegalClientService'))(config),paypal,audit,repo('BillingCheckoutSessionEntity'),repo('BillingSubscriptionEntity'),resolver,policy);
 const catalog=new (load('modules/catalog/billing-catalog.service','BillingCatalogService'))(...['BillingProductEntity','BillingPlanEntity','BillingPlanVersionEntity','BillingPlanPriceEntity','BillingProviderPriceEntity','BillingFeatureDefinitionEntity','BillingPlanEntitlementEntity','BillingAddonEntity','BillingSubscriptionEntity','BillingSubscriptionAddonEntity'].map(repo),resolver);
 const entitlements=new (load('modules/entitlements/billing-entitlements.service','BillingEntitlementsService'))(repo('BillingSubscriptionEntity'),repo('BillingSubscriptionAddonEntity'),repo('BillingEntitlementEntity'),audit,resolver);
 const licenses=new (load('modules/licenses/billing-licenses.service','BillingLicensesService'))(repo('BillingLicenseEntity'),entitlements);
 const deliveries=new (load('modules/licenses/license-webhook-delivery.service','LicenseWebhookDeliveryService'))(db,config,licenses);
 const identity=new (load('modules/integrations/oauth-clients/billing-identity-oauth-clients.service','BillingIdentityOAuthClientsService'))(config);
 const clients=new (load('modules/integrations/service-clients/billing-service-clients.service','BillingServiceClientsService'))(policyRepo,repo('BillingProductEntity'),config,audit,identity);
 const admin=new (load('modules/integrations/billing-integration-admin.service','BillingIntegrationAdminService'))(db,config,identity,clients,audit,deliveries);
 const adminController=new (load('modules/integrations/billing-integration-admin.controller','BillingIntegrationAdminController'))(admin,clients);
 const integrations=new (load('modules/integrations/billing-integrations.controller','BillingIntegrationsController'))(catalog,checkout,licenses);
 const bearer=new (load('common/guards/sso-bearer.guard','SsoBearerGuard'))(config);
 const adminGuard=new (load('modules/integrations/billing-integration-admin.guard','BillingIntegrationAdminGuard'))(bearer,new Reflector());
 const internalGuard=new (load('common/guards/billing-internal-auth.guard','BillingInternalAuthGuard'))(bearer,policy);
 const resourcePolicy=new (load('common/guards/billing-service-policy.guard','BillingServicePolicyGuard'))(new Reflector(),new (load('common/repositories/billing-resource-context.repository','BillingResourceContextRepository'))(db),policy);
 const permissions=new (load('common/guards/permissions.guard','PermissionsGuard'))(new Reflector(),db,resourcePolicy);
 const context=(request,controller,method)=>({switchToHttp:()=>({getRequest:()=>request}),getClass:()=>controller.constructor,getHandler:()=>controller[method]});
 const [product]=await db.query("INSERT INTO products(code,name) VALUES('balanz_cfdi','Balanz') RETURNING id");
 const [plan]=await db.query("INSERT INTO plans(product_id,code,name,status) VALUES($1,'basic','Basic','active') RETURNING id",[product.id]);
 const [version]=await db.query("INSERT INTO plan_versions(plan_id,version,status) VALUES($1,1,'published') RETURNING id",[plan.id]);
 const [price]=await db.query("INSERT INTO plan_prices(plan_version_id,code,billing_interval,currency,amount) VALUES($1,'monthly','month','MXN',100) RETURNING id",[version.id]);
 await db.query("INSERT INTO provider_prices(plan_price_id,provider,provider_price_id) VALUES($1,'paypal','P-TEST')",[price.id]);
 await db.query("INSERT INTO tenants(organization_id,name,code) VALUES($1,'Fixture buyer','flow')",[organizationId]);
 async function handle(request) {
  const adminPrefix='/api/v1/billing/integrations/admin/';
  if(request.path.startsWith(adminPrefix)) {
   const route=request.path.slice(adminPrefix.length),segments=route.split('/');
   const method=route==='options'?'options':segments[0]==='clients'?'saveClient':segments[2]==='check'?'checkReceiver':'saveReceiver';
   await adminGuard.canActivate(context(request,adminController,method));
   if(method==='options')return adminController.options();
   if(method==='saveClient')return adminController.saveClient(decodeURIComponent(segments[1]),request.body,request);
   if(method==='saveReceiver')return adminController.saveReceiver(segments[1],request.body,request);
   return adminController.checkReceiver(segments[1]);
  }
  const prefix='/api/v1/billing/integrations/v1/';
  if(!request.path.startsWith(prefix))throw Object.assign(new Error('Unknown Billing route'),{status:404});
  const route=request.path.slice(prefix.length);let method;
  if(/^catalog\/products\/[^/]+\/plans$/.test(route)){method='listPlans';request.params.productCode=decodeURIComponent(route.split('/')[2]);}
  else if(route==='checkout/sessions')method='createCheckoutSession';
  else if(/^checkout\/sessions\/[^/]+\/status$/.test(route)){method='getCheckoutStatus';request.params.id=route.split('/')[2];}
  else if(route==='licenses/resolve')method='resolveLicense';
  else throw Object.assign(new Error('Unknown Billing route'),{status:404});
  const ctx=context(request,integrations,method);await internalGuard.canActivate(ctx);await permissions.canActivate(ctx);
  if(method==='listPlans')return integrations.listPlans(request.params.productCode);
  if(method==='createCheckoutSession')return integrations.createCheckoutSession(request.body,request);
  if(method==='getCheckoutStatus')return integrations.getCheckoutStatus(request.params.id,request);
  return integrations.resolveLicense(request.query,request);
 }
 async function activate(checkoutId) {
  assert.equal(paypalCalls,1,'Retry must not create another PayPal subscription');
  const stored=await repo('BillingCheckoutSessionEntity').findOneByOrFail({id:checkoutId});
  const subscription=await repo('BillingSubscriptionEntity').findOneByOrFail({id:stored.subscriptionId});
  const calculator=new (load('modules/licenses/billing-license-calculator.service','BillingLicenseCalculatorService'))(resolver);
  const processor=new (load('modules/webhooks/paypal/billing-subscription-payments-processor.service','BillingSubscriptionPaymentsProcessorService'))(paypal,calculator,audit);
  const input={eventId:randomUUID(),providerEventId:'WH-'+randomUUID(),eventType:'BILLING.SUBSCRIPTION.ACTIVATED',resource:{id:subscription.providerSubscriptionId}};
  const prepared=await processor.prepare(input);
  const result=await db.transaction(manager=>processor.process(manager,input,prepared));
  assert.equal(result.processingStatus,'processed');
  return result;
 }
 return {handle,deliveries,activate};
};
