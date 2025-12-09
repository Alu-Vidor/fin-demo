import { Vector2 } from '../math/Vector2'
import type { SimulationParameterValues } from '../types/simulation'
import { SimulationModel } from './SimulationModel'

type FlowDirection = 'left' | 'right'

interface SocialForceAgent {
  id: string
  group: FlowDirection
  position: Vector2
  velocity: Vector2
  target: Vector2
  laneY: number
  speedFactor: number
  radius: number
  mass: number
}

const DEFAULT_PARAMS = {
  desiredSpeed: 1.5,
  relaxationTime: 0.6,
  repulsionStrengthA: 5,
}

/**
 * Social Force Model implementation following Helbing's formulation.
 * Agents experience a driving force towards their goal and pairwise
 * exponential repulsion augmented with a stiff body compression term.
 */
export class SocialForceModel extends SimulationModel {
  private agents: SocialForceAgent[] = []
  private readonly pixelsPerMeter = 45
  private readonly agentsPerGroup = 20
  private readonly personalSpace: number
  private readonly bodyStiffness = 2200
  private readonly maxSpeed: number
  private readonly walkwayPadding = 80
  private readonly spawnMargin = 120

  constructor(initialParams: SimulationParameterValues) {
    super(initialParams)
    this.personalSpace = 0.45 * this.pixelsPerMeter
    this.maxSpeed = 4.5 * this.pixelsPerMeter
  }

  update(deltaTime: number): void {
    if (deltaTime <= 0 || this.agents.length === 0) {
      return
    }

    const dt = Math.min(deltaTime, 0.05)
    const relaxationTime =
      this.params.relaxationTime ?? DEFAULT_PARAMS.relaxationTime
    const desiredSpeedMeters =
      this.params.desiredSpeed ?? DEFAULT_PARAMS.desiredSpeed
    const repulsionStrength =
      (this.params.repulsionStrengthA ?? DEFAULT_PARAMS.repulsionStrengthA) *
      this.pixelsPerMeter

    const nextAgents = this.agents.map((agent, index) => {
      const desiredSpeed =
        desiredSpeedMeters * agent.speedFactor * this.pixelsPerMeter
      const desiredDirection = agent.target.sub(agent.position).normalize()
      const desiredVelocity = desiredDirection.mult(desiredSpeed)
      const drivingForce = desiredVelocity
        .sub(agent.velocity)
        .mult(agent.mass / Math.max(relaxationTime, 0.01))

      let forceAccumulator = drivingForce

      for (let j = 0; j < this.agents.length; j += 1) {
        if (j === index) continue
        const other = this.agents[j]
        const direction = agent.position.sub(other.position)
        const distance = direction.mag() || 1e-5
        const normal = direction.mult(1 / distance)
        const combinedRadius = agent.radius + other.radius

        const magnitude =
          repulsionStrength *
          Math.exp((combinedRadius - distance) / this.personalSpace)
        forceAccumulator = forceAccumulator.add(normal.mult(magnitude))

        if (distance < combinedRadius) {
          const compression = this.bodyStiffness * (combinedRadius - distance)
          forceAccumulator = forceAccumulator.add(normal.mult(compression))
        }
      }

      const acceleration = forceAccumulator.mult(1 / agent.mass)
      const nextVelocity = agent.velocity
        .add(acceleration.mult(dt))
        .limit(this.maxSpeed)
      let nextPosition = agent.position.add(nextVelocity.mult(dt))
      nextPosition = this.keepInsideWalkway(nextPosition, agent.radius)

      const updatedAgent = {
        ...agent,
        velocity: nextVelocity,
        position: nextPosition,
      }
      return this.recycleIfNeeded(updatedAgent)
    })

    this.agents = nextAgents
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.fillStyle = '#020617'
    ctx.fillRect(0, 0, this.width, this.height)

    const walkwayTop = this.walkwayPadding
    const walkwayBottom = this.height - this.walkwayPadding
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, walkwayTop, this.width, walkwayBottom - walkwayTop)

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)'
    ctx.setLineDash([10, 10])
    ctx.beginPath()
    ctx.moveTo(0, this.height / 2)
    ctx.lineTo(this.width, this.height / 2)
    ctx.stroke()
    ctx.setLineDash([])

    this.agents.forEach((agent) => {
      ctx.fillStyle = agent.group === 'left' ? '#2563eb' : '#f43f5e'
      ctx.beginPath()
      ctx.arc(agent.position.x, agent.position.y, agent.radius, 0, Math.PI * 2)
      ctx.fill()

      const velocityDir = agent.velocity
      if (velocityDir.mag() > 1) {
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.5)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(agent.position.x, agent.position.y)
        ctx.lineTo(
          agent.position.x + velocityDir.x * 0.05,
          agent.position.y + velocityDir.y * 0.05,
        )
        ctx.stroke()
      }
    })
    ctx.restore()
  }

  reset(): void {
    this.createWallCrossingScenario()
  }

  protected override onResize(width: number, height: number): void {
    void width
    void height
    this.createWallCrossingScenario()
  }

  protected override onParamsUpdate(): void {
    // Parameters are sampled directly during integration, so nothing to do here yet.
  }

  private createWallCrossingScenario() {
    if (this.width === 0 || this.height === 0) {
      this.agents = []
      return
    }

    const agents: SocialForceAgent[] = []
    for (let i = 0; i < this.agentsPerGroup; i += 1) {
      agents.push(this.spawnAgent('left', `L-${i}`))
    }
    for (let i = 0; i < this.agentsPerGroup; i += 1) {
      agents.push(this.spawnAgent('right', `R-${i}`))
    }
    this.agents = agents
  }

  private spawnAgent(group: FlowDirection, id: string): SocialForceAgent {
    const laneY = this.randomLaneY()
    const spawnX = group === 'left' ? this.spawnMargin : this.width - this.spawnMargin
    const targetX = group === 'left' ? this.width - this.spawnMargin : this.spawnMargin
    const radius = 0.28 * this.pixelsPerMeter * (0.9 + Math.random() * 0.2)

    return {
      id,
      group,
      laneY,
      position: new Vector2(
        spawnX + (Math.random() - 0.5) * radius * 1.5,
        laneY + (Math.random() - 0.5) * radius,
      ),
      velocity: Vector2.zero(),
      target: new Vector2(targetX, laneY),
      speedFactor: 0.9 + Math.random() * 0.25,
      radius,
      mass: 70 + Math.random() * 15,
    }
  }

  private randomLaneY(): number {
    const minY = this.walkwayPadding
    const maxY = this.height - this.walkwayPadding
    return minY + Math.random() * (maxY - minY)
  }

  private keepInsideWalkway(position: Vector2, radius: number): Vector2 {
    const clampedY = Math.min(
      this.height - this.walkwayPadding - radius,
      Math.max(this.walkwayPadding + radius, position.y),
    )
    const clampedX = Math.min(this.width - radius, Math.max(radius, position.x))
    if (clampedX === position.x && clampedY === position.y) {
      return position
    }
    return new Vector2(clampedX, clampedY)
  }

  private recycleIfNeeded(agent: SocialForceAgent): SocialForceAgent {
    const distanceToTarget = agent.position.dist(agent.target)
    if (distanceToTarget > agent.radius * 1.5) {
      return agent
    }
    return {
      ...this.spawnAgent(agent.group, agent.id),
    }
  }
}
