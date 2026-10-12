import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    request.body = schema.parse(request.body)
    next()
  }
}
