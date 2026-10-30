import type { PipelineService } from './PipelineService'
import { MockPipelineService } from './MockPipelineService'
import { HttpPipelineService } from './HttpPipelineService'

/** The real backend is the default. VITE_USE_MOCK=true selects the in-browser mock. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export function createPipelineService(): PipelineService {
  return USE_MOCK ? new MockPipelineService() : new HttpPipelineService()
}

export type { EngineHealth, PipelineService, RunEvent } from './PipelineService'
export { ServiceError } from './PipelineService'
