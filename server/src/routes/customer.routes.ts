import { Router } from 'express'
import * as customerController from '../controllers/customer.controller.js'
import { downloadClaimDocument } from '../controllers/document.controller.js'
import {
  claimDocumentUpload,
  validateClaimDocumentContent,
} from '../middleware/claim-document-upload.js'
import { authenticate } from '../middleware/authenticate.js'
import { validateBody } from '../middleware/validate-body.js'
import { createClaimSchema } from '../validators/customer.validator.js'

export const customerRouter = Router()

customerRouter.use(authenticate)

customerRouter.get('/policies', customerController.listPolicies)
customerRouter.get('/policies/:id', customerController.getPolicy)
customerRouter.post(
  '/claims',
  validateBody(createClaimSchema),
  customerController.createClaim,
)
customerRouter.get('/claims', customerController.listClaims)
customerRouter.get('/claims/:id', customerController.getClaim)
customerRouter.get(
  '/claims/:claimId/documents/:documentId',
  downloadClaimDocument,
)
customerRouter.post(
  '/claims/:id/documents',
  customerController.ensureOwnedClaim,
  claimDocumentUpload.single('file'),
  validateClaimDocumentContent,
  customerController.createClaimDocument,
)
