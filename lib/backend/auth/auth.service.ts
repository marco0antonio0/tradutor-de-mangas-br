import type { LocalUser, LoginResult } from './auth.types'
import { AuthRepository } from './auth.repository'

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  hasAnyUser() {
    return this.repository.hasAnyUser()
  }

  createInitialAdmin(name: string, email: string, password: string) {
    return this.repository.createInitialAdmin(name, email, password)
  }

  loginWithEmailPassword(email: string, password: string): LoginResult | null {
    return this.repository.loginWithEmailPassword(email, password)
  }

  getUserFromToken(token: string | null | undefined): LocalUser | null {
    return this.repository.getUserFromToken(token)
  }

  deleteSession(token: string | null | undefined) {
    this.repository.deleteSession(token)
  }
}
