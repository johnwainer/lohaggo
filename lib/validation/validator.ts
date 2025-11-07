import { z } from 'zod'
import { NextResponse } from 'next/server'
import { sanitizeObject } from './sanitize'

export async function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  sanitize: boolean = true
): Promise<{ success: true; data: T } | { success: false; error: NextResponse }> {
  try {
    const validated = schema.parse(data)
    const result = sanitize ? sanitizeObject(validated as any) : validated
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
      return {
        success: false,
        error: NextResponse.json(
          { error: 'Validación fallida', details: errors },
          { status: 400 }
        )
      }
    }
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Error de validación' },
        { status: 400 }
      )
    }
  }
}

export function validateId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length < 100
}

export function validateEmail(email: string): boolean {
  return z.string().email().safeParse(email).success
}

export function validatePhone(phone: string): boolean {
  return /^\+?[1-9]\d{1,14}$/.test(phone)
}

export function validateUrl(url: string): boolean {
  return z.string().url().safeParse(url).success
}
