"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminPage() {
  const [skieurs, setSkieurs] = useState<any[]>([]);
  const [collabs, setCollabs] = useState<any[]>([]);
  const [binomes, setBinomes] = useState<any[]>([]);
  
  // États pour le formulaire
  const [selectedSkieur, setSelectedSkieur] = useState("");
  const [selectedCollab, setSelectedCollab] = useState("");
  const [nomBinome, setNomBinome] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. Récupérer les skieurs (en incluant prenom et nom)
    const { data: skieurData } = await supabase
      .from('profiles')
      .select('id, nom, prenom')
      .eq('role', 'skieur');
    
    // 2. Récupérer les collaborateurs (en incluant prenom et nom)
    const { data: collabData } = await supabase
      .from('profiles')
      .select('id, nom, prenom')
      .eq('role', 'collaborateur');

    // 3. Récupérer les binômes existants avec les prénoms des profils liés
    const { data: binomeData } = await supabase
      .from('binomes')
      .select(`
        *,
        skieur:profiles!skieur_id(prenom, nom),
        collab:profiles!collaborateur_id(prenom, nom)
      `);

    setSkieurs(skieurData || []);
    setCollabs(collabData || []);
    setBinomes(binomeData || []);
  };

  const createBinome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkieur || !selectedCollab || !nomBinome) return;
    
    setLoading(true);
    const { error } = await supabase.from('binomes').insert([
      {
        nom_binome: nomBinome,
        skieur_id: selectedSkieur,
        collaborateur_id: selectedCollab
      }
    ]);

    if (error) {
      alert("Erreur : " + error.message);
    } else {
      setNomBinome("");
      fetchData();
    }
    setLoading(false);
  };

  const deleteBinome = async (id: string) => {
    if (!confirm("Supprimer ce binôme ?")) return;
    await supabase.from('binomes').delete().eq('id', id);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-[900] italic text-blue-600 uppercase mb-8 tracking-tighter">Gestion des Binômes</h1>

        {/* FORMULAIRE DE CRÉATION */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl mb-10 border-b-[8px] border-blue-600">
          <h2 className="text-xl font-black uppercase italic mb-6 text-blue-900">Nouveau Binôme</h2>
          <form onSubmit={createBinome} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              type="text" 
              placeholder="NOM DU BINÔME (Ex: Elite Thomas)" 
              className="md:col-span-2 p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold uppercase text-xs outline-none focus:border-blue-600"
              value={nomBinome}
              onChange={(e) => setNomBinome(e.target.value)}
            />
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Choisir le Skieur :</label>
              <select 
                className="p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-600"
                value={selectedSkieur}
                onChange={(e) => setSelectedSkieur(e.target.value)}
              >
                <option value="">SÉLECTIONNER PRÉNOM</option>
                {skieurs.map(s => (
                  <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Choisir le Collab :</label>
              <select 
                className="p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-xs outline-none focus:border-blue-600"
                value={selectedCollab}
                onChange={(e) => setSelectedCollab(e.target.value)}
              >
                <option value="">SÉLECTIONNER PRÉNOM</option>
                {collabs.map(c => (
                  <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                ))}
              </select>
            </div>

            <button 
              disabled={loading}
              className="md:col-span-2 mt-4 bg-blue-600 text-white p-5 rounded-2xl font-[900] italic uppercase shadow-lg hover:bg-blue-700 transition-all active:scale-95"
            >
              {loading ? "CRÉATION..." : "CRÉER LE BINÔME"}
            </button>
          </form>
        </div>

        {/* LISTE DES BINÔMES */}
        <div className="grid grid-cols-1 gap-4">
          <h2 className="text-xl font-black uppercase italic mb-2 text-blue-900">Binômes Actifs</h2>
          {binomes.map(b => (
            <div key={b.id} className="bg-white p-6 rounded-[2rem] shadow-md flex justify-between items-center border-l-[10px] border-emerald-500">
              <div>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Binôme : {b.nom_binome}</p>
                <div className="flex gap-4 mt-1">
                  <p className="text-lg font-[900] italic text-blue-900 uppercase">
                    ⛷️ {b.skieur?.prenom} 
                    <span className="mx-2 text-gray-300">/</span> 
                    🤝 {b.collab?.prenom}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => deleteBinome(b.id)}
                className="bg-red-50 text-red-500 p-3 rounded-xl font-black text-[10px] uppercase border border-red-100 hover:bg-red-500 hover:text-white transition-all"
              >
                Supprimer
              </button>
            </div>
          ))}
          {binomes.length === 0 && <p className="text-center p-10 text-gray-400 font-bold italic">Aucun binôme créé.</p>}
        </div>
      </div>
    </div>
  );
}