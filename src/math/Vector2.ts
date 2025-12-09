/**
 * Lightweight 2D vector helper used by simulation models.
 * Methods are immutable and return new instances to keep math predictable.
 */
export class Vector2 {
  public readonly x: number
  public readonly y: number

  constructor(x = 0, y = 0) {
    this.x = x
    this.y = y
  }

  static zero(): Vector2 {
    return new Vector2(0, 0)
  }

  static from(value: { x: number; y: number } | [number, number]): Vector2 {
    if (Array.isArray(value)) {
      return new Vector2(value[0], value[1])
    }

    return new Vector2(value.x, value.y)
  }

  add(vector: Vector2): Vector2 {
    return new Vector2(this.x + vector.x, this.y + vector.y)
  }

  sub(vector: Vector2): Vector2 {
    return new Vector2(this.x - vector.x, this.y - vector.y)
  }

  mult(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar)
  }

  mag(): number {
    return Math.hypot(this.x, this.y)
  }

  normalize(): Vector2 {
    const magnitude = this.mag()
    if (magnitude === 0) {
      return Vector2.zero()
    }
    return this.mult(1 / magnitude)
  }

  dist(vector: Vector2): number {
    return this.sub(vector).mag()
  }

  dot(vector: Vector2): number {
    return this.x * vector.x + this.y * vector.y
  }

  limit(max: number): Vector2 {
    const magnitude = this.mag()
    if (magnitude <= max) {
      return this
    }
    return this.normalize().mult(max)
  }

  toObject() {
    return { x: this.x, y: this.y }
  }
}

export type Vector2Tuple = [number, number]
