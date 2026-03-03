import api from './api'
import type { Domain } from '@/types'

export const domainsService = {
  // 获取可用域名列表（用户可见的域名，基于用户组权限）
  listUser: () =>
    api.get<Domain[]>('/user/domains'),

  // 获取所有启用的域名列表（公开接口）
  listActive: () =>
    api.get<Domain[]>('/domains'),
}
