import api from './api'
import type { APIKey } from '@/types'

export const apiKeysService = {
  list: () =>
    api.get<APIKey[]>('/apikeys'),

  create: (data: { name: string }) =>
    api.post<{ key: string }>('/apikeys', data),

  delete: (id: number) =>
    api.delete<void>(`/apikeys/${id}`),
}
