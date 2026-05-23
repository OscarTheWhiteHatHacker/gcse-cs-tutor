import { redirect } from 'next/navigation'

export default async function Home() {
  // Middleware handles all redirects (auth checks, role routing)
  // This page should only be reached if something goes wrong
  redirect('/auth/login')
}
