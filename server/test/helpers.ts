import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import { ClaimStatus, PolicyStatus, PolicyType, UserRole } from '@prisma/client'
import { prisma } from '../src/lib/prisma.js'
import { createAccessToken } from '../src/middleware/authenticate.js'

const fixturePasswordHash = await bcrypt.hash('Password-for-tests-123', 4)

export async function createUser(
  role: UserRole,
  email: string,
  name = role === UserRole.ADMIN ? 'Test Admin' : 'Test Customer',
) {
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: fixturePasswordHash,
      role,
    },
  })
  return { ...user, token: createAccessToken(user.id) }
}

export async function createPolicy(
  userId: string,
  options: { status?: PolicyStatus; type?: PolicyType } = {},
) {
  return prisma.policy.create({
    data: {
      policyNumber: `POL-${randomUUID()}`,
      type: options.type ?? PolicyType.AUTO,
      coverageAmount: 100_000,
      premium: 1_200,
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: new Date('2035-01-01T00:00:00.000Z'),
      status: options.status ?? PolicyStatus.ACTIVE,
      userId,
    },
  })
}

export async function createClaim(
  userId: string,
  policyId: string,
  options: { status?: ClaimStatus; description?: string } = {},
) {
  return prisma.claim.create({
    data: {
      claimNumber: `CLM-${randomUUID()}`,
      policyId,
      userId,
      incidentDate: new Date('2026-01-15T00:00:00.000Z'),
      incidentType: 'Vehicle collision',
      description: options.description ?? 'A test vehicle collision claim.',
      amount: 5_000,
      status: options.status ?? ClaimStatus.SUBMITTED,
    },
  })
}

export async function createFixtures() {
  const admin = await createUser(UserRole.ADMIN, 'admin@example.test')
  const customerA = await createUser(UserRole.CUSTOMER, 'customer-a@example.test')
  const customerB = await createUser(UserRole.CUSTOMER, 'customer-b@example.test')
  const policyA = await createPolicy(customerA.id)
  const policyB = await createPolicy(customerB.id)
  const inactivePolicyA = await createPolicy(customerA.id, {
    status: PolicyStatus.EXPIRED,
  })
  const claimA = await createClaim(customerA.id, policyA.id)
  const claimB = await createClaim(customerB.id, policyB.id)

  return {
    admin,
    customerA,
    customerB,
    policyA,
    policyB,
    inactivePolicyA,
    claimA,
    claimB,
  }
}
