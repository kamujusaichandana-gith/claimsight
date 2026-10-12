import bcrypt from 'bcrypt'
import { Prisma, UserRole } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/app-error.js'
import { createAccessToken } from '../middleware/authenticate.js'
import type { AuthUser } from '../types/auth.js'
import type { LoginInput, RegisterInput } from '../validators/auth.validator.js'

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect

const invalidCredentialsMessage = 'Invalid email or password'

export async function register(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, 12)

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: UserRole.CUSTOMER,
      },
      select: publicUserSelect,
    })

    return { user, token: createAccessToken(user.id) }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppError(409, 'An account with this email already exists')
    }

    throw error
  }
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  })

  const passwordMatches = user
    ? await bcrypt.compare(input.password, user.passwordHash)
    : false

  if (!user || !passwordMatches) {
    throw new AppError(401, invalidCredentialsMessage)
  }

  const safeUser: AuthUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  }

  return { user: safeUser, token: createAccessToken(user.id) }
}

export function getCurrentUser(user: AuthUser): AuthUser {
  return user
}
