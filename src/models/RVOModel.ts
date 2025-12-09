import { Vector2 } from '../math/Vector2'
import type { SimulationParameterValues } from '../types/simulation'
import { SimulationModel } from './SimulationModel'

interface OrcaLine {
  point: Vector2
  direction: Vector2
}

interface NeighborRef {
  index: number
  distSq: number
}

interface RVOAgent {
  id: string
  position: Vector2
  velocity: Vector2
  preferredVelocity: Vector2
  radius: number
  preferredSpeed: number
  maxSpeed: number
  anchors: [Vector2, Vector2]
  headingIndex: 0 | 1
  color: string
}

const DEFAULTS = {
  neighborRadius: 4,
  timeHorizon: 2.5,
  agentCount: 32,
}

const EPSILON = 1e-5

const absSq = (v: Vector2) => v.x * v.x + v.y * v.y
const det = (a: Vector2, b: Vector2) => a.x * b.y - a.y * b.x
const perp = (v: Vector2) => new Vector2(-v.y, v.x)
const ensureDirection = (dir: Vector2) =>
  absSq(dir) <= EPSILON ? new Vector2(1, 0) : dir.normalize()

/**
 * Reciprocal Velocity Obstacles (ORCA) crowd model.
 * Agents pick new velocities by solving the half-plane intersection defined
 * by surrounding agents, guaranteeing collision-free motion.
 */
export class RVOModel extends SimulationModel {
  private agents: RVOAgent[] = []
  private readonly pixelsPerMeter = 55
  private readonly maxNeighbors = 10
  private readonly agentRadiusMeters = 0.28

  constructor(initialParams: SimulationParameterValues) {
    super(initialParams)
  }

  update(deltaTime: number): void {
    if (deltaTime <= 0 || this.agents.length === 0) {
      return
    }

    const dt = Math.min(deltaTime, 0.05)
    const prefNeighborRadius =
      (this.params.neighborRadius ?? DEFAULTS.neighborRadius) *
      this.pixelsPerMeter
    const neighborRadiusSq = prefNeighborRadius * prefNeighborRadius
    const timeHorizon = Math.max(
      this.params.timeHorizon ?? DEFAULTS.timeHorizon,
      0.2,
    )
    const invTimeHorizon = 1 / timeHorizon

    this.agents.forEach((agent) => this.swapGoalIfNeeded(agent))
    const neighborTable = this.buildNeighborTable(neighborRadiusSq)

    const newVelocities = this.agents.map((agent, index) => {
      const preferred = this.computePreferredVelocity(agent)
      agent.preferredVelocity = preferred

      const lines: OrcaLine[] = []
      const neighbors = neighborTable[index]
      for (let n = 0; n < neighbors.length; n += 1) {
        const other = this.agents[neighbors[n].index]
        this.appendAgentConstraint(
          agent,
          other,
          lines,
          invTimeHorizon,
          dt,
        )
      }

      const solved = this.linearProgram2(lines, agent.maxSpeed, preferred, false)
      if (solved.lineFail < lines.length) {
        const adjusted = this.linearProgram3(
          lines,
          0,
          solved.lineFail,
          agent.maxSpeed,
          solved.result,
        )
        return adjusted.limit(agent.maxSpeed)
      }
      return solved.result.limit(agent.maxSpeed)
    })

    this.agents.forEach((agent, index) => {
      const velocity = newVelocities[index]
      agent.velocity = velocity
      agent.position = agent.position.add(velocity.mult(dt))
    })
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.fillStyle = '#030712'
    ctx.fillRect(0, 0, this.width, this.height)

    const center = new Vector2(this.width / 2, this.height / 2)
    const circleRadius = Math.min(this.width, this.height) * 0.35
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.15)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(center.x, center.y, circleRadius, 0, Math.PI * 2)
    ctx.stroke()

    this.agents.forEach((agent) => {
      ctx.fillStyle = agent.color
      ctx.beginPath()
      ctx.arc(agent.position.x, agent.position.y, agent.radius, 0, Math.PI * 2)
      ctx.fill()

      const vel = agent.velocity
      if (absSq(vel) > 1) {
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.8)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(agent.position.x, agent.position.y)
        ctx.lineTo(
          agent.position.x + vel.x * 0.12,
          agent.position.y + vel.y * 0.12,
        )
        ctx.stroke()
      }
    })

    ctx.restore()
  }

  reset(): void {
    this.createCircleScenario()
  }

  protected override onResize(width: number, height: number): void {
    void width
    void height
    this.createCircleScenario()
  }

  private createCircleScenario(): void {
    if (this.width === 0 || this.height === 0) {
      this.agents = []
      return
    }

    const count = DEFAULTS.agentCount
    const center = new Vector2(this.width / 2, this.height / 2)
    const radius = Math.min(this.width, this.height) * 0.35
    const agentRadius = this.agentRadiusMeters * this.pixelsPerMeter

    this.agents = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2
      const dir = new Vector2(Math.cos(angle), Math.sin(angle))
      const opposite = dir.mult(-1)

      const anchorA = center.add(dir.mult(radius))
      const anchorB = center.add(opposite.mult(radius))
      const preferredSpeed =
        (1.2 + Math.random() * 0.6) * this.pixelsPerMeter

      return {
        id: `rvo-${i}`,
        position: anchorA,
        velocity: Vector2.zero(),
        preferredVelocity: Vector2.zero(),
        radius: agentRadius,
        preferredSpeed,
        maxSpeed: preferredSpeed * 1.25,
        anchors: [anchorA, anchorB],
        headingIndex: 1,
        color: `hsl(${180 + i * 5}, 70%, 60%)`,
      }
    })
  }

  private computePreferredVelocity(agent: RVOAgent): Vector2 {
    const target = agent.anchors[agent.headingIndex]
    const toGoal = target.sub(agent.position)
    const distance = toGoal.mag()
    if (distance < 1) {
      return Vector2.zero()
    }
    return toGoal
      .mult(1 / distance)
      .mult(agent.preferredSpeed)
      .limit(agent.maxSpeed)
  }

  private swapGoalIfNeeded(agent: RVOAgent): void {
    const target = agent.anchors[agent.headingIndex]
    if (agent.position.dist(target) < Math.max(agent.radius * 0.8, 6)) {
      agent.headingIndex = agent.headingIndex === 0 ? 1 : 0
    }
  }

  private buildNeighborTable(radiusSq: number): NeighborRef[][] {
    const table: NeighborRef[][] = Array.from(
      { length: this.agents.length },
      () => [],
    )
    for (let i = 0; i < this.agents.length; i += 1) {
      for (let j = i + 1; j < this.agents.length; j += 1) {
        const distSq = absSq(
          this.agents[i].position.sub(this.agents[j].position),
        )
        if (distSq > radiusSq) continue
        this.insertNeighbor(table[i], { index: j, distSq })
        this.insertNeighbor(table[j], { index: i, distSq })
      }
    }
    return table
  }

  private insertNeighbor(list: NeighborRef[], neighbor: NeighborRef) {
    list.push(neighbor)
    list.sort((a, b) => a.distSq - b.distSq)
    if (list.length > this.maxNeighbors) {
      list.pop()
    }
  }

  private appendAgentConstraint(
    agent: RVOAgent,
    other: RVOAgent,
    lines: OrcaLine[],
    invTimeHorizon: number,
    dt: number,
  ): void {
    const relativePosition = other.position.sub(agent.position)
    const relativeVelocity = agent.velocity.sub(other.velocity)
    const distSq = absSq(relativePosition)
    const combinedRadius = agent.radius + other.radius
    const combinedRadiusSq = combinedRadius * combinedRadius

    let direction = Vector2.zero()
    let u = Vector2.zero()

    if (distSq > combinedRadiusSq) {
      const w = relativeVelocity.sub(relativePosition.mult(invTimeHorizon))
      const wLengthSq = absSq(w)
      const dotProduct = w.dot(relativePosition)

      if (dotProduct < 0 && dotProduct * dotProduct > combinedRadiusSq * wLengthSq) {
        const wLength = Math.sqrt(wLengthSq)
        const unitW =
          wLength > EPSILON ? w.mult(1 / wLength) : relativePosition.normalize()
        direction = perp(unitW)
        u = unitW.mult(combinedRadius * invTimeHorizon - wLength)
      } else {
        const leg = Math.sqrt(Math.max(0, distSq - combinedRadiusSq))
        if (det(relativePosition, w) > 0) {
          direction = new Vector2(
            relativePosition.x * leg - relativePosition.y * combinedRadius,
            relativePosition.x * combinedRadius + relativePosition.y * leg,
          ).mult(1 / distSq)
        } else {
          direction = new Vector2(
            -relativePosition.x * leg - relativePosition.y * combinedRadius,
            relativePosition.x * combinedRadius - relativePosition.y * leg,
          ).mult(1 / distSq)
        }
        direction = direction.normalize()
        u = direction.mult(relativeVelocity.dot(direction)).sub(relativeVelocity)
      }
    } else {
      const invTimeStep = dt > 0 ? 1 / dt : 0
      const w = relativeVelocity.sub(relativePosition.mult(invTimeStep))
      const wLength = Math.hypot(w.x, w.y)
      const unitW =
        wLength > EPSILON ? w.mult(1 / wLength) : relativePosition.normalize()
      direction = perp(unitW)
      u = unitW.mult(combinedRadius * invTimeStep - wLength)
    }

    lines.push({
      point: agent.velocity.add(u.mult(0.5)),
      direction: ensureDirection(direction),
    })
  }

  private linearProgram1(
    lines: OrcaLine[],
    lineNo: number,
    radius: number,
    optVelocity: Vector2,
    directionOpt: boolean,
    result: Vector2,
  ): { success: boolean; result: Vector2 } {
    const line = lines[lineNo]
    const dotProduct = line.point.dot(line.direction)
    const discriminant =
      dotProduct * dotProduct + radius * radius - absSq(line.point)

    if (discriminant < 0) {
      return { success: false, result }
    }

    const sqrtDisc = Math.sqrt(discriminant)
    let tLeft = -dotProduct - sqrtDisc
    let tRight = -dotProduct + sqrtDisc

    for (let i = 0; i < lineNo; i += 1) {
      const denominator = det(line.direction, lines[i].direction)
      const numerator = det(
        lines[i].direction,
        line.point.sub(lines[i].point),
      )

      if (Math.abs(denominator) <= EPSILON) {
        if (numerator < 0) {
          return { success: false, result }
        }
        continue
      }

      const t = numerator / denominator
      if (denominator >= 0) {
        tRight = Math.min(tRight, t)
      } else {
        tLeft = Math.max(tLeft, t)
      }

      if (tLeft > tRight) {
        return { success: false, result }
      }
    }

    if (directionOpt) {
      if (optVelocity.dot(line.direction) > 0) {
        result = line.point.add(line.direction.mult(tRight))
      } else {
        result = line.point.add(line.direction.mult(tLeft))
      }
    } else {
      const t = line.direction.dot(optVelocity.sub(line.point))
      if (t < tLeft) {
        result = line.point.add(line.direction.mult(tLeft))
      } else if (t > tRight) {
        result = line.point.add(line.direction.mult(tRight))
      } else {
        result = line.point.add(line.direction.mult(t))
      }
    }

    return { success: true, result }
  }

  private linearProgram2(
    lines: OrcaLine[],
    radius: number,
    optVelocity: Vector2,
    directionOpt: boolean,
  ): { lineFail: number; result: Vector2 } {
    let result: Vector2
    if (directionOpt) {
      result = optVelocity.mult(radius)
    } else if (absSq(optVelocity) > radius * radius) {
      result = optVelocity.normalize().mult(radius)
    } else {
      result = optVelocity
    }

    for (let i = 0; i < lines.length; i += 1) {
      if (det(lines[i].direction, lines[i].point.sub(result)) > 0) {
        const tempResult = result
        const solved = this.linearProgram1(
          lines,
          i,
          radius,
          optVelocity,
          directionOpt,
          result,
        )
        result = solved.result
        if (!solved.success) {
          return { lineFail: i, result: tempResult }
        }
      }
    }

    return { lineFail: lines.length, result }
  }

  private linearProgram3(
    lines: OrcaLine[],
    numObstLines: number,
    beginLine: number,
    radius: number,
    initialResult: Vector2,
  ): Vector2 {
    let result = initialResult
    let distance = 0

    for (let i = beginLine; i < lines.length; i += 1) {
      const line = lines[i]
      const detValue = det(line.direction, line.point.sub(result))
      if (detValue > distance) {
        const projLines: OrcaLine[] = lines
          .slice(0, numObstLines)
          .map((l) => ({ point: l.point, direction: l.direction }))

        for (let j = numObstLines; j < i; j += 1) {
          const other = lines[j]
          const determinant = det(line.direction, other.direction)
          let point: Vector2

          if (Math.abs(determinant) <= EPSILON) {
            if (line.direction.dot(other.direction) > 0) {
              continue
            }
            point = line.point.add(other.point).mult(0.5)
          } else {
            point = line.point.add(
              line.direction.mult(
                det(
                  other.direction,
                  line.point.sub(other.point),
                ) / determinant,
              ),
            )
          }

          const direction = other.direction.sub(line.direction).normalize()
          projLines.push({ point, direction })
        }

        const tempResult = result
        const lp2 = this.linearProgram2(
          projLines,
          radius,
          perp(line.direction),
          true,
        )
        result = lp2.result

        if (lp2.lineFail < projLines.length) {
          result = tempResult
        }

        distance = det(line.direction, line.point.sub(result))
      }
    }

    return result
  }
}
