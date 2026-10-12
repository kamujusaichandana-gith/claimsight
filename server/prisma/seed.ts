import 'dotenv/config'
import bcrypt from 'bcrypt'
import { ClaimStatus, PolicyStatus, PolicyType, UserRole } from '@prisma/client'
import { prisma } from '../src/lib/prisma.js'

const demoAdminPassword = 'AdminDemo123!'
const demoCustomerPassword = 'CustomerDemo123!'

const userSeeds = [
  {
    name: 'Morgan Chen',
    email: 'admin@claimsight.local',
    role: UserRole.ADMIN,
  },
  {
    name: 'Avery Brooks',
    email: 'avery.brooks@example.test',
    role: UserRole.CUSTOMER,
  },
  {
    name: 'Jordan Patel',
    email: 'jordan.patel@example.test',
    role: UserRole.CUSTOMER,
  },
  {
    name: 'Riley Thompson',
    email: 'riley.thompson@example.test',
    role: UserRole.CUSTOMER,
  },
] as const

const policySeeds = [
  {
    policyNumber: 'CS-AUTO-1001',
    email: 'avery.brooks@example.test',
    type: PolicyType.AUTO,
    coverageAmount: '45000.00',
    premium: '118.50',
    startDate: '2025-01-01',
    endDate: '2026-12-31',
    status: PolicyStatus.ACTIVE,
  },
  {
    policyNumber: 'CS-HOME-1002',
    email: 'avery.brooks@example.test',
    type: PolicyType.HOME,
    coverageAmount: '380000.00',
    premium: '142.75',
    startDate: '2025-03-01',
    endDate: '2027-02-28',
    status: PolicyStatus.ACTIVE,
  },
  {
    policyNumber: 'CS-TRAVEL-1003',
    email: 'avery.brooks@example.test',
    type: PolicyType.TRAVEL,
    coverageAmount: '12000.00',
    premium: '34.00',
    startDate: '2024-06-01',
    endDate: '2025-05-31',
    status: PolicyStatus.EXPIRED,
  },
  {
    policyNumber: 'CS-HOME-2001',
    email: 'jordan.patel@example.test',
    type: PolicyType.HOME,
    coverageAmount: '425000.00',
    premium: '156.25',
    startDate: '2025-02-01',
    endDate: '2027-01-31',
    status: PolicyStatus.ACTIVE,
  },
  {
    policyNumber: 'CS-HEALTH-2002',
    email: 'jordan.patel@example.test',
    type: PolicyType.HEALTH,
    coverageAmount: '150000.00',
    premium: '289.90',
    startDate: '2025-01-01',
    endDate: '2026-12-31',
    status: PolicyStatus.ACTIVE,
  },
  {
    policyNumber: 'CS-AUTO-2003',
    email: 'jordan.patel@example.test',
    type: PolicyType.AUTO,
    coverageAmount: '52000.00',
    premium: '131.00',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    status: PolicyStatus.EXPIRED,
  },
  {
    policyNumber: 'CS-AUTO-3001',
    email: 'riley.thompson@example.test',
    type: PolicyType.AUTO,
    coverageAmount: '40000.00',
    premium: '109.25',
    startDate: '2025-07-01',
    endDate: '2027-06-30',
    status: PolicyStatus.ACTIVE,
  },
  {
    policyNumber: 'CS-HEALTH-3002',
    email: 'riley.thompson@example.test',
    type: PolicyType.HEALTH,
    coverageAmount: '125000.00',
    premium: '267.50',
    startDate: '2025-04-01',
    endDate: '2027-03-31',
    status: PolicyStatus.ACTIVE,
  },
  {
    policyNumber: 'CS-TRAVEL-3003',
    email: 'riley.thompson@example.test',
    type: PolicyType.TRAVEL,
    coverageAmount: '18000.00',
    premium: '42.00',
    startDate: '2025-05-01',
    endDate: '2026-10-31',
    status: PolicyStatus.ACTIVE,
  },
] as const

const claimSeeds = [
  {
    claimNumber: 'CLM-2025-0001',
    policyNumber: 'CS-AUTO-1001',
    email: 'avery.brooks@example.test',
    incidentDate: '2025-02-14',
    incidentType: 'Collision',
    description: 'Minor rear-end collision at a traffic light.',
    amount: '3850.00',
    status: ClaimStatus.PAID,
  },
  {
    claimNumber: 'CLM-2025-0002',
    policyNumber: 'CS-HOME-1002',
    email: 'avery.brooks@example.test',
    incidentDate: '2025-04-08',
    incidentType: 'Water damage',
    description: 'A supply line leak damaged the laundry room floor.',
    amount: '6200.00',
    status: ClaimStatus.APPROVED,
  },
  {
    claimNumber: 'CLM-2025-0003',
    policyNumber: 'CS-AUTO-1001',
    email: 'avery.brooks@example.test',
    incidentDate: '2025-08-21',
    incidentType: 'Windshield damage',
    description: 'Road debris caused a crack across the windshield.',
    amount: '740.00',
    status: ClaimStatus.UNDER_REVIEW,
  },
  {
    claimNumber: 'CLM-2025-0004',
    policyNumber: 'CS-TRAVEL-1003',
    email: 'avery.brooks@example.test',
    incidentDate: '2025-05-12',
    incidentType: 'Trip cancellation',
    description: 'A cancelled trip caused prepaid lodging expenses.',
    amount: '980.00',
    status: ClaimStatus.REJECTED,
  },
  {
    claimNumber: 'CLM-2025-0005',
    policyNumber: 'CS-HOME-2001',
    email: 'jordan.patel@example.test',
    incidentDate: '2025-03-19',
    incidentType: 'Storm damage',
    description: 'Hail damaged several roof shingles and a gutter.',
    amount: '8900.00',
    status: ClaimStatus.PAID,
  },
  {
    claimNumber: 'CLM-2025-0006',
    policyNumber: 'CS-HEALTH-2002',
    email: 'jordan.patel@example.test',
    incidentDate: '2025-04-03',
    incidentType: 'Outpatient care',
    description: 'Follow-up imaging and specialist visit after an injury.',
    amount: '1250.00',
    status: ClaimStatus.APPROVED,
  },
  {
    claimNumber: 'CLM-2025-0007',
    policyNumber: 'CS-AUTO-2003',
    email: 'jordan.patel@example.test',
    incidentDate: '2024-08-10',
    incidentType: 'Parking lot collision',
    description: 'A parked vehicle was struck while unattended.',
    amount: '2100.00',
    status: ClaimStatus.REJECTED,
  },
  {
    claimNumber: 'CLM-2025-0008',
    policyNumber: 'CS-HOME-2001',
    email: 'jordan.patel@example.test',
    incidentDate: '2025-09-02',
    incidentType: 'Appliance leak',
    description: 'A dishwasher leak affected the kitchen cabinet base.',
    amount: '3150.00',
    status: ClaimStatus.SUBMITTED,
  },
  {
    claimNumber: 'CLM-2025-0009',
    policyNumber: 'CS-AUTO-3001',
    email: 'riley.thompson@example.test',
    incidentDate: '2025-07-26',
    incidentType: 'Collision',
    description:
      'A low-speed intersection collision caused front bumper damage.',
    amount: '4700.00',
    status: ClaimStatus.UNDER_REVIEW,
  },
  {
    claimNumber: 'CLM-2025-0010',
    policyNumber: 'CS-HEALTH-3002',
    email: 'riley.thompson@example.test',
    incidentDate: '2025-08-15',
    incidentType: 'Emergency care',
    description: 'Emergency evaluation and treatment for a fractured wrist.',
    amount: '3800.00',
    status: ClaimStatus.PAID,
  },
  {
    claimNumber: 'CLM-2025-0011',
    policyNumber: 'CS-TRAVEL-3003',
    email: 'riley.thompson@example.test',
    incidentDate: '2025-09-11',
    incidentType: 'Baggage delay',
    description:
      'Essential items were purchased after delayed checked baggage.',
    amount: '460.00',
    status: ClaimStatus.SUBMITTED,
  },
  {
    claimNumber: 'CLM-2025-0012',
    policyNumber: 'CS-AUTO-3001',
    email: 'riley.thompson@example.test',
    incidentDate: '2025-10-01',
    incidentType: 'Roadside assistance',
    description: 'A covered breakdown required a tow to a nearby repair shop.',
    amount: '325.00',
    status: ClaimStatus.APPROVED,
  },
] as const

async function main() {
  const passwordHashes = new Map<string, string>()
  passwordHashes.set(
    userSeeds[0].email,
    await bcrypt.hash(demoAdminPassword, 12),
  )
  const customerPasswordHash = await bcrypt.hash(demoCustomerPassword, 12)

  for (const userSeed of userSeeds) {
    const passwordHash =
      passwordHashes.get(userSeed.email) ?? customerPasswordHash
    await prisma.user.upsert({
      where: { email: userSeed.email },
      update: { name: userSeed.name, passwordHash, role: userSeed.role },
      create: { ...userSeed, passwordHash },
    })
  }

  const userIds = new Map(
    (await prisma.user.findMany({ select: { id: true, email: true } })).map(
      (user) => [user.email, user.id],
    ),
  )
  const adminId = userIds.get(userSeeds[0].email)
  if (!adminId) throw new Error('Missing seeded admin user')

  const policyIds = new Map<string, string>()

  for (const policySeed of policySeeds) {
    const userId = userIds.get(policySeed.email)
    if (!userId) throw new Error(`Missing seeded user: ${policySeed.email}`)

    const policyData = {
      policyNumber: policySeed.policyNumber,
      type: policySeed.type,
      coverageAmount: policySeed.coverageAmount,
      premium: policySeed.premium,
      startDate: new Date(`${policySeed.startDate}T00:00:00.000Z`),
      endDate: new Date(`${policySeed.endDate}T00:00:00.000Z`),
      status: policySeed.status,
      userId,
    }
    const policy = await prisma.policy.upsert({
      where: { policyNumber: policySeed.policyNumber },
      update: policyData,
      create: policyData,
    })
    policyIds.set(policy.policyNumber, policy.id)
  }

  for (const claimSeed of claimSeeds) {
    const userId = userIds.get(claimSeed.email)
    const policyId = policyIds.get(claimSeed.policyNumber)
    if (!userId || !policyId)
      throw new Error(`Missing seeded claim relation: ${claimSeed.claimNumber}`)

    const claimData = {
      incidentDate: new Date(`${claimSeed.incidentDate}T00:00:00.000Z`),
      incidentType: claimSeed.incidentType,
      description: claimSeed.description,
      amount: claimSeed.amount,
      status: claimSeed.status,
      policyId,
      userId,
    }
    const claim = await prisma.claim.upsert({
      where: { claimNumber: claimSeed.claimNumber },
      update: claimData,
      create: { claimNumber: claimSeed.claimNumber, ...claimData },
    })

    const statusPath: ClaimStatus[] = {
      [ClaimStatus.SUBMITTED]: [ClaimStatus.SUBMITTED],
      [ClaimStatus.UNDER_REVIEW]: [
        ClaimStatus.SUBMITTED,
        ClaimStatus.UNDER_REVIEW,
      ],
      [ClaimStatus.APPROVED]: [
        ClaimStatus.SUBMITTED,
        ClaimStatus.UNDER_REVIEW,
        ClaimStatus.APPROVED,
      ],
      [ClaimStatus.REJECTED]: [
        ClaimStatus.SUBMITTED,
        ClaimStatus.UNDER_REVIEW,
        ClaimStatus.REJECTED,
      ],
      [ClaimStatus.PAID]: [
        ClaimStatus.SUBMITTED,
        ClaimStatus.UNDER_REVIEW,
        ClaimStatus.APPROVED,
        ClaimStatus.PAID,
      ],
    }[claimSeed.status]

    await prisma.claimStatusHistory.deleteMany({ where: { claimId: claim.id } })
    await prisma.claimStatusHistory.createMany({
      data: statusPath.map((toStatus, index) => ({
        claimId: claim.id,
        fromStatus: index === 0 ? null : statusPath[index - 1],
        toStatus,
        changedById: adminId,
        createdAt: new Date(claim.createdAt.getTime() + index * 60_000),
      })),
    })
  }

  console.log('Seeded 1 admin, 3 customers, 9 policies, and 12 claims.')
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
