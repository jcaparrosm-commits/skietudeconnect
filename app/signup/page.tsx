"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [role, setRole] = useState("skieur");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Inscription dans Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // 2. Création du profil dans la table 'profiles'
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([
          {
            id: authData.user.id, // On lie l'ID Auth à l'ID Profil
            nom,
            prenom,
            role,
            email // Si tu as gardé la colonne email, sinon tu peux l'enlever
          }
        ], { onConflict: 'id' }); // Si l'ID existe déjà, il met à jour au lieu de planter

      if (profileError) {
        setError("Erreur profil: " + profileError.message);
      } else {
        alert("Compte créé ! Connectez-vous maintenant.");
        router.push('/login');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border-b-[10px] border-blue-600">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="font-[900] text-blue-600 italic text-3xl uppercase tracking-tighter">Rejoindre</h1>
            <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest mt-1">Ski Etude Connect</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold mb-4 border border-red-100 uppercase italic">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="text" placeholder="NOM" required
                className="bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-600 transition-all uppercase"
                onChange={(e) => setNom(e.target.value)}
              />
              <input 
                type="text" placeholder="PRÉNOM" required
                className="bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-600 transition-all uppercase"
                onChange={(e) => setPrenom(e.target.value)}
              />
            </div>

            <input 
              type="email" placeholder="EMAIL" required
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-600 transition-all"
              onChange={(e) => setEmail(e.target.value)}
            />

            <input 
              type="password" placeholder="MOT DE PASSE" required
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-600 transition-all"
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="bg-gray-50 p-4 rounded-2xl border-2 border-gray-100">
              <label className="block text-[9px] font-black text-gray-400 uppercase mb-2 ml-1">Je suis un :</label>
              <select 
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-transparent text-xs font-black uppercase italic outline-none text-blue-900"
              >
                <option value="skieur">Skieur</option>
                <option value="collaborateur">Collaborateur / Coach</option>
              </select>
            </div>

            <button 
              type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white p-5 rounded-2xl font-[900] italic uppercase tracking-tight shadow-xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? "CRÉATION..." : "CRÉER MON COMPTE"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link href="/login" className="text-[10px] font-black text-gray-400 uppercase hover:text-blue-600 transition-all">
              Déjà un compte ? <span className="text-blue-600">Se connecter</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}