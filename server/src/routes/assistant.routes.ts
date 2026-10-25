import { Router } from 'express'
import { UserRole } from '@prisma/client'
import * as assistantController from '../controllers/assistant.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireRole } from '../middleware/require-role.js'

export const assistantRouter = Router()

assistantRouter.use(authenticate, requireRole(UserRole.CUSTOMER))
assistantRouter.get('/history', assistantController.getHistory)
assistantRouter.delete('/history', assistantController.clearHistory)
assistantRouter.post('/ask', assistantController.ask)
