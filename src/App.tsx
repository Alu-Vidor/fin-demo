import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { SimulationCanvas } from './components/SimulationCanvas'
import { PlaceholderSimulation } from './models/PlaceholderSimulation'
import { SocialForceModel } from './models/SocialForceModel'
import type { SimulationModel } from './models/SimulationModel'
import type {
  SimulationMetadata,
  SimulationModelKey,
  SimulationParameterValues,
} from './types/simulation'
import './App.css'

const MODEL_METADATA: Record<SimulationModelKey, SimulationMetadata> = {
  sfm: {
    title: 'Social Force Model',
    description:
      'Agents interact via attractive and repulsive forces, mimicking physical social dynamics.',
    parameters: [
      {
        id: 'desiredSpeed',
        label: 'Desired Speed',
        min: 0.5,
        max: 3,
        step: 0.1,
        defaultValue: 1.5,
        unit: 'm/s',
      },
      {
        id: 'relaxationTime',
        label: 'Relaxation Time',
        min: 0.1,
        max: 2,
        step: 0.05,
        defaultValue: 0.6,
        unit: 's',
      },
      {
        id: 'repulsionStrengthA',
        label: 'Repulsion Strength A',
        min: 1,
        max: 10,
        step: 0.5,
        defaultValue: 5,
      },
    ],
  },
  rvo: {
    title: 'RVO / ORCA',
    description:
      'Velocity obstacles with optimal reciprocal collision avoidance for dense scenarios.',
    parameters: [
      {
        id: 'neighborRadius',
        label: 'Neighbor Radius',
        min: 1,
        max: 10,
        step: 0.5,
        defaultValue: 4,
        unit: 'm',
      },
      {
        id: 'timeHorizon',
        label: 'Time Horizon',
        min: 0.5,
        max: 6,
        step: 0.1,
        defaultValue: 2.5,
        unit: 's',
      },
    ],
  },
  cellular: {
    title: 'Cellular Automata',
    description:
      'Grid-based crowd model using discrete cells with probabilistic movement rules.',
    parameters: [
      {
        id: 'cellSize',
        label: 'Cell Size',
        min: 10,
        max: 60,
        step: 2,
        defaultValue: 24,
        unit: 'px',
      },
      {
        id: 'updateRate',
        label: 'Update Rate',
        min: 0.25,
        max: 4,
        step: 0.25,
        defaultValue: 1.25,
        unit: 'x',
      },
    ],
  },
}

type ParameterState = Record<SimulationModelKey, SimulationParameterValues>

const buildDefaultParameters = (): ParameterState =>
  Object.entries(MODEL_METADATA).reduce((acc, [key, metadata]) => {
    acc[key as SimulationModelKey] = metadata.parameters.reduce(
      (params, parameter) => {
        params[parameter.id] = parameter.defaultValue
        return params
      },
      {} as SimulationParameterValues,
    )
    return acc
  }, {} as ParameterState)

const DEFAULT_PARAMETER_STATE = buildDefaultParameters()

function App() {
  const [selectedModel, setSelectedModel] =
    useState<SimulationModelKey>('sfm')
  const [running, setRunning] = useState(false)
  const [parameterState, setParameterState] = useState<ParameterState>(
    () => DEFAULT_PARAMETER_STATE,
  )

  const models = useMemo<Record<SimulationModelKey, SimulationModel>>(
    () => ({
      sfm: new SocialForceModel(DEFAULT_PARAMETER_STATE.sfm),
      rvo: new PlaceholderSimulation('rvo', DEFAULT_PARAMETER_STATE.rvo),
      cellular: new PlaceholderSimulation(
        'cellular',
        DEFAULT_PARAMETER_STATE.cellular,
      ),
    }),
    [],
  )

  const activeModel = models[selectedModel]
  const activeParameters = parameterState[selectedModel]
  const metadata = MODEL_METADATA[selectedModel]

  useEffect(() => {
    activeModel.configure(activeParameters)
  }, [activeModel, activeParameters])

  const modelOptions = useMemo(
    () =>
      Object.entries(MODEL_METADATA).map(([key, { title }]) => ({
        value: key as SimulationModelKey,
        label: title,
      })),
    [],
  )

  const handleModelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextModel = event.target.value as SimulationModelKey
    setSelectedModel(nextModel)
    setRunning(false)
  }

  const handleSliderChange = (id: string, value: number) => {
    setParameterState((prev) => ({
      ...prev,
      [selectedModel]: { ...prev[selectedModel], [id]: value },
    }))
  }

  const handleStart = () => setRunning(true)
  const handlePause = () => setRunning(false)
  const handleReset = () => {
    activeModel.reset()
    setRunning(false)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <header className="sidebar__header">
          <p className="eyebrow">Crowd Dynamics Lab</p>
          <h1>{metadata.title}</h1>
          <p className="muted">{metadata.description}</p>
        </header>

        <label className="field">
          <span>Simulation Model</span>
          <select
            value={selectedModel}
            onChange={handleModelChange}
            className="select"
          >
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="controls">
          <button
            className="btn primary"
            onClick={handleStart}
            disabled={running}
          >
            Start
          </button>
          <button className="btn" onClick={handlePause} disabled={!running}>
            Pause
          </button>
          <button className="btn ghost" onClick={handleReset}>
            Reset
          </button>
        </div>

        <section className="sliders">
          <h2>Parameters</h2>
          {metadata.parameters.map((parameter) => (
            <div key={parameter.id} className="slider">
              <div className="slider__label">
                <span>{parameter.label}</span>
                <span className="value">
                  {activeParameters[parameter.id].toFixed(2)}
                  {parameter.unit ? ` ${parameter.unit}` : ''}
                </span>
              </div>
              <input
                type="range"
                min={parameter.min}
                max={parameter.max}
                step={parameter.step ?? 0.1}
                value={activeParameters[parameter.id]}
                onChange={(event) =>
                  handleSliderChange(parameter.id, Number(event.target.value))
                }
              />
            </div>
          ))}
        </section>
      </aside>

      <main className="stage">
        <SimulationCanvas model={activeModel} running={running} />
      </main>
    </div>
  )
}

export default App
