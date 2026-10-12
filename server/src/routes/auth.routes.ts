import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import * as authController from '../controllers/auth.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { validateBody } from '../middleware/validate-body.js'
import { loginSchema, registerSchema } from '../validators/auth.validator.js'

export const authRouter = Router()

authRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: 'Too many authentication requests. Please try again later.',
    },
  }),
)

authRouter.post(
  '/register',
  validateBody(registerSchema),
  authController.register,
)
authRouter.post('/login', validateBody(loginSchema), authController.login)
authRouter.get('/me', authenticate, authController.me)
