import { Vector2 } from '../math/Vector2'
import type { Agent, SimulationModelKey } from '../types/simulation'
import type { SimulationParameterValues } from '../types/simulation'
import { SimulationModel } from './SimulationModel'

const COLOR_MAP: Record<SimulationModelKey, string> = {
  sfm: '#2563eb',
  rvo: '#16a34a',
  cellular: '#f97316',
}

const PARAM_FALLBACKS: Record<string, number> = {
  desiredSpeed: 1,
  interactionStrength: 1,
  neighborRadius: 1.5,
  timeHorizon: 1,
  cellSize: 20,
  updateRate: 1,
}

export class PlaceholderSimulation extends SimulationModel {
  private readonly variant: SimulationModelKey
  private agents: Agent[] = []
  private frame = 0

  constructor(variant: SimulationModelKey, params: SimulationParameterValues) {
    super(params)
    this.variant = variant
    this.seedAgents()
  }

  update(deltaTime: number): void {
    this.frame += deltaTime
    const speedFactor = this.getSpeedFactor()

    this.agents = this.agents.map((agent, index) => {
      const angle = this.frame * speedFactor + index * 0.35
      const radius = (Math.sin(this.frame * 0.5 + index) + 1.5) * 40
      const center = new Vector2(this.width / 2, this.height / 2)

      const velocity = new Vector2(Math.cos(angle), Math.sin(angle)).mult(
        speedFactor * 40,
      )
      const position = center.add(
        new Vector2(
          Math.cos(angle) * (radius + index * 2),
          Math.sin(angle) * (radius + index * 2),
        ),
      )

      return {
        ...agent,
        position,
        velocity,
      }
    })
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.translate(this.width / 2, this.height / 2)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
    ctx.lineWidth = 1
    for (let r = 40; r < Math.min(this.width, this.height) / 1.5; r += 40) {
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.translate(-this.width / 2, -this.height / 2)

    ctx.fillStyle = COLOR_MAP[this.variant]
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 2

    this.agents.forEach((agent) => {
      const { x, y } = agent.position
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + agent.velocity.x * 0.05, y + agent.velocity.y * 0.05)
      ctx.stroke()
    })
    ctx.restore()
  }

  reset(): void {
    this.frame = 0
    this.seedAgents()
  }

  protected override onParamsUpdate(): void {
    // Nothing fancy yet, but we can react to parameter changes here.
  }

  private getSpeedFactor(): number {
    switch (this.variant) {
      case 'sfm':
        return this.params.desiredSpeed ?? PARAM_FALLBACKS.desiredSpeed
      case 'rvo':
        return (
          (this.params.neighborRadius ?? PARAM_FALLBACKS.neighborRadius) * 0.8
        )
      case 'cellular':
        return this.params.updateRate ?? PARAM_FALLBACKS.updateRate
      default:
        return 1
    }
  }

  private seedAgents() {
    const count = 24
    this.agents = Array.from({ length: count }).map((_, index) => ({
      id: `${this.variant}-${index}`,
      position: Vector2.zero(),
      velocity: Vector2.zero(),
    }))
  }
}
