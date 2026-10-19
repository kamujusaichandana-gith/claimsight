import type { ErrorRequestHandler } from 'express'
import { MulterError } from 'multer'
import { ZodError } from 'zod'
import { AppError } from '../lib/app-error.js'

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  void _next

  if (error instanceof ZodError) {
    response.status(400).json({
      error: 'Validation failed',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({ error: error.message })
    return
  }

  if (error instanceof MulterError) {
    const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    response.status(statusCode).json({ error: error.message })
    return
  }

  response.status(500).json({ error: 'Internal server error' })
}
