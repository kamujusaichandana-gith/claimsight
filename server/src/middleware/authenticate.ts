import type { RequestHandler } from 'express'
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/app-error.js'

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

const jwtSecret = requiredEnvironmentVariable('JWT_SECRET')
const jwtExpiresIn = requiredEnvironmentVariable('JWT_EXPIRES_IN')

export function createAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, jwtSecret, {
    expiresIn: jwtExpiresIn as SignOptions['expiresIn'],
  })
}

export const authenticate: RequestHandler = async (
  request,
  _response,
  next,
) => {
  const authorization = request.get('authorization')
  const [scheme, token] = authorization?.split(' ') ?? []

  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'Authentication required')
  }

  let payload: string | JwtPayload
  try {
    payload = jwt.verify(token, jwtSecret)
  } catch {
    throw new AppError(401, 'Invalid or expired token')
  }

  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw new AppError(401, 'Invalid or expired token')
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  if (!user) {
    throw new AppError(401, 'Invalid or expired token')
  }

  request.user = user
  next()
}
