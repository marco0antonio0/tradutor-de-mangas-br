import 'server-only'

import { authController } from '@/lib/backend/auth/auth.module'
import type { LocalUser } from '@/lib/backend/auth/auth.types'

export type { LocalUser }

export function loginWithEmailPassword(email: string, password: string) {
  return authController.loginWithEmailPassword(email, password)
}

export function getUserFromToken(token: string | null | undefined): LocalUser | null {
  return authController.getUserFromToken(token)
}

export function deleteSession(token: string | null | undefined) {
  authController.deleteSession(token)
}
