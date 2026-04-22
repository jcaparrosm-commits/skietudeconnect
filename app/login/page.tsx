"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Erreur : " + error.message);
    } else {
      // Connexion réussie -> Redirection vers le planning (la racine)
      router.push('/'); 
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-[32px] shadow-2xl border border-gray-50">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-black text-blue-600 italic tracking-tighter uppercase">Ski Etude Connect</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Connexion à ton espace</p>
        </header>

        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email" 
            required 
            className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" 
            onChange={(e) => setEmail(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="Mot de passe" 
            required 
            className="w-full bg-gray-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" 
            onChange={(e) => setPassword(e.target.value)} 
          />

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50 mt-4"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <button 
          onClick={() => router.push('/signup')} 
          className="w-full text-center mt-6 text-[10px] font-black text-gray-400 uppercase hover:text-blue-600 transition-colors"
        >
          Pas encore de compte ? S'inscrire
        </button>
      </div>
    </div>
  );
}