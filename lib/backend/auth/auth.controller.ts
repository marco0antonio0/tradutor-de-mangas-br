import type { LocalUser, LoginResult } from './auth.types'
import { AuthService } from './auth.service'

export class AuthController {
  constructor(private readonly service: AuthService) {}

  hasAnyUser() {
    return this.service.hasAnyUser()
  }

  createInitialAdmin(name: string, email: string, password: string) {
    return this.service.createInitialAdmin(name, email, password)
  }

  loginWithEmailPassword(email: string, password: string): LoginResult | null {
    return this.service.loginWithEmailPassword(email, password)
  }

  getUserFromToken(token: string | null | undefined): LocalUser | null {
    return this.service.getUserFromToken(token)
  }

  deleteSession(token: string | null | undefined) {
    this.service.deleteSession(token)
  }
}
