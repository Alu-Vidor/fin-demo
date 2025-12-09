import type { Vector2 } from '../math/Vector2'

export type SimulationModelKey =
  | 'sfm'
  | 'rvo'
  | 'cellular'

export interface SimulationParameterSchema {
  id: string
  label: string
  min: number
  max: number
  step?: number
  defaultValue: number
  unit?: string
}

export type SimulationParameterValues = Record<string, number>

export interface Agent {
  id: string
  position: Vector2
  velocity: Vector2
  desiredVelocity?: Vector2
}

export interface SimulationMetadata {
  title: string
  description?: string
  parameters: SimulationParameterSchema[]
}
