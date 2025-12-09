import type { SimulationParameterValues } from '../types/simulation'

/**
 * Abstract base class for every simulation. Concrete implementations
 * provide the update/draw logic while the host app handles lifecycle wiring.
 */
export abstract class SimulationModel {
  protected width = 0
  protected height = 0
  protected params: SimulationParameterValues

  constructor(initialParams: SimulationParameterValues = {}) {
    this.params = { ...initialParams }
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.onResize(width, height)
  }

  configure(nextParams: SimulationParameterValues) {
    this.params = { ...this.params, ...nextParams }
    this.onParamsUpdate()
  }

  abstract update(deltaTime: number): void
  abstract draw(ctx: CanvasRenderingContext2D): void
  abstract reset(): void

  protected onParamsUpdate(): void {
    // Optional hook for subclasses.
  }

  protected onResize(width: number, height: number): void {
    void width
    void height
    // Optional hook for subclasses.
  }
}
