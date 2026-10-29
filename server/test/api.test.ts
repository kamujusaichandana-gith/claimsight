import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { ClaimStatus, UserRole } from '@prisma/client'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import {
  setAiProviderFactories,
  type AiProviderFactories,
} from '../src/lib/ai-provider-factories.js'
import {
  SummarizerTimeoutError,
  type ClaimSummaryProvider,
} from '../src/services/claim-summary.service.js'
import { insufficientInformationAnswer } from '../src/services/policy-assistant.service.js'
import {
  createClaim,
  createFixtures,
  createUser,
} from './helpers.js'

const validSummary = JSON.stringify({
  summary: 'A vehicle collision damaged the insured car.',
  suggestedCategory: 'AUTO',
  urgency: 'MEDIUM',
})

const defaultFakeProviders: AiProviderFactories = {
  summary: () => ({
    generateText: async () => validSummary,
  }),
  embedding: () => ({
    embed: async () => [1, ...new Array<number>(767).fill(0)],
  }),
  assistant: () => ({
    streamText: async (_prompt, _signal, onText) => {
      onText('The policy covers this item [1].')
    },
  }),
}

let restoreProviders = () => {}

beforeEach(() => {
  process.env.LLM_ENABLED = 'false'
  delete process.env.LLM_DAILY_CALL_CAP
  restoreProviders = setAiProviderFactories(defaultFakeProviders)
})

afterEach(() => restoreProviders())

const authToken = (token: string) => `Bearer ${token}`

describe('authentication', () => {
  it('registers a CUSTOMER even when the request body asks for ADMIN and never returns a password hash', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'New User',
        email: 'new-user@example.test',
        password: 'Password-123',
        role: UserRole.ADMIN,
      })

    expect(response.status).toBe(201)
    expect(response.body.user.role).toBe(UserRole.CUSTOMER)
    expect(response.body.user).not.toHaveProperty('passwordHash')
    expect(JSON.stringify(response.body)).not.toContain('passwordHash')
  })

  it('rejects duplicate email addresses', async () => {
    await createUser(UserRole.CUSTOMER, 'duplicate@example.test')
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Duplicate',
        email: 'duplicate@example.test',
        password: 'Password-123',
      })

    expect(response.status).toBe(409)
  })

  it('logs a customer in with a valid password', async () => {
    await createUser(UserRole.CUSTOMER, 'login@example.test')
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@example.test',
        password: 'Password-for-tests-123',
      })

    expect(response.status).toBe(200)
    expect(response.body.token).toEqual(expect.any(String))
    expect(response.body.user).not.toHaveProperty('passwordHash')
  })

  it('returns the same status and message for an unknown email and a wrong password', async () => {
    await createUser(UserRole.CUSTOMER, 'known@example.test')
    const [wrongPassword, unknownEmail] = await Promise.all([
      request(app).post('/api/auth/login').send({
        email: 'known@example.test',
        password: 'Wrong-password-123',
      }),
      request(app).post('/api/auth/login').send({
        email: 'unknown@example.test',
        password: 'Wrong-password-123',
      }),
    ])

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(wrongPassword.status)
    expect(unknownEmail.body.error).toBe(wrongPassword.body.error)
  })

  it('returns the signed-in user from /me', async () => {
    const user = await createUser(UserRole.CUSTOMER, 'me@example.test')
    const response = await request(app)
      .get('/api/auth/me')
      .set('authorization', authToken(user.token))

    expect(response.status).toBe(200)
    expect(response.body.user.id).toBe(user.id)
    expect(response.body.user).not.toHaveProperty('passwordHash')
  })

  it('rejects expired and malformed tokens on /me', async () => {
    const [malformed, expired] = await Promise.all([
      request(app)
        .get('/api/auth/me')
        .set('authorization', authToken('not-a-valid-jwt')),
      request(app)
        .get('/api/auth/me')
        .set(
          'authorization',
          authToken(jwt.sign(
            { sub: 'expired-user' },
            'test-only-jwt-secret',
            { expiresIn: -1 },
          )),
        ),
    ])

    expect(malformed.status).toBe(401)
    expect(expired.status).toBe(401)
  })
})

describe('customer access control', () => {
  let fixtures: Awaited<ReturnType<typeof createFixtures>>

  beforeEach(async () => {
    fixtures = await createFixtures()
  })

  it("hides another customer's policy and claim", async () => {
    const policyResponse = await request(app)
      .get(`/api/policies/${fixtures.policyB.id}`)
      .set('authorization', authToken(fixtures.customerA.token))
    const claimResponse = await request(app)
      .get(`/api/claims/${fixtures.claimB.id}`)
      .set('authorization', authToken(fixtures.customerA.token))

    expect(policyResponse.status).toBe(404)
    expect(claimResponse.status).toBe(404)
  })

  it("hides another customer's documents on download", async () => {
    const document = await prisma.claimDocument.create({
      data: {
        claimId: fixtures.claimB.id,
        fileName: 'secret.pdf',
        filePath: 'uploads/missing-test-file.pdf',
      },
    })
    const response = await request(app)
      .get(`/api/claims/${fixtures.claimB.id}/documents/${document.id}`)
      .set('authorization', authToken(fixtures.customerA.token))

    expect(response.status).toBe(404)
  })

  it("does not allow uploading a document to another customer's claim", async () => {
    const response = await request(app)
      .post(`/api/claims/${fixtures.claimB.id}/documents`)
      .set('authorization', authToken(fixtures.customerA.token))
      .attach('file', Buffer.from('%PDF-1.7\nvalid'), {
        filename: 'evidence.pdf',
        contentType: 'application/pdf',
      })

    expect(response.status).toBe(404)
  })

  it("does not allow creating a claim against another customer's policy", async () => {
    const response = await request(app)
      .post('/api/claims')
      .set('authorization', authToken(fixtures.customerA.token))
      .send({
        policyId: fixtures.policyB.id,
        incidentDate: '2026-01-20',
        incidentType: 'Collision',
        description: 'A sufficiently clear description.',
        amount: 100,
      })

    expect(response.status).toBe(404)
  })

  it('forbids customer access to admin routes and requires a token', async () => {
    const [customerResponse, anonymousResponse] = await Promise.all([
      request(app)
        .get('/api/admin/claims')
        .set('authorization', authToken(fixtures.customerA.token)),
      request(app).get('/api/admin/claims'),
    ])

    expect(customerResponse.status).toBe(403)
    expect(anonymousResponse.status).toBe(401)
  })
})

describe('claims', () => {
  let fixtures: Awaited<ReturnType<typeof createFixtures>>

  beforeEach(async () => {
    fixtures = await createFixtures()
  })

  it.each([
    ['future incident date', { incidentDate: '2099-01-01', description: 'Valid description.' }],
    ['short description', { incidentDate: '2026-01-20', description: 'Too short.' }],
    ['non-positive amount', { incidentDate: '2026-01-20', amount: 0 }],
  ])('rejects a claim with a %s', async (_case, input) => {
    const response = await request(app)
      .post('/api/claims')
      .set('authorization', authToken(fixtures.customerA.token))
      .send({
        ...{
          policyId: fixtures.policyA.id,
          incidentDate: '2026-01-20',
          incidentType: 'Collision',
          description: 'A sufficiently clear description.',
          amount: 100,
        },
        ...input,
      })

    expect(response.status).toBe(400)
  })

  it('rejects claims on an inactive policy', async () => {
    const response = await request(app)
      .post('/api/claims')
      .set('authorization', authToken(fixtures.customerA.token))
      .send({
        policyId: fixtures.inactivePolicyA.id,
        incidentDate: '2026-01-20',
        incidentType: 'Collision',
        description: 'A sufficiently clear description.',
        amount: 100,
      })

    expect(response.status).toBe(404)
  })

  it('creates a submitted claim and its first history row together', async () => {
    const response = await request(app)
      .post('/api/claims')
      .set('authorization', authToken(fixtures.customerA.token))
      .send({
        policyId: fixtures.policyA.id,
        incidentDate: '2026-01-20',
        incidentType: 'Collision',
        description: 'A sufficiently clear description.',
        amount: 100,
      })
    const history = await prisma.claimStatusHistory.findMany({
      where: { claimId: response.body.claim.id },
    })

    expect(response.status).toBe(201)
    expect(response.body.claim.status).toBe(ClaimStatus.SUBMITTED)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      fromStatus: null,
      toStatus: ClaimStatus.SUBMITTED,
      changedById: fixtures.customerA.id,
    })
  })

  it('caps page size and rejects non-whitelisted sort fields', async () => {
    const overLimit = await request(app)
      .get('/api/claims?limit=51')
      .set('authorization', authToken(fixtures.customerA.token))
    const invalidSort = await request(app)
      .get('/api/claims?sortBy=passwordHash')
      .set('authorization', authToken(fixtures.customerA.token))
    const adminList = await request(app)
      .get('/api/admin/claims?limit=1000')
      .set('authorization', authToken(fixtures.admin.token))
    const invalidAdminSort = await request(app)
      .get('/api/admin/claims?sortBy=passwordHash')
      .set('authorization', authToken(fixtures.admin.token))

    expect(overLimit.status).toBe(400)
    expect(invalidSort.status).toBe(400)
    expect(adminList.status).toBe(200)
    expect(adminList.body.pagination.limit).toBe(50)
    expect(invalidAdminSort.status).toBe(400)
  })
})

describe('admin claim workflow', () => {
  let fixtures: Awaited<ReturnType<typeof createFixtures>>

  beforeEach(async () => {
    fixtures = await createFixtures()
  })

  it('allows valid transitions and records history using the authenticated admin id', async () => {
    const first = await request(app)
      .patch(`/api/admin/claims/${fixtures.claimA.id}/status`)
      .set('authorization', authToken(fixtures.admin.token))
      .send({
        status: ClaimStatus.UNDER_REVIEW,
        changedById: fixtures.customerA.id,
      })
    const second = await request(app)
      .patch(`/api/admin/claims/${fixtures.claimA.id}/status`)
      .set('authorization', authToken(fixtures.admin.token))
      .send({ status: ClaimStatus.APPROVED })
    const third = await request(app)
      .patch(`/api/admin/claims/${fixtures.claimA.id}/status`)
      .set('authorization', authToken(fixtures.admin.token))
      .send({ status: ClaimStatus.PAID })
    const history = await prisma.claimStatusHistory.findMany({
      where: { claimId: fixtures.claimA.id },
      orderBy: { createdAt: 'asc' },
    })

    expect([first.status, second.status, third.status]).toEqual([200, 200, 200])
    expect(history.map((entry) => entry.toStatus)).toEqual([
      ClaimStatus.UNDER_REVIEW,
      ClaimStatus.APPROVED,
      ClaimStatus.PAID,
    ])
    expect(history.every((entry) => entry.changedById === fixtures.admin.id)).toBe(true)
  })

  it('rejects a direct SUBMITTED-to-PAID transition', async () => {
    const response = await request(app)
      .patch(`/api/admin/claims/${fixtures.claimA.id}/status`)
      .set('authorization', authToken(fixtures.admin.token))
      .send({ status: ClaimStatus.PAID })

    expect(response.status).toBe(400)
  })

  it.each([ClaimStatus.REJECTED, ClaimStatus.PAID])(
    'does not allow a %s claim to change status',
    async (status) => {
      const terminalClaim = await createClaim(
        fixtures.customerA.id,
        fixtures.policyA.id,
        { status },
      )
      const response = await request(app)
        .patch(`/api/admin/claims/${terminalClaim.id}/status`)
        .set('authorization', authToken(fixtures.admin.token))
        .send({ status: ClaimStatus.UNDER_REVIEW })

      expect(response.status).toBe(400)
    },
  )
})

describe('claim document uploads', () => {
  let fixtures: Awaited<ReturnType<typeof createFixtures>>

  beforeEach(async () => {
    fixtures = await createFixtures()
  })

  it('rejects unsupported file types and files larger than 5 MiB', async () => {
    const wrongType = await request(app)
      .post(`/api/claims/${fixtures.claimA.id}/documents`)
      .set('authorization', authToken(fixtures.customerA.token))
      .attach('file', Buffer.from('not a PDF'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
    const oversized = await request(app)
      .post(`/api/claims/${fixtures.claimA.id}/documents`)
      .set('authorization', authToken(fixtures.customerA.token))
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'large.pdf',
        contentType: 'application/pdf',
      })

    expect(wrongType.status).toBe(400)
    expect(oversized.status).toBe(413)
  })

  it('uses random stored names instead of uploaded names', async () => {
    const pdf = Buffer.from('%PDF-1.7\nfixture')
    const first = await request(app)
      .post(`/api/claims/${fixtures.claimA.id}/documents`)
      .set('authorization', authToken(fixtures.customerA.token))
      .attach('file', pdf, { filename: 'evidence.pdf', contentType: 'application/pdf' })
    const second = await request(app)
      .post(`/api/claims/${fixtures.claimA.id}/documents`)
      .set('authorization', authToken(fixtures.customerA.token))
      .attach('file', pdf, { filename: 'evidence.pdf', contentType: 'application/pdf' })

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(first.body.document.fileName).not.toBe('evidence.pdf')
    expect(second.body.document.fileName).not.toBe(first.body.document.fileName)
  })
})

describe('AI claim summaries', () => {
  let fixtures: Awaited<ReturnType<typeof createFixtures>>

  beforeEach(async () => {
    fixtures = await createFixtures()
    process.env.LLM_ENABLED = 'true'
  })

  it('requires an admin, validates provider output, and caches a successful summary', async () => {
    const generateText = vi.fn(async () => validSummary)
    restoreProviders = setAiProviderFactories({
      summary: () => ({ generateText }),
    })

    const forbidden = await request(app)
      .post(`/api/admin/claims/${fixtures.claimA.id}/summary`)
      .set('authorization', authToken(fixtures.customerA.token))
    const first = await request(app)
      .post(`/api/admin/claims/${fixtures.claimA.id}/summary`)
      .set('authorization', authToken(fixtures.admin.token))
    const cached = await request(app)
      .post(`/api/admin/claims/${fixtures.claimA.id}/summary`)
      .set('authorization', authToken(fixtures.admin.token))

    expect(forbidden.status).toBe(403)
    expect(first.status).toBe(200)
    expect(first.body.suggestedCategory).toBe('AUTO')
    expect(cached.body).toEqual(first.body)
    expect(generateText).toHaveBeenCalledTimes(1)
  })

  it('retries invalid JSON once and then returns 502', async () => {
    const generateText = vi.fn(async () => 'not JSON')
    restoreProviders = setAiProviderFactories({
      summary: () => ({ generateText }),
    })
    const response = await request(app)
      .post(`/api/admin/claims/${fixtures.claimA.id}/summary`)
      .set('authorization', authToken(fixtures.admin.token))

    expect(response.status).toBe(502)
    expect(generateText).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['timeout', async () => { throw new SummarizerTimeoutError() }, 504],
    ['provider error', async () => { throw new Error('simulated provider failure') }, 502],
  ])('maps a %s to the expected gateway response', async (_label, generateText, status) => {
    const provider: ClaimSummaryProvider = { generateText }
    restoreProviders = setAiProviderFactories({ summary: () => provider })
    const response = await request(app)
      .post(`/api/admin/claims/${fixtures.claimA.id}/summary`)
      .set('authorization', authToken(fixtures.admin.token))

    expect(response.status).toBe(status)
  })

  it('enforces the per-admin rate limit and the daily call cap', async () => {
    const generateText = vi.fn(async () => validSummary)
    restoreProviders = setAiProviderFactories({
      summary: () => ({ generateText }),
    })
    const rateLimitClaims = await Promise.all(
      Array.from({ length: 6 }, () =>
        createClaim(fixtures.customerA.id, fixtures.policyA.id),
      ),
    )
    const rateResponses = []
    for (const claim of rateLimitClaims) {
      rateResponses.push(await request(app)
        .post(`/api/admin/claims/${claim.id}/summary`)
        .set('authorization', authToken(fixtures.admin.token)))
    }

    expect(rateResponses.slice(0, 5).every((response) => response.status === 200)).toBe(true)
    expect(rateResponses[5].status).toBe(429)

    process.env.LLM_DAILY_CALL_CAP = '1'
    await prisma.claimSummaryUsage.deleteMany()
    const dailyAdmin = await createUser(UserRole.ADMIN, 'daily-admin@example.test')
    const dailyClaims = await Promise.all(
      Array.from({ length: 2 }, () =>
        createClaim(fixtures.customerB.id, fixtures.policyB.id),
      ),
    )
    const dailyFirst = await request(app)
      .post(`/api/admin/claims/${dailyClaims[0].id}/summary`)
      .set('authorization', authToken(dailyAdmin.token))
    const dailySecond = await request(app)
      .post(`/api/admin/claims/${dailyClaims[1].id}/summary`)
      .set('authorization', authToken(dailyAdmin.token))

    expect(dailyFirst.status).toBe(200)
    expect(dailySecond.status).toBe(429)
  })

  it('returns the unavailable response when LLM_ENABLED is false', async () => {
    process.env.LLM_ENABLED = 'false'
    const response = await request(app)
      .post(`/api/admin/claims/${fixtures.claimA.id}/summary`)
      .set('authorization', authToken(fixtures.admin.token))

    expect(response.status).toBe(503)
  })
})

describe('policy assistant', () => {
  let fixtures: Awaited<ReturnType<typeof createFixtures>>

  beforeEach(async () => {
    fixtures = await createFixtures()
    process.env.LLM_ENABLED = 'true'
  })

  it("hides another customer's policy and rejects questions longer than 500 characters", async () => {
    const forbiddenPolicy = await request(app)
      .post('/api/assistant/ask')
      .set('authorization', authToken(fixtures.customerA.token))
      .send({ policyId: fixtures.policyB.id, question: 'What is covered?' })
    const tooLongQuestion = await request(app)
      .post('/api/assistant/ask')
      .set('authorization', authToken(fixtures.customerA.token))
      .send({ policyId: fixtures.policyA.id, question: 'a'.repeat(501) })

    expect(forbiddenPolicy.status).toBe(404)
    expect(tooLongQuestion.status).toBe(400)
  })

  it('returns the fixed fallback without calling generation when retrieval finds no chunks', async () => {
    const streamText = vi.fn()
    restoreProviders = setAiProviderFactories({
      embedding: () => ({
        embed: async () => [1, ...new Array<number>(767).fill(0)],
      }),
      assistant: () => ({ streamText }),
    })
    const response = await request(app)
      .post('/api/assistant/ask')
      .set('authorization', authToken(fixtures.customerA.token))
      .send({ policyId: fixtures.policyA.id, question: 'What does this cover?' })

    expect(response.status).toBe(200)
    expect(response.text).toContain(insufficientInformationAnswer)
    expect(streamText).not.toHaveBeenCalled()
  })

  it('scopes history to the signed-in customer and maps embedding failures to 502', async () => {
    await prisma.chatMessage.createMany({
      data: [
        {
          userId: fixtures.customerA.id,
          policyId: fixtures.policyA.id,
          role: 'USER',
          content: 'My message',
        },
        {
          userId: fixtures.customerB.id,
          policyId: fixtures.policyB.id,
          role: 'USER',
          content: 'Other customer message',
        },
      ],
    })
    const history = await request(app)
      .get(`/api/assistant/history?policyId=${fixtures.policyA.id}`)
      .set('authorization', authToken(fixtures.customerA.token))
    const foreignPolicy = await request(app)
      .get(`/api/assistant/history?policyId=${fixtures.policyB.id}`)
      .set('authorization', authToken(fixtures.customerA.token))
    const cleared = await request(app)
      .delete(`/api/assistant/history?policyId=${fixtures.policyA.id}`)
      .set('authorization', authToken(fixtures.customerA.token))
    const remaining = await prisma.chatMessage.findMany()
    restoreProviders = setAiProviderFactories({
      embedding: () => ({
        embed: async () => {
          throw new Error('simulated embedding failure')
        },
      }),
    })
    const failedEmbedding = await request(app)
      .post('/api/assistant/ask')
      .set('authorization', authToken(fixtures.customerA.token))
      .send({ policyId: fixtures.policyA.id, question: 'What does this cover?' })

    expect(history.status).toBe(200)
    expect(history.body.items.map((item: { content: string }) => item.content)).toEqual(['My message'])
    expect(foreignPolicy.status).toBe(404)
    expect(cleared.status).toBe(204)
    expect(remaining.map((message) => message.content)).toEqual(['Other customer message'])
    expect(failedEmbedding.status).toBe(502)
  })
})
