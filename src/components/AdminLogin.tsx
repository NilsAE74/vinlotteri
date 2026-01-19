'use client';

import { useState } from 'react';
import { verifyAdminPassword } from '@/lib/admin-actions';
import { Lock } from 'lucide-react';

export default function AdminLogin() {
  const [error, setError] = useState('');

  async function handleSubmit(formData: FormData) {
    const res = await verifyAdminPassword(formData);
    if (!res.success) {
      setError(res.message || 'Feil');
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0506] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1a0b0e] border border-[#722F37] p-8 rounded-xl shadow-2xl">
        <div className="flex justify-center mb-6 text-[#D4AF37]">
          <Lock size={48} />
        </div>
        <h1 className="text-2xl text-center text-[#D4AF37] font-serif mb-6">Admin Tilgang</h1>
        
        <form action={handleSubmit} className="space-y-4">
          <input 
            name="password" 
            type="password" 
            placeholder="Passord"
            className="w-full bg-[#2a1216] border border-[#5a252c] text-white p-3 rounded focus:border-[#D4AF37] outline-none"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" className="w-full bg-[#722F37] text-[#D4AF37] font-bold py-3 rounded hover:bg-[#5a252c] transition">
            Logg Inn
          </button>
        </form>
      </div>
    </div>
  );
}