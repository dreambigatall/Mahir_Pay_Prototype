import cookieParser from "cookie-parser";
import cors from "cors";
import express,{type Express}from"express";
import helmet from"helmet";
import type{Pool}from"pg";
import pinoHttp from"pino-http";
import{env,type Environment}from"./config/env";import{createLogger}from"./config/logger";
import{databasePool}from"./database/pool";
import{errorHandler,notFoundHandler}from"./middleware/error-handler";
import{originGuard}from"./middleware/origin-guard";
import{requestContext}from"./middleware/request-context";
import{AuditRepository}from"./modules/audit/audit.repository";
import{AuthRepository}from"./modules/auth/auth.repository";
import{createAuthRouter}from"./modules/auth/auth.routes";
import{AuthService}from"./modules/auth/auth.service";
import{BillingRepository}from"./modules/billing/billing.repository";
import{createBillingRouter}from"./modules/billing/billing.routes";
import{BillingService}from"./modules/billing/billing.service";
import{CatalogRepository}from"./modules/catalog/catalog.repository";
import{createCatalogRouter}from"./modules/catalog/catalog.routes";
import{CatalogService}from"./modules/catalog/catalog.service";
import{CashierRepository}from"./modules/cashier/cashier.repository";
import{createCashierRouter}from"./modules/cashier/cashier.routes";
import{CashierService}from"./modules/cashier/cashier.service";
import{ClinicalRepository}from"./modules/clinical/clinical.repository";
import{createClinicalRouter}from"./modules/clinical/clinical.routes";
import{ClinicalService}from"./modules/clinical/clinical.service";
import{DiagnosticRepository}from"./modules/diagnostics/diagnostic.repository";
import{createDiagnosticRouter}from"./modules/diagnostics/diagnostic.routes";
import{DiagnosticService}from"./modules/diagnostics/diagnostic.service";
import{EncounterRepository}from"./modules/encounters/encounter.repository";
import{createEncounterRouter}from"./modules/encounters/encounter.routes";
import{EncounterService}from"./modules/encounters/encounter.service";
import{NotificationRepository}from"./modules/notifications/notification.repository";
import{createNotificationRouter}from"./modules/notifications/notification.routes";
import{NotificationService}from"./modules/notifications/notification.service";
import{PatientRepository}from"./modules/patients/patient.repository";
import{createPatientRouter}from"./modules/patients/patient.routes";
import{PatientService}from"./modules/patients/patient.service";
import{PharmacyRepository}from"./modules/pharmacy/pharmacy.repository";
import{createPharmacyRouter}from"./modules/pharmacy/pharmacy.routes";
import{PharmacyService}from"./modules/pharmacy/pharmacy.service";
import{ReferralRepository}from"./modules/referrals/referral.repository";
import{createReferralRouter}from"./modules/referrals/referral.routes";
import{ReferralService}from"./modules/referrals/referral.service";
import{ReportRepository}from"./modules/reports/report.repository";
import{createReportRouter}from"./modules/reports/report.routes";
import{ReportService}from"./modules/reports/report.service";
import{StaffRepository}from"./modules/staff/staff.repository";
import{createStaffRouter}from"./modules/staff/staff.routes";
import{StaffService}from"./modules/staff/staff.service";
import{TreatmentRepository}from"./modules/treatments/treatment.repository";
import{createTreatmentRouter}from"./modules/treatments/treatment.routes";
import{TreatmentService}from"./modules/treatments/treatment.service";
import{WorkflowRepository}from"./modules/workflow/workflow.repository";
import{createAppointmentRouter,createQueueRouter,createVisitRouter}from"./modules/workflow/workflow.routes";
import{WorkflowService}from"./modules/workflow/workflow.service";
import{asyncHandler}from"./shared/http/async-handler";

export function createApp(pool:Pool=databasePool,environment:Environment=env):Express{
 const app=express();if(environment.TRUST_PROXY)app.set("trust proxy",1);app.disable("x-powered-by");
 const logger=createLogger(environment);
 app.use(requestContext);app.use(pinoHttp({logger,quietReqLogger:environment.NODE_ENV==="test",serializers:{req(request){return{id:request.id,method:request.method,url:request.url,remoteAddress:request.remoteAddress};},res(response){return{statusCode:response.statusCode};}},customLogLevel(_request,response,error){if(error||response.statusCode>=500)return"error";if(response.statusCode>=400)return"warn";return"info";},customSuccessMessage(request,response){return request.method+" "+request.url+" "+response.statusCode;},customErrorMessage(request,response){return request.method+" "+request.url+" "+response.statusCode+" failed";}}));app.use(helmet());
 app.use(cors({origin:environment.FRONTEND_ORIGIN,credentials:true,methods:["GET","POST","PUT","PATCH","DELETE","OPTIONS"]}));
 app.use(originGuard(environment.FRONTEND_ORIGIN));app.use(express.json({limit:"1mb"}));app.use(cookieParser());
 const audit=new AuditRepository(pool);const authRepo=new AuthRepository(pool);
 const authService=new AuthService(authRepo,audit,{passwordPepper:environment.PASSWORD_PEPPER,sessionTtlHours:environment.SESSION_TTL_HOURS,sessionIdleMinutes:environment.SESSION_IDLE_MINUTES});
 const staff=new StaffService(new StaffRepository(pool,audit),environment.PASSWORD_PEPPER);
 const patients=new PatientService(new PatientRepository(pool,audit));
 const workflow=new WorkflowService(new WorkflowRepository(pool,audit));
 const encounters=new EncounterService(new EncounterRepository(pool,audit));
 const catalog=new CatalogService(new CatalogRepository(pool,audit));
 const cashier=new CashierService(new CashierRepository(pool));
 const clinical=new ClinicalService(new ClinicalRepository(pool));
 const diagnostics=new DiagnosticService(new DiagnosticRepository(pool,audit));
 const pharmacy=new PharmacyService(new PharmacyRepository(pool,audit));
 const billing=new BillingService(new BillingRepository(pool,audit));
 const treatments=new TreatmentService(new TreatmentRepository(pool,audit));
 const referrals=new ReferralService(new ReferralRepository(pool,audit));
 const notifications=new NotificationService(new NotificationRepository(pool));
 const reports=new ReportService(new ReportRepository(pool));
 app.get("/health/live",(_q,r)=>r.json({status:"ok"}));
 app.get("/health/ready",asyncHandler(async(_q,r)=>{await pool.query("select 1");r.json({status:"ready",database:"connected"});}));
 app.use("/api/v1/auth",createAuthRouter(authService,authRepo,environment));
 app.use("/api/v1/staff",createStaffRouter(staff,authRepo,environment));
 app.use("/api/v1/patients",createPatientRouter(patients,authRepo,environment));
 app.use("/api/v1/appointments",createAppointmentRouter(workflow,authRepo,environment));
 app.use("/api/v1/visits",createVisitRouter(workflow,authRepo,environment));
 app.use("/api/v1/queue",createQueueRouter(workflow,authRepo,environment));
 app.use("/api/v1/encounters",createEncounterRouter(encounters,authRepo,environment));
 app.use("/api/v1/catalog",createCatalogRouter(catalog,authRepo,environment));
 app.use("/api/v1/clinical",createClinicalRouter(clinical,authRepo,environment));
 app.use("/api/v1/diagnostics",createDiagnosticRouter(diagnostics,authRepo,environment));
 app.use("/api/v1/pharmacy",createPharmacyRouter(pharmacy,authRepo,environment));
 app.use("/api/v1/billing",createCashierRouter(cashier,authRepo,environment));
 app.use("/api/v1/billing",createBillingRouter(billing,authRepo,environment));
 app.use("/api/v1/treatment-courses",createTreatmentRouter(treatments,authRepo,environment));
 app.use("/api/v1/referrals",createReferralRouter(referrals,authRepo,environment));
 app.use("/api/v1/notifications",createNotificationRouter(notifications,authRepo,environment));
 app.use("/api/v1/reports",createReportRouter(reports,authRepo,environment));
 app.use(notFoundHandler);app.use(errorHandler);return app;
}










