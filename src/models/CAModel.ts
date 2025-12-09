import type { SimulationParameterValues } from '../types/simulation'
import { SimulationModel } from './SimulationModel'

interface GridCell {
  x: number
  y: number
}

interface CAAgent {
  id: string
  cell: GridCell
  anchors: [GridCell, GridCell]
  targetIndex: 0 | 1
  color: string
  stuckSteps: number
}

const DEFAULT_CELL_SIZE = 24
const DEFAULT_RATE = 1.25
const BASE_STEP_SECONDS = 0.35

const NEIGHBOR_OFFSETS: GridCell[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
]

const FLOW_COLORS = {
  horizontalA: '#f97316',
  horizontalB: '#22d3ee',
  verticalA: '#a855f7',
  verticalB: '#22c55e',
}

/**
 * Simple cellular automata crowd model on a Moore neighborhood grid.
 * Agents occupy discrete cells and move in jumps to the neighboring cell
 * that most reduces the distance to their current goal.
 */
export class CAModel extends SimulationModel {
  private cellSize = DEFAULT_CELL_SIZE
  private cols = 0
  private rows = 0
  private originX = 0
  private originY = 0
  private agents: CAAgent[] = []
  private grid: (string | null)[][] = []
  private accumulator = 0

  constructor(initialParams: SimulationParameterValues) {
    super(initialParams)
  }

  update(deltaTime: number): void {
    if (deltaTime <= 0 || this.agents.length === 0) {
      return
    }

    const rate = this.resolveUpdateRate()
    const stepInterval = BASE_STEP_SECONDS / rate
    this.accumulator += Math.min(deltaTime, 0.5)

    while (this.accumulator >= stepInterval) {
      this.advanceAutomata()
      this.accumulator -= stepInterval
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.fillStyle = '#020617'
    ctx.fillRect(0, 0, this.width, this.height)

    if (this.cols === 0 || this.rows === 0) {
      ctx.restore()
      return
    }

    const gridWidth = this.cols * this.cellSize
    const gridHeight = this.rows * this.cellSize

    ctx.fillStyle = '#0f172a'
    ctx.fillRect(this.originX, this.originY, gridWidth, gridHeight)

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'
    ctx.lineWidth = 1
    for (let c = 0; c <= this.cols; c += 1) {
      const x = this.originX + c * this.cellSize
      ctx.beginPath()
      ctx.moveTo(x, this.originY)
      ctx.lineTo(x, this.originY + gridHeight)
      ctx.stroke()
    }
    for (let r = 0; r <= this.rows; r += 1) {
      const y = this.originY + r * this.cellSize
      ctx.beginPath()
      ctx.moveTo(this.originX, y)
      ctx.lineTo(this.originX + gridWidth, y)
      ctx.stroke()
    }

    const agentSize = this.cellSize * 0.7
    this.agents.forEach((agent) => {
      const center = this.cellToWorld(agent.cell)
      const halfSize = agentSize / 2

      ctx.fillStyle = agent.color
      ctx.fillRect(
        center.x - halfSize,
        center.y - halfSize,
        agentSize,
        agentSize,
      )

      ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)'
      ctx.strokeRect(
        center.x - halfSize,
        center.y - halfSize,
        agentSize,
        agentSize,
      )

      ctx.fillStyle = 'rgba(248, 250, 252, 0.4)'
      const inset = agentSize * 0.15
      ctx.fillRect(
        center.x - inset,
        center.y - inset,
        inset * 2,
        inset * 2,
      )
    })

    ctx.restore()
  }

  reset(): void {
    this.accumulator = 0
    this.rebuildDomain(true)
  }

  protected override onResize(width: number, height: number): void {
    void width
    void height
    this.rebuildDomain(true)
  }

  protected override onParamsUpdate(): void {
    const nextCell = this.resolveCellSize()
    if (nextCell !== this.cellSize) {
      this.rebuildDomain(true)
    }
  }

  private rebuildDomain(forceReseed: boolean): void {
    if (this.width === 0 || this.height === 0) {
      this.cols = 0
      this.rows = 0
      this.agents = []
      this.grid = []
      return
    }

    const nextCellSize = this.resolveCellSize()
    const nextCols = Math.max(4, Math.floor(this.width / nextCellSize))
    const nextRows = Math.max(4, Math.floor(this.height / nextCellSize))
    const changed =
      forceReseed ||
      nextCellSize !== this.cellSize ||
      nextCols !== this.cols ||
      nextRows !== this.rows ||
      this.agents.length === 0

    this.cellSize = nextCellSize
    this.cols = nextCols
    this.rows = nextRows

    const gridWidth = this.cols * this.cellSize
    const gridHeight = this.rows * this.cellSize
    this.originX = (this.width - gridWidth) / 2
    this.originY = (this.height - gridHeight) / 2
    this.grid = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => null),
    )

    if (changed) {
      this.seedAgents()
      return
    }

    this.agents.forEach((agent) => {
      if (this.isInside(agent.cell.x, agent.cell.y)) {
        this.grid[agent.cell.y][agent.cell.x] = agent.id
      }
    })
  }

  private seedAgents(): void {
    if (this.cols === 0 || this.rows === 0) {
      this.agents = []
      return
    }

    const scenarios: Array<{ anchors: [GridCell, GridCell]; color: string }> =
      []

    for (let y = 1; y < this.rows - 1; y += 2) {
      scenarios.push({
        anchors: [
          { x: 1, y },
          { x: this.cols - 2, y },
        ],
        color: FLOW_COLORS.horizontalA,
      })
      scenarios.push({
        anchors: [
          { x: this.cols - 2, y },
          { x: 1, y },
        ],
        color: FLOW_COLORS.horizontalB,
      })
    }

    for (let x = 2; x < this.cols - 2; x += 2) {
      scenarios.push({
        anchors: [
          { x, y: 1 },
          { x, y: this.rows - 2 },
        ],
        color: FLOW_COLORS.verticalA,
      })
      scenarios.push({
        anchors: [
          { x, y: this.rows - 2 },
          { x, y: 1 },
        ],
        color: FLOW_COLORS.verticalB,
      })
    }

    const maxAgents = Math.min(
      scenarios.length,
      Math.floor(this.cols * this.rows * 0.25),
    )
    const pool = this.shuffle(scenarios).slice(0, maxAgents)

    this.agents = pool.map((template, index) => ({
      id: `ca-${index}`,
      cell: { ...template.anchors[0] },
      anchors: template.anchors,
      targetIndex: 1,
      color: template.color,
      stuckSteps: 0,
    }))

    this.grid.forEach((row) => row.fill(null))
    this.agents.forEach((agent) => {
      const { x, y } = agent.cell
      if (this.isInside(x, y)) {
        this.grid[y][x] = agent.id
      }
    })
  }

  private advanceAutomata(): void {
    if (this.agents.length === 0) {
      return
    }

    const order = this.shuffle(
      this.agents.map((_, index) => index),
    )

    for (const index of order) {
      const agent = this.agents[index]
      const target = agent.anchors[agent.targetIndex]

      const currentDistance = this.cellDistance(agent.cell, target)
      let bestCell = agent.cell
      let bestDistance = currentDistance
      const allowDrift = agent.stuckSteps >= 4

      for (const neighbor of this.getNeighbors(agent.cell)) {
        if (!this.isInside(neighbor.x, neighbor.y)) continue
        if (this.grid[neighbor.y][neighbor.x] !== null) continue

        const distance = this.cellDistance(neighbor, target)
        if (distance + 1e-3 < bestDistance || (allowDrift && distance <= bestDistance + 1e-3)) {
          bestCell = neighbor
          bestDistance = distance
        }
      }

      const moved =
        agent.cell.x !== bestCell.x || agent.cell.y !== bestCell.y

      if (moved) {
        this.grid[agent.cell.y][agent.cell.x] = null
        agent.cell = bestCell
        this.grid[bestCell.y][bestCell.x] = agent.id
        agent.stuckSteps = 0
      } else {
        agent.stuckSteps += 1
      }

      if (agent.cell.x === target.x && agent.cell.y === target.y) {
        agent.targetIndex = agent.targetIndex === 0 ? 1 : 0
        agent.stuckSteps = 0
      }
    }
  }

  private getNeighbors(cell: GridCell): GridCell[] {
    return NEIGHBOR_OFFSETS.map((offset) => ({
      x: cell.x + offset.x,
      y: cell.y + offset.y,
    }))
  }

  private cellToWorld(cell: GridCell): { x: number; y: number } {
    return {
      x: this.originX + cell.x * this.cellSize + this.cellSize / 2,
      y: this.originY + cell.y * this.cellSize + this.cellSize / 2,
    }
  }

  private cellDistance(a: GridCell, b: GridCell): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.hypot(dx, dy)
  }

  private resolveCellSize(): number {
    const requested = this.params.cellSize ?? DEFAULT_CELL_SIZE
    const clamped = Math.max(10, Math.min(60, requested))
    return Math.round(clamped)
  }

  private resolveUpdateRate(): number {
    const requested = this.params.updateRate ?? DEFAULT_RATE
    return Math.max(0.25, Math.min(6, requested))
  }

  private isInside(x: number, y: number): boolean {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows
  }

  private shuffle<T>(source: T[]): T[] {
    const array = [...source]
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }
}
