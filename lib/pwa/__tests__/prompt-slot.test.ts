import { describe, expect, it } from 'vitest'
import { EMPTY_SLOT, promptBlocked, reduceSlot } from '@/lib/pwa/prompt-slot'

describe('reduceSlot', () => {
  it('el primero que quiere el espacio lo recibe', () => {
    const s = reduceSlot(EMPTY_SLOT, { type: 'want', id: 'install' })
    expect(s.holder).toBe('install')
  })

  it('quien ya se muestra no es reemplazado por uno de mayor prioridad', () => {
    let s = reduceSlot(EMPTY_SLOT, { type: 'want', id: 'install' })
    s = reduceSlot(s, { type: 'want', id: 'adoption' })
    expect(s.holder).toBe('install')
  })

  it('al soltar, entra el de mayor prioridad que espera', () => {
    let s = reduceSlot(EMPTY_SLOT, { type: 'want', id: 'push' })
    s = reduceSlot(s, { type: 'want', id: 'install' })
    s = reduceSlot(s, { type: 'want', id: 'adoption' })
    expect(s.holder).toBe('push')
    s = reduceSlot(s, { type: 'unwant', id: 'push' })
    expect(s.holder).toBe('adoption')
    s = reduceSlot(s, { type: 'unwant', id: 'adoption' })
    expect(s.holder).toBe('install')
    s = reduceSlot(s, { type: 'unwant', id: 'install' })
    expect(s.holder).toBeNull()
  })

  it('pedir dos veces o soltar sin haber pedido no cambia nada', () => {
    const s = reduceSlot(EMPTY_SLOT, { type: 'want', id: 'push' })
    expect(reduceSlot(s, { type: 'want', id: 'push' })).toBe(s)
    expect(reduceSlot(s, { type: 'unwant', id: 'install' })).toBe(s)
  })
})

describe('promptBlocked', () => {
  it('nunca en /servicios/* mientras la barra de solicitar está montada', () => {
    expect(promptBlocked('/servicios/plomeria', true)).toBe(true)
    expect(promptBlocked('/servicios/plomeria', false)).toBe(false)
    expect(promptBlocked('/servicios', true)).toBe(false)
  })

  it('nunca en los flujos de registro o ingreso', () => {
    expect(promptBlocked('/unete', false)).toBe(true)
    expect(promptBlocked('/login', false)).toBe(true)
    expect(promptBlocked('/dashboard', false)).toBe(false)
  })
})
