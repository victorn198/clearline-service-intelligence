import { describe, expect, it } from 'vitest'
import { changeDrivers, concentration, trendStats } from './innovation'

describe('Clearline analytical contracts', () => {
  it('keeps complaint changes signed for risk interpretation', () => {
    const rows=changeDrivers([{name:'A',value:80,previous:100},{name:'B',value:120,previous:100}])
    expect(rows.find(row=>row.name==='A')?.change).toBe(-20)
    expect(rows.find(row=>row.name==='B')?.change).toBe(20)
  })

  it('calculates rate movement from the selected daily series', () => {
    expect(trendStats([{label:'1',value:90},{label:'2',value:95}]).change).toBeCloseTo(5/90)
  })

  it('uses all scoped complaints as the concentration denominator', () => {
    const result=concentration([{name:'A',value:30},{name:'B',value:20}],200)
    expect(result.top3Share).toBe(.25)
    expect(result.hhi).toBeCloseTo(325)
  })
})
