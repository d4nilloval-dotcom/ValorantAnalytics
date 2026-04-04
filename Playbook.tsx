import { useState, useRef } from 'react';
import { Plus, Folder, FolderOpen, Trash2, Edit2, Image, FileText, X, ChevronRight, BookOpen, Save, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'valoanalytics_playbook_v1';

interface Play {
  id: string;
  title: string;
  description: string;
  image?: string; // base64
  map?: string;
  side?: 'attack' | 'defense' | 'both';
  tags: string[];
  createdAt: number;
}
interface PlayFolder {
  id: string;
  name: string;
  color: string;
  plays: Play[];
}

const FOLDER_COLORS = ['#ef4444','#f97316','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#ec4899','#06b6d4'];
const MAPS = ['Ascent','Bind','Breeze','Fracture','Haven','Icebox','Lotus','Pearl','Split','Sunset'];
const TAGS_PREDEF = ['Rush','Split','Default','Fake','Retake','Post-plant','Mid control','Eco','Full buy','Clutch'];

function load(): PlayFolder[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function save(data: PlayFolder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function Playbook() {
  const [folders, setFolders] = useState<PlayFolder[]>(load);
  const [activeFolderId, setActiveFolderId] = useState<string|null>(null);
  const [activePlayId, setActivePlayId] = useState<string|null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewPlay, setShowNewPlay] = useState(false);
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0]);
  const [playForm, setPlayForm] = useState<Partial<Play>>({ title:'', description:'', tags:[], side:'attack' });
  const [editPlayId, setEditPlayId] = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const persist = (data: PlayFolder[]) => { setFolders(data); save(data); };

  const createFolder = () => {
    if (!editingFolderName.trim()) return;
    const f: PlayFolder = { id: Date.now().toString(), name: editingFolderName, color: folderColor, plays: [] };
    persist([...folders, f]);
    setEditingFolderName(''); setShowNewFolder(false);
  };

  const deleteFolder = (id: string) => {
    if (!confirm('¿Eliminar carpeta y todas sus plays?')) return;
    persist(folders.filter(f=>f.id!==id));
    if (activeFolderId===id) { setActiveFolderId(null); setActivePlayId(null); }
  };

  const openPlay = (folderId: string) => {
    setActiveFolderId(folderId);
    setActivePlayId(null);
    setShowNewPlay(false);
  };

  const savePlay = () => {
    if (!activeFolderId || !playForm.title?.trim()) return;
    const updated = folders.map(f => {
      if (f.id !== activeFolderId) return f;
      if (editPlayId) {
        return { ...f, plays: f.plays.map(p => p.id===editPlayId ? {...p,...playForm} as Play : p) };
      }
      const np: Play = { id: Date.now().toString(), title: playForm.title!, description: playForm.description||'',
        image: playForm.image, map: playForm.map, side: playForm.side||'attack', tags: playForm.tags||[], createdAt: Date.now() };
      return { ...f, plays: [...f.plays, np] };
    });
    persist(updated);
    setShowNewPlay(false); setEditPlayId(null); setPlayForm({ title:'', description:'', tags:[], side:'attack' });
  };

  const deletePlay = (folderId: string, playId: string) => {
    persist(folders.map(f => f.id===folderId ? {...f, plays: f.plays.filter(p=>p.id!==playId)} : f));
    if (activePlayId===playId) setActivePlayId(null);
  };

  const startEditPlay = (p: Play) => {
    setPlayForm({...p}); setEditPlayId(p.id); setShowNewPlay(true);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPlayForm(prev=>({...prev, image: ev.target?.result as string}));
    reader.readAsDataURL(file);
  };

  const toggleTag = (tag: string) => {
    setPlayForm(prev => {
      const tags = prev.tags||[];
      return { ...prev, tags: tags.includes(tag) ? tags.filter(t=>t!==tag) : [...tags, tag] };
    });
  };

  const activeFolder = folders.find(f=>f.id===activeFolderId);
  const activePlay = activeFolder?.plays.find(p=>p.id===activePlayId);

  return (
    <div className="flex h-full gap-5 animate-fade-in">
      {/* Sidebar de carpetas */}
      <div className="w-64 shrink-0 space-y-3">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2"><BookOpen className="w-4 h-4 text-red-400"/> Playbook</h2>
            <button onClick={()=>setShowNewFolder(!showNewFolder)}
              className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-all">
              <Plus className="w-4 h-4 text-red-400"/>
            </button>
          </div>

          {showNewFolder && (
            <div className="space-y-2 mb-3 p-3 rounded-xl border border-white/10" style={{background:'hsl(220 15% 10%)'}}>
              <input value={editingFolderName} onChange={e=>setEditingFolderName(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&createFolder()}
                placeholder="Nombre de carpeta..." autoFocus
                className="w-full text-sm bg-transparent border-b border-white/20 pb-1 outline-none placeholder:text-muted-foreground/50"/>
              <div className="flex gap-1 flex-wrap">
                {FOLDER_COLORS.map(c=>(
                  <button key={c} onClick={()=>setFolderColor(c)}
                    className={cn('w-5 h-5 rounded-full transition-all',folderColor===c&&'ring-2 ring-white ring-offset-1 ring-offset-transparent')}
                    style={{background:c}}/>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={createFolder} className="flex-1 text-xs py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all">Crear</button>
                <button onClick={()=>setShowNewFolder(false)} className="text-xs px-2 py-1.5 rounded-lg hover:bg-white/10 text-muted-foreground transition-all">✕</button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {folders.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sin carpetas. Crea una para empezar.</p>
            )}
            {folders.map(f => (
              <div key={f.id}
                className={cn('flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all group',
                  activeFolderId===f.id?'bg-white/10':'hover:bg-white/5')}
                onClick={()=>openPlay(f.id)}>
                {activeFolderId===f.id
                  ? <FolderOpen className="w-4 h-4 shrink-0" style={{color:f.color}}/>
                  : <Folder className="w-4 h-4 shrink-0" style={{color:f.color}}/>}
                <span className="text-sm flex-1 truncate">{f.name}</span>
                <span className="text-[10px] text-muted-foreground">{f.plays.length}</span>
                <button onClick={e=>{e.stopPropagation();deleteFolder(f.id)}}
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/20 transition-all">
                  <Trash2 className="w-3 h-3 text-red-400"/>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground">Total plays</p>
          <p className="text-2xl font-black text-red-400">{folders.reduce((s,f)=>s+f.plays.length,0)}</p>
          <p className="text-xs text-muted-foreground mt-2">Carpetas: {folders.length}</p>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0">
        {!activeFolderId ? (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center h-full">
            <BookOpen className="w-12 h-12 text-red-500/30 mb-4"/>
            <h3 className="text-lg font-bold mb-2">Tu Playbook</h3>
            <p className="text-muted-foreground text-sm max-w-xs">Crea carpetas para organizar tus estrategias. Añade capturas de pantalla y describe cada play en detalle.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header carpeta */}
            <div className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderOpen className="w-5 h-5" style={{color:activeFolder?.color}}/>
                <h2 className="font-bold text-lg">{activeFolder?.name}</h2>
                <span className="text-xs text-muted-foreground">{activeFolder?.plays.length} plays</span>
              </div>
              <button onClick={()=>{setShowNewPlay(true);setEditPlayId(null);setPlayForm({title:'',description:'',tags:[],side:'attack'});}}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{background:'hsl(355 85% 58% / 0.2)',border:'1px solid hsl(355 85% 58% / 0.3)',color:'hsl(355 85% 68%)'}}>
                <Plus className="w-4 h-4"/> Nueva Play
              </button>
            </div>

            {/* Formulario nueva/editar play */}
            {showNewPlay && (
              <div className="glass-card p-5 space-y-4" style={{border:'1px solid hsl(355 85% 58% / 0.2)'}}>
                <h3 className="font-semibold">{editPlayId ? 'Editar Play' : 'Nueva Play'}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <input value={playForm.title||''} onChange={e=>setPlayForm(p=>({...p,title:e.target.value}))}
                      placeholder="Nombre de la play *"
                      className="w-full text-sm rounded-xl px-3 py-2 border outline-none focus:border-red-500/50"
                      style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}/>
                    <textarea value={playForm.description||''} onChange={e=>setPlayForm(p=>({...p,description:e.target.value}))}
                      placeholder="Descripción: posiciones, timings, calls..." rows={4}
                      className="w-full text-sm rounded-xl px-3 py-2 border outline-none focus:border-red-500/50 resize-none"
                      style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}/>
                    <div className="flex gap-3">
                      <select value={playForm.map||''} onChange={e=>setPlayForm(p=>({...p,map:e.target.value}))}
                        className="flex-1 text-xs rounded-xl px-3 py-2 border"
                        style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}>
                        <option value="">Mapa...</option>
                        {MAPS.map(m=><option key={m} value={m}>{m}</option>)}
                      </select>
                      <select value={playForm.side||'attack'} onChange={e=>setPlayForm(p=>({...p,side:e.target.value as any}))}
                        className="flex-1 text-xs rounded-xl px-3 py-2 border"
                        style={{background:'hsl(220 15% 10%)',borderColor:'hsl(220 15% 20%)'}}>
                        <option value="attack">⚔️ Ataque</option>
                        <option value="defense">🛡️ Defensa</option>
                        <option value="both">⚖️ Ambos</option>
                      </select>
                    </div>
                    {/* Tags */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {TAGS_PREDEF.map(tag=>(
                          <button key={tag} onClick={()=>toggleTag(tag)}
                            className={cn('text-[10px] px-2 py-0.5 rounded-full border transition-all',
                              (playForm.tags||[]).includes(tag)?'bg-red-500/20 border-red-500/40 text-red-300':'border-white/10 text-muted-foreground hover:border-white/20')}>
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Imagen */}
                  <div>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage}/>
                    {playForm.image ? (
                      <div className="relative rounded-xl overflow-hidden">
                        <img src={playForm.image} alt="play" className="w-full h-48 object-cover"/>
                        <button onClick={()=>setPlayForm(p=>({...p,image:undefined}))}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-all">
                          <X className="w-3.5 h-3.5"/>
                        </button>
                      </div>
                    ) : (
                      <button onClick={()=>fileRef.current?.click()}
                        className="w-full h-48 rounded-xl border-2 border-dashed border-white/15 hover:border-red-500/40 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-white">
                        <Camera className="w-8 h-8 opacity-40"/>
                        <span className="text-sm">Subir captura de pantalla</span>
                        <span className="text-xs opacity-60">PNG, JPG, WebP</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={savePlay}
                    className="px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                    style={{background:'hsl(355 85% 58% / 0.25)',border:'1px solid hsl(355 85% 58% / 0.4)',color:'hsl(355 85% 70%)'}}>
                    <Save className="w-3.5 h-3.5"/> Guardar
                  </button>
                  <button onClick={()=>{setShowNewPlay(false);setEditPlayId(null);}}
                    className="px-5 py-2 rounded-xl text-sm border border-white/10 text-muted-foreground hover:text-white transition-all">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Grid de plays */}
            {activeFolder?.plays.length === 0 && !showNewPlay && (
              <div className="glass-card p-10 text-center">
                <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3"/>
                <p className="text-muted-foreground text-sm">Sin plays en esta carpeta. ¡Añade la primera!</p>
              </div>
            )}
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {activeFolder?.plays.map(play=>(
                <div key={play.id}
                  className={cn('glass-card overflow-hidden cursor-pointer transition-all hover:scale-[1.01]',
                    activePlayId===play.id&&'ring-2 ring-red-500/40')}
                  onClick={()=>setActivePlayId(activePlayId===play.id?null:play.id)}>
                  {play.image && <img src={play.image} alt={play.title} className="w-full h-36 object-cover"/>}
                  {!play.image && (
                    <div className="w-full h-24 flex items-center justify-center" style={{background:'hsl(220 15% 10%)'}}>
                      <Image className="w-8 h-8 text-muted-foreground/20"/>
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm leading-tight">{play.title}</h3>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={e=>{e.stopPropagation();startEditPlay(play);}}
                          className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all">
                          <Edit2 className="w-3 h-3 text-muted-foreground"/>
                        </button>
                        <button onClick={e=>{e.stopPropagation();deletePlay(activeFolderId!,play.id);}}
                          className="w-6 h-6 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-all">
                          <Trash2 className="w-3 h-3 text-red-400"/>
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {play.map&&<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-muted-foreground">{play.map}</span>}
                      {play.side&&<span className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{background:play.side==='attack'?'hsl(25 90% 55%/0.15)':play.side==='defense'?'hsl(220 80% 60%/0.15)':'hsl(280 70% 60%/0.15)',
                          color:play.side==='attack'?'#fb923c':play.side==='defense'?'#60a5fa':'#a78bfa'}}>
                        {play.side==='attack'?'⚔️ Ataque':play.side==='defense'?'🛡️ Defensa':'⚖️ Ambos'}
                      </span>}
                    </div>
                    {play.tags.length>0&&(
                      <div className="flex gap-1 flex-wrap">
                        {play.tags.map(t=><span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full border border-white/8 text-muted-foreground/70">{t}</span>)}
                      </div>
                    )}
                    {/* Descripción expandida */}
                    {activePlayId===play.id && play.description && (
                      <div className="pt-2 border-t border-white/10">
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{play.description}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
