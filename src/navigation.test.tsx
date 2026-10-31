// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import dashboard from '../public/data/dashboard.json'
import App from './App'
import { queryMart } from './queryMart'

vi.mock('./components', () => ({ BarChart: () => null, DataGrid: () => null, DecisionNote: () => null, MetricCard: () => null, TrendChart: () => null }))
vi.mock('./innovation', () => ({ PageInsight: () => null }))
vi.mock('./MartVerifier', () => ({ MartVerifier: () => null }))
vi.mock('./SemanticLab', () => ({ default: ({ lang }: { lang: string }) => <div data-testid="semantic-page">Semantic laboratory · {lang}</div> }))
vi.mock('./queryMart', () => ({ queryMart: vi.fn() }))
beforeEach(() => {
  localStorage.clear(); window.history.replaceState({}, '', '/')
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => dashboard })))
  vi.stubGlobal('scrollTo', vi.fn())
  vi.mocked(queryMart).mockReset().mockResolvedValue({ current: {}, previous: {}, trend: [], breakdown: [], detail: [], context: { topDriver: 'Test', topShare: 0, dimension: 'product', canDrill: true, comparisonAvailable: false, currentStart: '2025-01-01', currentEnd: '2025-01-07' } })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('shareable semantic navigation', () => {
  it('opens ?view=semantic directly, preserves unrelated parameters, and keeps language switching', async () => {
    window.history.replaceState({}, '', '/?view=semantic&origin=test')
    render(<App/>)
    expect((await screen.findByTestId('semantic-page')).textContent).toContain('en')
    expect(queryMart).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'PT' }))
    expect(screen.getByTestId('semantic-page').textContent).toContain('pt')
    expect(document.documentElement.lang).toBe('pt-BR')
    expect(new URLSearchParams(location.search).get('lang')).toBe('pt')
    fireEvent.click(screen.getByRole('button', { name: 'Comando de Atendimento' }))
    await waitFor(() => expect(queryMart).toHaveBeenCalled())
    expect(new URLSearchParams(location.search).get('view')).toBe('service')
    expect(new URLSearchParams(location.search).get('origin')).toBe('test')
    fireEvent.click(screen.getByRole('button', { name: 'Laboratório Semântico' }))
    await screen.findByTestId('semantic-page')
    expect(new URLSearchParams(location.search).get('view')).toBe('semantic')
  })
  it('handles popstate and an invalid view without removing the six original pages', async () => {
    window.history.replaceState({}, '', '/?view=invalid')
    render(<App/>); await screen.findByRole('button', { name: 'Semantic Laboratory' })
    expect(document.querySelectorAll('header nav button[data-index]')).toHaveLength(6)
    expect(screen.queryByTestId('semantic-page')).toBeNull()
    act(() => { window.history.replaceState({}, '', '/?view=semantic'); window.dispatchEvent(new PopStateEvent('popstate')) })
    await screen.findByTestId('semantic-page')
    act(() => { window.history.replaceState({}, '', '/?view=narratives'); window.dispatchEvent(new PopStateEvent('popstate')) })
    await waitFor(() => expect(screen.queryByTestId('semantic-page')).toBeNull())
    expect(document.querySelector('header nav button.active')?.textContent).toContain('Narrative Explorer')
  })
  it('honors explicit ?lang=pt/en before saved preferences, including history changes', async () => {
    localStorage.setItem('clearline-lang', 'en')
    window.history.replaceState({}, '', '/?view=semantic&lang=pt')
    render(<App/>)
    expect((await screen.findByTestId('semantic-page')).textContent).toContain('pt')
    expect(document.documentElement.lang).toBe('pt-BR')
    act(() => { window.history.replaceState({}, '', '/?view=semantic&lang=en'); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(screen.getByTestId('semantic-page').textContent).toContain('en')
    expect(document.documentElement.lang).toBe('en')
  })
})
