import { cookies } from 'next/headers';

// Felles innloggingssjekk for admin-sidene. Kalles fra hver side
// (ikke bare en layout), siden layouts ikke kjøres på nytt ved navigering.
export async function isAdminAuthenticated() {
  return (await cookies()).get('admin_auth')?.value === 'true';
}

export async function getAdminTheme() {
  return ((await cookies()).get('admin-theme')?.value ?? 'dark') as 'dark' | 'light';
}
