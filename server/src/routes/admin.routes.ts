import { Router } from 'express'
import { UserRole } from '@prisma/client'
import { rateLimit } from 'express-rate-limit'
import * as adminController from '../controllers/admin.controller.js'
import { downloadClaimDocument } from '../controllers/document.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireRole } from '../middleware/require-role.js'

export const adminRouter = Router()

adminRouter.use(authenticate, requireRole(UserRole.ADMIN))

const summaryRateLimit = rateLimit({
  windowMs: Number(process.env.LLM_ADMIN_RATE_LIMIT_WINDOW_MS ?? 60 * 60 * 1000),
  limit: Number(process.env.LLM_ADMIN_RATE_LIMIT ?? 5),
  keyGenerator: (request) => request.user?.id ?? 'unknown',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many AI summary requests. Please wait before trying again.',
  },
})

adminRouter.get('/claims', adminController.listClaims)
adminRouter.get('/claims/:id', adminController.getClaim)
adminRouter.get('/claims/:id/summary', adminController.getClaimSummary)
adminRouter.get(
  '/claims/:claimId/documents/:documentId',
  downloadClaimDocument,
)
adminRouter.patch('/claims/:id/status', adminController.updateClaimStatus)
adminRouter.post('/claims/:id/comments', adminController.createClaimComment)
adminRouter.post(
  '/claims/:id/summary',
  summaryRateLimit,
  adminController.createClaimSummary,
)
adminRouter.get('/stats', adminController.getStats)
