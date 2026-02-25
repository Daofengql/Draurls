import api from './api'
import type { Domain } from '@/types'

export const domainsService = {
  // 获取可用域名列表
  listActive: () =>
    api.get<Domain[]>('/domains'),
}
