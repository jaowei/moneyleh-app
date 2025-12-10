import z from "zod";

export const paginationZ = z.object({
    limit: z.number().gte(0).default(100),
    offset: z.number().gte(0).default(0)
})

export const refineAccountOrCardId = (data: {
    cardId?: number | null,
    accountId?: number | null
}): boolean =>
    !(data.cardId && data.accountId) && !(!data.cardId && !data.accountId)
