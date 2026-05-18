export interface LocalUser {
  id: number
  name: string
  email: string
  role: number
  limite: number
  gerado: number
  limit_page_upload: number
  foto: string | null
}

export interface LoginResult {
  token: string
  user: LocalUser
}
