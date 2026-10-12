import type { RequestHandler } from 'express'
import type { UserRole } from '@prisma/client'
import { AppError } from '../lib/app-error.js'

export function requireRole(role: UserRole): RequestHandler {
  return (request, _response, next) => {
    if (request.user?.role !== role) {
      throw new AppError(403, 'Forbidden')
    }

    next()
  }
}
