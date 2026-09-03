import { Router, type Request } from "express";
import { z } from "zod";

import type { Environment } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { requireAnyPermission } from "../../middleware/authorize-any";
import { requirePasswordChanged } from "../../middleware/require-password-changed";
import { validateBody } from "../../middleware/validate";
import { AppError } from "../../shared/errors/app-error";
import { asyncHandler } from "../../shared/http/async-handler";
import type { AuthStore } from "../auth/auth.repository";
import type { RequestMetadata } from "../audit/audit.repository";
import {
  appointmentCreateSchema,
  appointmentListQuerySchema,
  assignDoctorSchema,
  checkInSchema,
  visitListQuerySchema,
  queueListQuerySchema,
  queueTransitionSchema,
  triageWriteSchema,
} from "./workflow.schemas";
import { WorkflowService } from "./workflow.service";

function protectedRouter(authStore: AuthStore, env: Environment): Router {
  const router = Router();
  router.use(authenticate(authStore, env.SESSION_COOKIE_NAME, env.SESSION_IDLE_MINUTES));
  router.use(requirePasswordChanged);
  return router;
}

export function createAppointmentRouter(service: WorkflowService, authStore: AuthStore, env: Environment): Router {
  const router = protectedRouter(authStore, env);
  router.get(
    "/",
    requirePermission("appointment.manage"),
    asyncHandler(async (request, response) => {
      const query = appointmentListQuerySchema.safeParse(request.query);
      if (!query.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid appointment query", query.error.flatten());
      response.json({ items: await service.listAppointments(query.data.from, query.data.to, query.data.doctorId, query.data.limit) });
    }),
  );
  router.post(
    "/",
    requirePermission("appointment.manage"),
    validateBody(appointmentCreateSchema),
    asyncHandler(async (request, response) => {
      const item = await service.createAppointment(request.auth!.userId, request.body, metadataFrom(request));
      response.status(201).json({ item });
    }),
  );
  router.post(
    "/:appointmentId/cancel",
    requirePermission("appointment.manage"),
    validateBody(z.object({ reason: z.string().trim().min(1).max(500) })),
    asyncHandler(async (request, response) => {
      const item = await service.cancelAppointment(
        z.string().uuid().parse(request.params.appointmentId),
        request.auth!.userId,
        request.body.reason,
        metadataFrom(request),
      );
      response.json({ item });
    }),
  );
  return router;
}

export function createVisitRouter(service: WorkflowService, authStore: AuthStore, env: Environment): Router {
  const router = protectedRouter(authStore, env);
  router.post(
    "/check-in",
    requirePermission("visit.manage"),
    validateBody(checkInSchema),
    asyncHandler(async (request, response) => {
      const item = await service.checkIn(request.auth!.userId, request.body, metadataFrom(request));
      response.status(201).json({ item });
    }),
  );
  router.get(
    "/",
    requirePermission("patient.read"),
    asyncHandler(async (request, response) => {
      const query = visitListQuerySchema.safeParse(request.query);
      if (!query.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid visit query", query.error.flatten());
      const doctorId = query.data.doctorId ?? request.auth!.userId;
      response.json({ items: await service.listVisits(doctorId, query.data.limit, query.data.scope) });
    }),
  );
  router.get(
    "/active-by-patient/:patientId",
    requirePermission("patient.read"),
    asyncHandler(async (request, response) => {
      const item = await service.getActiveVisitByPatient(z.string().uuid().parse(request.params.patientId));
      response.json({ item });
    }),
  );
  router.get(
    "/:visitId",
    requirePermission("patient.read"),
    asyncHandler(async (request, response) => {
      response.json({ item: await service.getVisit(z.string().uuid().parse(request.params.visitId)) });
    }),
  );
  router.patch(
    "/:visitId/doctor",
    requirePermission("visit.manage"),
    validateBody(assignDoctorSchema),
    asyncHandler(async (request, response) => {
      const item = await service.assignDoctor(
        z.string().uuid().parse(request.params.visitId),
        request.body.doctorId,
        request.auth!.userId,
        metadataFrom(request),
      );
      response.json({ item });
    }),
  );
  router.post(
    "/:visitId/send-to-doctor",
    requireAnyPermission("visit.manage", "triage.record"),
    asyncHandler(async (request, response) => {
      const item = await service.sendToDoctor(
        z.string().uuid().parse(request.params.visitId),
        request.auth!.userId,
        metadataFrom(request),
      );
      response.json({ item });
    }),
  );
  router.put(
    "/:visitId/triage",
    requirePermission("triage.record"),
    validateBody(triageWriteSchema),
    asyncHandler(async (request, response) => {
      const item = await service.recordTriage(
        z.string().uuid().parse(request.params.visitId),
        request.body,
        request.auth!.userId,
        metadataFrom(request),
      );
      response.json({ item });
    }),
  );
  router.put(
    "/:visitId/vitals",
    requireAnyPermission("triage.record", "encounter.document"),
    validateBody(triageWriteSchema),
    asyncHandler(async (request, response) => {
      const item = await service.saveVitals(
        z.string().uuid().parse(request.params.visitId),
        request.body,
        request.auth!.userId,
        metadataFrom(request),
      );
      response.json({ item });
    }),
  );
  return router;
}

export function createQueueRouter(service: WorkflowService, authStore: AuthStore, env: Environment): Router {
  const router = protectedRouter(authStore, env);
  router.get(
    "/",
    requirePermission("queue.read"),
    asyncHandler(async (request, response) => {
      const query = queueListQuerySchema.safeParse(request.query);
      if (!query.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid queue query", query.error.flatten());
      response.json({ items: await service.listQueue(query.data.station, query.data.status, query.data.limit) });
    }),
  );
  router.patch(
    "/:queueEntryId",
    requirePermission("queue.manage"),
    validateBody(queueTransitionSchema),
    asyncHandler(async (request, response) => {
      const item = await service.transitionQueue(
        z.string().uuid().parse(request.params.queueEntryId),
        request.body.action,
        request.body.notes,
        request.auth!.userId,
        metadataFrom(request),
      );
      response.json({ item });
    }),
  );
  return router;
}

function metadataFrom(request: Request): RequestMetadata {
  return { requestId: request.requestId, ipAddress: request.ip, userAgent: request.get("user-agent") };
}
