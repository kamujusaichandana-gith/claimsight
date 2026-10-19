import { Router } from 'express'
import { UserRole } from '@prisma/client'
import * as adminController from '../controllers/admin.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireRole } from '../middleware/require-role.js'

export const adminRouter = Router()

adminRouter.use(authenticate, requireRole(UserRole.ADMIN))

adminRouter.get('/claims', adminController.listClaims)
adminRouter.get('/claims/:id', adminController.getClaim)
adminRouter.patch('/claims/:id/status', adminController.updateClaimStatus)
adminRouter.post('/claims/:id/comments', adminController.createClaimComment)
adminRouter.get('/stats', adminController.getStats)
