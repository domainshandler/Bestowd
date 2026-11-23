import type { FastifyInstance } from 'fastify'
import { requireMember, userIdOf } from '../services/access.js'
import { SUGGEST_FIELDS, suggest, type SuggestField } from '../suggest/suggest.js'

export async function suggestRoutes(app: FastifyInstance) {
  // Autofill for the idea and gift forms: GET /groups/:id/suggest?field=brand&q=gar
  app.get<{ Params: { groupId: string }; Querystring: { field: SuggestField; q: string } }>('/groups/:groupId/suggest', {
    preHandler: app.authenticate,
    schema: {
      querystring: {
        type: 'object',
        required: ['field', 'q'],
        properties: { field: { type: 'string', enum: [...SUGGEST_FIELDS] }, q: { type: 'string', maxLength: 100 } },
      },
    },
  }, async (request) => {
    const { groupId } = request.params
    await requireMember(userIdOf(request), groupId)
    return { suggestions: await suggest(groupId, request.query.field, request.query.q) }
  })
}
