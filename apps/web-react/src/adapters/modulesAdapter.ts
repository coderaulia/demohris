import {
  ModuleActiveResponseSchema,
  ModuleByCategoryResponseSchema,
  ModuleGetResponseSchema,
  ModuleListResponseSchema,
} from '@demo-kpi/contracts'

import { transport } from './transport'

export const modulesAdapter = {
  list() {
    return transport.execute({
      domain: 'modules',
      action: 'list',
      method: 'POST',
      payload: {},
      schema: ModuleListResponseSchema,
    })
  },

  get(module_id: string) {
    return transport.execute({
      domain: 'modules',
      action: 'get',
      method: 'POST',
      payload: { module_id },
      schema: ModuleGetResponseSchema,
    })
  },

  byCategory(category: string) {
    return transport.execute({
      domain: 'modules',
      action: 'by-category',
      method: 'POST',
      payload: { category },
      schema: ModuleByCategoryResponseSchema,
    })
  },

  active() {
    return transport.execute({
      domain: 'modules',
      action: 'active',
      method: 'POST',
      payload: {},
      schema: ModuleActiveResponseSchema,
    })
  },
}

