import type { Destination, Scenario, ScenarioId } from '@/lib/types'

type Props = {
  scenarios: Scenario[]
  destinations: Destination[]
  scenario: ScenarioId
  destType: string
  category: string
  destination: string
  onScenario: (value: ScenarioId) => void
  onDestType: (value: string) => void
  onCategory: (value: string) => void
  onDestination: (value: string) => void
}

export function Controls({
  scenarios,
  destinations,
  scenario,
  destType,
  category,
  destination,
  onScenario,
  onDestType,
  onCategory,
  onDestination
}: Props) {
  const filteredForType = destinations.filter(d => destType === 'TOTS' || d.tipus_desti === destType)
  const categories = Array.from(new Set(filteredForType.map(d => d.us))).sort((a, b) => a.localeCompare(b, 'ca'))
  const modeCategory = category !== 'TOTS'
  const filteredDests = filteredForType
    .filter(d => category === 'TOTS' || d.us === category)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'ca'))

  return (
    <section className="cardish filters-panel">
      <div className="section-label">Filtres</div>
      <div className="control">
        <label htmlFor="scenario">Població</label>
        <select id="scenario" value={scenario} onChange={e => onScenario(e.target.value as ScenarioId)}>
          {scenarios.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div className="control">
        <label htmlFor="destType">Tipus de destinació</label>
        <select id="destType" value={destType} onChange={e => onDestType(e.target.value)}>
          <option value="TOTS">Tots</option>
          <option value="equipament">Equipaments</option>
          <option value="espai_lliure">Espais lliures</option>
          <option value="bus_interparroquial">Parades de bus interparroquial</option>
        </select>
      </div>
      <div className="control">
        <label htmlFor="category">Categoria</label>
        <select id="category" value={category} onChange={e => onCategory(e.target.value)}>
          <option value="TOTS">Totes</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="control">
        <label htmlFor="destination">Destinació</label>
        <select id="destination" value={destination} onChange={e => onDestination(e.target.value)}>
          {modeCategory && <option value="_CAT_">[ Totes de la categoria ]</option>}
          {filteredDests.map(d => <option key={`${d.tipus_desti}-${d.us}-${d.nom}`} value={d.nom}>{d.nom}</option>)}
        </select>
      </div>
    </section>
  )
}
