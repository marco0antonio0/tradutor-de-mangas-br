import { redirect } from 'next/navigation'
import { authController } from '@/lib/backend/auth/auth.module'

export default function HomePage() {
  if (!authController.hasAnyUser()) {
    redirect('/setup')
  }
  redirect('/login')
}
