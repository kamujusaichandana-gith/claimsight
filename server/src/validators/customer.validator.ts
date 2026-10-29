import { ClaimStatus } from '@prisma/client'
import { z } from 'zod'

export const createClaimSchema = z.object({
  policyId: z.string().trim().min(1),
  incidentDate: z.coerce.date().refine(
    (incidentDate) => incidentDate <= new Date(),
    'Incident date cannot be in the future',
  ),
  incidentType: z.string().trim().min(1).max(100),
  description: z.string().trim().min(20, 'Description must be at least 20 characters').max(5000),
  amount: z.number().positive().finite(),
})

export const listClaimsQuerySchema = z.object({
  status: z.nativeEnum(ClaimStatus).optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z
    .enum([
      'createdAt',
      'updatedAt',
      'incidentDate',
      'amount',
      'status',
      'claimNumber',
    ])
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
})

export type CreateClaimInput = z.infer<typeof createClaimSchema>
export type ListClaimsQuery = z.infer<typeof listClaimsQuerySchema>
