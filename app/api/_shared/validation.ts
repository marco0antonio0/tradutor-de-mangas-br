import { NextResponse } from 'next/server'
import { z, type ZodError, type ZodTypeAny } from 'zod'

type ValidationIssue = {
  path: string
  message: string
  code: string
}

function toValidationIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }))
}

export function validationErrorResponse(error: ZodError) {
  return NextResponse.json(
    {
      message: 'Dados inválidos na requisição',
      error: 'Bad Request',
      statusCode: 400,
      details: toValidationIssues(error),
    },
    { status: 400 }
  )
}

export async function parseJsonBody<TSchema extends ZodTypeAny>(
  request: Request,
  schema: TSchema
): Promise<{ success: true; data: z.infer<TSchema> } | { success: false; response: NextResponse }> {
  let payload: unknown = {}
  try {
    payload = await request.json()
  } catch {
    payload = {}
  }

  const result = schema.safeParse(payload)
  if (!result.success) {
    return { success: false, response: validationErrorResponse(result.error) }
  }

  return { success: true, data: result.data }
}

export function parseParams<TSchema extends ZodTypeAny>(
  payload: unknown,
  schema: TSchema
): { success: true; data: z.infer<TSchema> } | { success: false; response: NextResponse } {
  const result = schema.safeParse(payload)
  if (!result.success) {
    return { success: false, response: validationErrorResponse(result.error) }
  }
  return { success: true, data: result.data }
}

