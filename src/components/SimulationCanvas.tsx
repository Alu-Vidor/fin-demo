import { useCallback, useEffect, useRef } from 'react'
import type { SimulationModel } from '../models/SimulationModel'

interface SimulationCanvasProps {
  model: SimulationModel | null
  running: boolean
}

export function SimulationCanvas({ model, running }: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const sizeRef = useRef({ width: 0, height: 0 })

  const drawFrame = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx || !model) {
      return
    }
    ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height)
    model.draw(ctx)
  }, [model])

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const parent = canvas.parentElement
    const width = parent?.clientWidth ?? window.innerWidth
    const height = parent?.clientHeight ?? window.innerHeight
    sizeRef.current = { width, height }
    const dpr = window.devicePixelRatio || 1

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctxRef.current = ctx
      model?.resize(width, height)
      model?.update(0)
      drawFrame()
    }
  }, [model, drawFrame])

  const step = useCallback(
    (timestamp: number) => {
      if (!ctxRef.current || !canvasRef.current || !model) {
        return
      }
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp
      }
      const deltaMs = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      model.update(deltaMs / 1000)
      drawFrame()
      animationRef.current = window.requestAnimationFrame(step)
    },
    [model, drawFrame],
  )

  useEffect(() => {
    resize()
    const parentElement = canvasRef.current?.parentElement
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(resize)
        : null

    if (observer && parentElement) {
      observer.observe(parentElement)
    } else {
      window.addEventListener('resize', resize)
    }

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [resize])

  useEffect(() => {
    if (!running || !model) {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      lastTimeRef.current = null
      return
    }

    animationRef.current = window.requestAnimationFrame(step)
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      lastTimeRef.current = null
    }
  }, [running, model, step])

  return (
    <div className="canvas-wrapper">
      <canvas ref={canvasRef} className="simulation-canvas" />
    </div>
  )
}
