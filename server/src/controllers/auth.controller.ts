import type { RequestHandler } from 'express'
import { AppError } from '../lib/app-error.js'
import * as authService from '../services/auth.service.js'
import type { LoginInput, RegisterInput } from '../validators/auth.validator.js'

export const register: RequestHandler = async (request, response) => {
  const result = await authService.register(request.body as RegisterInput)
  response.status(201).json(result)
}

export const login: RequestHandler = async (request, response) => {
  const result = await authService.login(request.body as LoginInput)
  response.status(200).json(result)
}

export const me: RequestHandler = (request, response) => {
  if (!request.user) {
    throw new AppError(401, 'Authentication required')
  }

  response.status(200).json({ user: authService.getCurrentUser(request.user) })
}
