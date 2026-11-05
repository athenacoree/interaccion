import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wlbnulfixkfmvcifvpum.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_rs8AM2PluCPJD1P4fhBznw_SrZSDh4F';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const BASE = import.meta.env.BASE_URL || '/';
const SOCIAL_IMAGE = 'https://commons.wikimedia.org/wiki/Special:FilePath/TheStarryNightByVincentVanGogh.jpg';
const kinds = [
  { id: 'know_me', name: '¿Qué tanto me conoces?', short: 'Conóceme', icon: '✳', detail: 'Crea un reto con preguntas sobre tus gustos y tu personalidad.' },
  { id: 'confession', name: 'Secretos y confesiones', short: 'Confesiones', icon: '✉', detail: 'Recibe mensajes y pensamientos de forma privada.' },
  { id: 'comparison', name: 'Cara a cara', short: 'Comparativas', icon: '◫', detail: 'Pon dos imágenes frente a frente y deja que voten.' },
];
const makeSlug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'mi-experiencia';
const route = () => {
  const value = location.hash.replace(/^#\/?/, '');
  const [type, ...parts] = value.split('/');
  return { type: type || 'home', value: parts.join('/') };
};
const publicUrl = (path) => location.origin + location.pathname + '#/' + path;
const trackActivity = async (profileId, experienceId, eventType) => {
  if (!supabase || !profileId || typeof window === 'undefined') return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const target = eventType === 'profile_view' ? profileId : experienceId;
    const storageKey = 'interaccion:activity:' + eventType + ':' + target + ':' + today;
    let visitorKey = localStorage.getItem('interaccion:visitor');
    if (!visitorKey) { visitorKey = crypto.randomUUID(); localStorage.setItem('interaccion:visitor', visitorKey); }
    if (eventType !== 'experience_response' && localStorage.getItem(storageKey)) return;
    const { error } = await supabase.from('profile_activity').insert({
      profile_id: profileId, experience_id: experienceId, visitor_key: visitorKey,
      event_type: eventType, visit_day: today
    });
    if ((!error || error.code === '23505') && eventType !== 'experience_response') localStorage.setItem(storageKey, '1');
  } catch { /* Analytics never blocks access to public content. */ }
};
const uploadImage = async (file, userId) => {
  if (!file || !supabase) return null;
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) throw new Error('Usa una imagen JPG, PNG, WebP o AVIF.');
  if (file.size > 10 * 1024 * 1024) throw new Error('La imagen no puede superar 10 MB.');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = userId + '/' + crypto.randomUUID() + '.' + ext;
  const { error } = await supabase.storage.from('interaccion-media').upload(path, file, { cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return supabase.storage.from('interaccion-media').getPublicUrl(path).data.publicUrl;
};

function Brand() { return <a className="brand" href={BASE}><span className="brand-icon">i</span><span>interacción</span></a>; }
function Button({ children, kind = 'primary', ...props }) { return <button className={'btn btn-' + kind} {...props}>{children}</button>; }
function Notice({ error, success }) { return <>{error && <p className="notice error">{error}</p>}{success && <p className="notice success">{success}</p>}</>; }

function AuthDialog({ close, done }) {
  const [mode, setMode] = useState('signup');
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const set = (k) => (e) => setForm(v => ({ ...v, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      if (!supabase) throw new Error('La conexión de Supabase aún no está configurada. Añade las variables indicadas en el README.');
      if (mode === 'signup') {
        const username = form.username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error('El identificador debe tener entre 3 y 24 caracteres: letras, números o guion bajo.');
        const { data, error: e1 } = await supabase.auth.signUp({ email: form.email.trim(), password: form.password, options: { data: { username, display_name: form.name.trim() }, emailRedirectTo: publicUrl('') } });
        if (e1) throw e1;
        if (data.session && data.user) {
          const { error: e2 } = await supabase.from('profiles').upsert({ id: data.user.id, username, display_name: form.name.trim() });
          if (e2) throw e2;
          done(data.user);
        } else setSuccess('Te enviamos un correo de confirmación. Cuando confirmes, inicia sesión para terminar de crear tu espacio.');
      } else {
        const { data, error: e1 } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (e1) throw e1;
        done(data.user);
      }
    } catch (e2) { setError(e2.message || 'No se pudo completar.'); }
    finally { setBusy(false); }
  }
  return <div className="overlay" onMouseDown={e => e.target === e.currentTarget && close()}><section className="modal">
    <button className="x" onClick={close} aria-label="Cerrar">×</button><div className="kicker">TU ESPACIO PERSONAL</div>
    <h2>{mode === 'signup' ? 'Empieza por ti.' : 'Qué bueno verte.'}</h2><p className="subtle">{mode === 'signup' ? 'Crea tu cuenta y recibe tu propio enlace para compartir.' : 'Entra para continuar con tus experiencias.'}</p>
    <form className="form" onSubmit={submit}>
      {mode === 'signup' && <><label>Tu nombre<input required maxLength="60" value={form.name} onChange={set('name')} placeholder="Cómo quieres aparecer" /></label><label>Tu identificador<input required minLength="3" maxLength="24" pattern="[a-zA-Z0-9_]+" value={form.username} onChange={set('username')} placeholder="tu_usuario" /></label></>}
      <label>Correo electrónico<input type="email" required value={form.email} onChange={set('email')} placeholder="tu@correo.com" /></label>
      <label>Contraseña<input type="password" required minLength="8" value={form.password} onChange={set('password')} placeholder="Al menos 8 caracteres" /></label>
      <Notice error={error} success={success} /><Button disabled={busy}>{busy ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta ↗' : 'Iniciar sesión ↗'}</Button>
    </form>
    <p className="switch">{mode === 'signup' ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'} <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setSuccess(''); }}>{mode === 'signup' ? 'Inicia sesión' : 'Regístrate'}</button></p>
  </section></div>;
}

function App() {
  const [page, setPage] = useState(route());
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  useEffect(() => {
    const change = () => setPage(route());
    window.addEventListener('hashchange', change);
    if (!supabase) { setReady(true); return () => window.removeEventListener('hashchange', change); }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => { window.removeEventListener('hashchange', change); listener.subscription.unsubscribe(); };
  }, []);
  async function signOut() { await supabase?.auth.signOut(); setUser(null); location.hash = ''; }
  if (!ready) return <div className="boot"><span className="brand-icon">i</span><p>Preparando tu espacio…</p></div>;
  if (page.type === 'u' && page.value) return <><PublicProfile username={page.value} openAuth={() => setAuthOpen(true)} />{authOpen && <AuthDialog close={() => setAuthOpen(false)} done={u => { setUser(u); setAuthOpen(false); location.hash = ''; }}/>}</>;
  if (page.type === 'e' && page.value) return <><PublicExperience slug={page.value} openAuth={() => setAuthOpen(true)} />{authOpen && <AuthDialog close={() => setAuthOpen(false)} done={u => { setUser(u); setAuthOpen(false); location.hash = ''; }}/>}</>;
  if (user) return <Dashboard user={user} signOut={signOut} />;
  return <Landing openAuth={() => setAuthOpen(true)} authOpen={authOpen} closeAuth={() => setAuthOpen(false)} onSignedIn={u => { setUser(u); setAuthOpen(false); }} />;
}

function Landing({ openAuth, authOpen, closeAuth, onSignedIn }) {
  const [active, setActive] = useState('all');
  const cards = active === 'all' ? kinds : kinds.filter(k => k.id === active);
  return <div className="app">
    <header className="topbar wrap"><Brand/><nav><a href="#types">Experiencias</a><a href="#how">Cómo funciona</a></nav><Button kind="soft" onClick={openAuth}>Entrar ↗</Button></header>
    <main>
      <section className="hero wrap"><div className="hero-text"><div className="kicker"><span className="live"/> UN ESPACIO PARA CONECTAR</div><h1>Conócete.<br/>Exprésate.<br/><em>Interactúa.</em></h1><p>Preguntas que acercan, confesiones que se quedan contigo y comparativas que despiertan conversaciones. Crea algo tuyo y compártelo con un enlace.</p><div className="hero-actions"><Button onClick={openAuth}>Crear mi espacio <span>↗</span></Button><a className="text-link" href="#types">Descubrir cómo funciona ↓</a></div><div className="hero-proof"><span className="proof-icons"><i>✳</i><i>♡</i><i>◫</i></span> Tu enlace. Tus reglas. Tu gente.</div></div>
        <div className="hero-visual"><div className="glass-phone"><div className="phone-top"><span>9:41</span><span>● ● ●</span></div><div className="phone-notch"></div><div className="phone-greeting">Tu mundo,<br/><b>a tu manera.</b></div><div className="phone-chip">✦ Tu espacio está listo</div><div className="phone-question"><small>UNA PREGUNTA PARA TI</small><strong>¿Qué recuerdo nunca olvidarías?</strong><div className="fake-lines"><i/><i/><i/></div></div><div className="phone-bottom"><span>⌂</span><span>♡</span><span>✧</span></div></div><div className="float-note note-one"><span>♡</span><div><b>Una respuesta nueva</b><small>Alguien participó en tu enlace</small></div></div><div className="float-note note-two"><span>◫</span><div><b>Tu comparativa</b><small>Lista para compartir</small></div></div><div className="glow-orb"></div></div>
      </section>
      <section className="section wrap" id="types"><div className="section-head"><div><div className="kicker">TRES FORMAS DE INTERACTUAR</div><h2>¿Qué quieres crear?</h2></div><p>Elige una idea. Personalízala. Compártela.</p></div>
        <div className="tabs"><button className={active === 'all' ? 'selected' : ''} onClick={() => setActive('all')}>Todas</button>{kinds.map(k => <button key={k.id} className={active === k.id ? 'selected' : ''} onClick={() => setActive(k.id)}>{k.short}</button>)}</div>
        <div className="type-grid">{cards.map((k, i) => <article className={'type-card tone-' + k.id} key={k.id}><div className="type-card-top"><span>0{i + 1} / 03</span><b>{k.icon}</b></div><div className="type-copy"><small>{k.short.toUpperCase()}</small><h3>{k.name}</h3><p>{k.detail}</p><button onClick={openAuth}>Crear experiencia <span>↗</span></button></div></article>)}</div>
      </section>
      <section className="how wrap" id="how"><div className="kicker">SIN COMPLICACIONES</div><h2>De una idea a un enlace<br/><em>que todos pueden abrir.</em></h2><div className="steps"><article><span>01</span><h3>Crea</h3><p>Diseña preguntas, añade fotos y personaliza tus opciones.</p></article><article><span>02</span><h3>Comparte</h3><p>Obtén un enlace. Las personas pueden participar sin crear cuenta.</p></article><article><span>03</span><h3>Descubre</h3><p>Consulta las respuestas y resultados desde tu espacio privado.</p></article></div></section>
      <section className="cta wrap"><div className="cta-symbol">✳</div><div className="kicker">EMPIEZA CUANDO QUIERAS</div><h2>Tu próxima historia<br/><em>empieza con una pregunta.</em></h2><p>Crea tu cuenta y publica tu primera experiencia.</p><Button onClick={openAuth}>Crear mi espacio ↗</Button></section>
    </main>
    <footer className="footer wrap"><Brand/><span>Un lugar para conectar de otra manera.</span><button onClick={openAuth}>Crear cuenta</button></footer>
    {authOpen && <AuthDialog close={closeAuth} done={onSignedIn}/>}
  </div>;
}

function Dashboard({ user, signOut }) {
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [entries, setEntries] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState([]);
  const [entrySearch, setEntrySearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activity, setActivity] = useState([]);
  const [editingExperience, setEditingExperience] = useState(null);
  async function load() {
    setLoading(true); setError('');
    let { data: p, error: pe } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (!p) {
      const meta = user.user_metadata || {};
      const username = String(meta.username || '').toLowerCase();
      const display_name = String(meta.display_name || '').trim();
      if (/^[a-z0-9_]{3,24}$/.test(username) && display_name) {
        const { data: made, error: me } = await supabase.from('profiles').upsert({ id: user.id, username, display_name }).select().single();
        if (!me) p = made; else setError(me.message);
      } else if (pe) setError(pe.message);
    }
    const { data: ex, error: ee } = await supabase.from('experiences').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
    const { data: act, error: ae } = await supabase.from('profile_activity')
      .select('event_type,experience_id,created_at,visitor_key')
      .eq('profile_id', user.id)
      .gte('created_at', new Date(Date.now()-30*86400000).toISOString())
      .order('created_at',{ascending:false}).limit(5000);
    setProfile(p); setItems(ex || []); setActivity(act || []);
    if (ee || ae) setError((ee || ae).message); setLoading(false);
  }
  useEffect(() => { load(); }, [user.id]);
  async function openEntries(item) {
    setSelected(item); setSelectedEntryIds([]); setEntrySearch('');
    const [{ data, error: e }, { data: questions, error: qe }] = await Promise.all([
      supabase.from('experience_entries').select('*').eq('experience_id', item.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('experience_questions').select('id,prompt,position').eq('experience_id', item.id).order('position')
    ]);
    if (e || qe) setError((e || qe).message); else { setEntries(data || []); setSelectedQuestions(questions || []); }
  }
  async function removeSelectedEntries() {
    if (!selectedEntryIds.length || !confirm('¿Eliminar las respuestas seleccionadas? Esta acción no se puede deshacer.')) return;
    const { error: e } = await supabase.from('experience_entries').delete().in('id', selectedEntryIds);
    if (e) setError(e.message); else { setEntries(v => v.filter(x => !selectedEntryIds.includes(x.id))); setSelectedEntryIds([]); setSuccess('Respuestas eliminadas.'); }
  }
  async function clearEntries() {
    if (!selected || !entries.length || !confirm('¿Vaciar todas las respuestas de este juego? Esta acción no se puede deshacer.')) return;
    const { error: e } = await supabase.from('experience_entries').delete().eq('experience_id', selected.id);
    if (e) setError(e.message); else { setEntries([]); setSelectedEntryIds([]); setSuccess('La bandeja quedó vacía.'); }
  }
  async function changeStatus(item, status) {
    const { error: e } = await supabase.from('experiences').update({ status, updated_at: new Date().toISOString() }).eq('id', item.id).eq('owner_id', user.id);
    if (e) setError(e.message); else { setSuccess(status === 'published' ? 'Experiencia publicada.' : status === 'paused' ? 'Experiencia pausada.' : status === 'archived' ? 'Experiencia archivada.' : 'Estado actualizado.'); await load(); }
  }
  async function deleteExperience(item) {
    if (!confirm('¿Eliminar «' + item.title + '» y todas sus respuestas? No se puede deshacer.')) return;
    const { error: e } = await supabase.from('experiences').delete().eq('id', item.id).eq('owner_id', user.id);
    if (e) setError(e.message); else { setSuccess('Experiencia eliminada.'); if (selected?.id === item.id) setSelected(null); await load(); }
  }
  async function duplicateExperience(item) {
    const { data: qs, error: qe } = await supabase.from('experience_questions').select('*').eq('experience_id', item.id).order('position');
    if (qe) { setError(qe.message); return; }
    const slug = makeSlug(item.title) + '-' + crypto.randomUUID().slice(0,6);
    const { data: copy, error: ce } = await supabase.from('experiences').insert({
      owner_id:user.id, slug, kind:item.kind, title:item.title + ' (copia)', description:item.description,
      cover_url:item.cover_url, is_public:true, status:'draft', settings:item.settings || {}
    }).select().single();
    if (ce) { setError(ce.message); return; }
    if (qs?.length) {
      const rows=qs.map(q=>({experience_id:copy.id,position:q.position,prompt:q.prompt,answer_type:q.answer_type,options:q.options,media:q.media}));
      const {error:qe2}=await supabase.from('experience_questions').insert(rows);
      if(qe2){await supabase.from('experiences').delete().eq('id',copy.id);setError(qe2.message);return;}
    }
    setSuccess('Copia creada como borrador.'); await load();
  }
  async function copyExperienceLink(item) {
    const url=publicUrl('e/'+item.slug);
    try { await navigator.clipboard.writeText(url); setSuccess('Enlace copiado. Ya puedes compartirlo.'); }
    catch { prompt('Copia este enlace para compartirlo:',url); }
  }
  async function renameExperience(item) {
    const title=prompt('Título de la experiencia',item.title); if(title===null)return;
    const clean=title.trim(); if(!clean){setError('El título no puede quedar vacío.');return;}
    const description=prompt('Descripción',item.description || ''); if(description===null)return;
    const {error:e}=await supabase.from('experiences').update({title:clean,description:description.trim(),updated_at:new Date().toISOString()}).eq('id',item.id).eq('owner_id',user.id);
    if(e)setError(e.message);else{setSuccess('Título y descripción actualizados.');await load();}
  }
  async function removeEntry(id) {
    if (!confirm('¿Eliminar esta respuesta?')) return;
    const { error: e } = await supabase.from('experience_entries').delete().eq('id', id);
    if (e) setError(e.message); else { setEntries(v => v.filter(x => x.id !== id)); setSelectedEntryIds(v => v.filter(x => x !== id)); setSuccess('Respuesta eliminada.'); }
  }
  return <div className="dashboard">
    <header className="dashbar wrap"><Brand/><div className="dash-actions"><a href={profile?.username ? publicUrl('u/' + profile.username) : '#'} target="_blank" rel="noreferrer">Ver mi perfil ↗</a><Button kind="soft" onClick={signOut}>Salir</Button></div></header>
    <main className="dash-main wrap"><div className="dash-intro"><div><div className="kicker">TU ESPACIO PERSONAL</div><h1>Hola, {profile?.display_name || 'bienvenido'}.</h1><p>Administra tus experiencias y mira lo que tu gente comparte contigo.</p></div><Button onClick={() => setShowCreator(true)}>＋ Crear experiencia</Button></div>
      <Notice error={error} success={success}/>
      {profile && <ProfileEditor profile={profile} user={user} onSaved={async p => { setProfile(p); setEditingProfile(false); setSuccess('Tu perfil se actualizó.'); }} editing={editingProfile} setEditing={setEditingProfile}/>}
      {!profile && !loading && <div className="panel"><h3>Completa tu perfil</h3><p className="subtle">No pudimos encontrar el perfil asociado a esta cuenta. Revisa el identificador y vuelve a intentarlo.</p><Button kind="soft" onClick={load}>Volver a cargar</Button></div>}
      {profile && <section className="activity-panel panel"><div className="dash-title"><div><div className="kicker">ÚLTIMOS 30 DÍAS</div><h2>Actividad de tu espacio</h2></div><span>Datos aproximados</span></div><div className="activity-stats"><article><small>Visitas al perfil</small><b>{activity.filter(x=>x.event_type==='profile_view').length}</b></article><article><small>Juegos abiertos</small><b>{activity.filter(x=>x.event_type==='experience_view').length}</b></article><article><small>Respuestas enviadas</small><b>{activity.filter(x=>x.event_type==='experience_response').length}</b></article></div><div className="recent-activity">{activity.slice(0,6).map((a,i)=><div className="recent-activity-row" key={i}><span>{a.event_type==='profile_view'?'Visita al perfil':a.event_type==='experience_view'?'Abrió '+(items.find(x=>x.id===a.experience_id)?.title||'una experiencia'):'Nueva respuesta en '+(items.find(x=>x.id===a.experience_id)?.title||'una experiencia')}</span><time>{new Date(a.created_at).toLocaleString()}</time></div>)}</div><p className="tiny-note">Se cuentan visitantes únicos estimados por navegador y día. Las respuestas se cuentan por envío. No se recopilan direcciones IP ni se identifica personalmente a quien visita.</p></section>}
      <div className="dash-title"><div><div className="kicker">TU CONTENIDO</div><h2>Tus experiencias</h2></div><span>{items.length} creadas</span></div>
      {loading ? <div className="panel">Cargando tus experiencias…</div> : items.length ? <div className="my-grid">{items.map(item => <article className="my-card" key={item.id}><div className="my-card-top"><span className={'kind-icon ' + item.kind}>{kinds.find(k => k.id === item.kind)?.icon}</span><span className={'status ' + item.status}>{item.status === 'published' ? 'Publicada' : item.status === 'paused' ? 'Pausada' : item.status === 'archived' ? 'Archivada' : 'Borrador'}</span></div><h3>{item.title}</h3><p>{item.description || kinds.find(k => k.id === item.kind)?.detail}</p><div className="game-metrics"><span>{activity.filter(x=>x.experience_id===item.id && x.event_type==='experience_view').length} aperturas</span><span>{activity.filter(x=>x.experience_id===item.id && x.event_type==='experience_response').length} respuestas</span><small>Últimos 30 días</small></div><div className="my-link">{publicUrl('e/' + item.slug)}</div><div className="my-card-actions"><button onClick={() => copyExperienceLink(item)}>Copiar enlace</button><button onClick={() => openEntries(item)}>Respuestas</button>{item.status === 'published' ? <button onClick={() => changeStatus(item,'paused')}>Pausar</button> : item.status === 'archived' ? null : <button onClick={() => changeStatus(item,'published')}>Publicar</button>}<button onClick={() => setEditingExperience(item)}>Editar</button><button onClick={() => duplicateExperience(item)}>Duplicar</button><button onClick={() => renameExperience(item)}>Título</button>{item.status !== 'archived' ? <button onClick={() => changeStatus(item,'archived')}>Archivar</button> : <button onClick={() => changeStatus(item,'draft')}>Restaurar</button>}<button className="danger-link" onClick={() => deleteExperience(item)}>Eliminar</button><a href={'#/e/' + item.slug} target="_blank" rel="noreferrer">Abrir ↗</a></div></article>)}</div> : <div className="empty panel"><span>✧</span><h3>Este espacio está esperando tu primera idea.</h3><p>Crea una experiencia y comparte el enlace con tus personas favoritas.</p><Button onClick={() => setShowCreator(true)}>Crear mi primera experiencia</Button></div>}
      {selected && <section className="panel responses">
        <div className="responses-head"><div><div className="kicker">BANDEJA DE RESPUESTAS</div><h2>{selected.title}</h2><p className="subtle">{entries.length} respuestas recibidas</p></div><button className="close-small" onClick={() => setSelected(null)}>Cerrar ×</button></div>
        <div className="inbox-tools"><input value={entrySearch} onChange={e => setEntrySearch(e.target.value)} placeholder="Buscar por nombre o contenido…"/><div><button className="danger-link" disabled={!selectedEntryIds.length} onClick={removeSelectedEntries}>Eliminar seleccionadas ({selectedEntryIds.length})</button><button className="danger-link" disabled={!entries.length} onClick={clearEntries}>Vaciar bandeja</button></div></div>
        {entries.length ? entries.filter(entry => (entry.respondent_name || '').toLowerCase().includes(entrySearch.toLowerCase()) || JSON.stringify(entry.answers || {}).toLowerCase().includes(entrySearch.toLowerCase())).map(entry => <article className="entry" key={entry.id}>
          <div className="entry-head"><label className="entry-select"><input type="checkbox" checked={selectedEntryIds.includes(entry.id)} onChange={e => setSelectedEntryIds(v => e.target.checked ? [...v,entry.id] : v.filter(x => x !== entry.id))}/><b>{entry.is_anonymous ? 'Anónimo' : entry.respondent_name || 'Participante'}</b></label><small>{new Date(entry.created_at).toLocaleString()}</small></div>
          <div className="entry-answers">{Object.entries(entry.answers || {}).map(([qid,answer]) => <div className="entry-answer" key={qid}><small>{selectedQuestions.find(q => q.id === qid)?.prompt || 'Respuesta'}</small><p>{Array.isArray(answer) ? answer.join(', ') : String(answer)}</p></div>)}</div>
          <button className="danger-link" onClick={() => removeEntry(entry.id)}>Eliminar respuesta</button>
        </article>) : <p className="subtle">Todavía no hay respuestas para esta experiencia.</p>}
      </section>}
    </main>
    {showCreator && <Creator user={user} close={() => setShowCreator(false)} created={async () => { setShowCreator(false); setSuccess('Tu experiencia ya está creada.'); await load(); }}/>}\n    {editingExperience && <ExperienceEditor item={editingExperience} close={() => setEditingExperience(null)} saved={async () => {setEditingExperience(null);setSuccess('Experiencia actualizada.');await load();}}/>}
  </div>;
}

function ProfileEditor({ profile, user, editing, setEditing, onSaved }) {
  const [name, setName] = useState(profile.display_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatar, setAvatar] = useState(profile.avatar_url || '');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const url = file ? await uploadImage(file, user.id) : avatar;
      const { data, error: e1 } = await supabase.from('profiles').update({ display_name: name.trim(), bio: bio.trim(), avatar_url: url || null }).eq('id', user.id).select().single();
      if (e1) throw e1; onSaved(data);
    } catch (e1) { setError(e1.message); } finally { setBusy(false); }
  }
  return <section className="profile-panel panel"><div className="profile-summary">{avatar ? <img src={avatar} alt="Foto de perfil"/> : <div className="avatar-placeholder">{(profile.display_name || 'I').slice(0,1).toUpperCase()}</div>}<div><b>{profile.display_name}</b><span>@{profile.username}</span><small>{profile.bio || 'Añade una pequeña descripción a tu perfil.'}</small></div><Button kind="soft" onClick={() => setEditing(!editing)}>{editing ? 'Cancelar' : 'Editar perfil'}</Button></div>
    {editing && <form className="profile-form" onSubmit={save}><label>Nombre visible<input value={name} onChange={e => setName(e.target.value)} maxLength="60" required/></label><label>Descripción<textarea value={bio} onChange={e => setBio(e.target.value)} maxLength="180" placeholder="Cuéntales algo sobre ti…"/></label><label>Foto de perfil<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={e => setFile(e.target.files?.[0] || null)}/></label>{error && <Notice error={error}/>}<Button disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</Button></form>}
  </section>;
}

const creatorTemplates = {
  know_me: [
    { title: '¿Qué tanto me conoces?', prompts: ['¿Cuál es mi comida favorita?', '¿Qué música escucho más?', '¿Qué es lo que más me gusta hacer?'] },
    { title: '¿Quién me conoce mejor?', prompts: ['¿Cuál sería mi plan perfecto?', '¿Qué cosa no soporto?', '¿Cuál es uno de mis mayores sueños?'] },
    { title: '¿Cuánto sabes de mí?', prompts: ['¿Cuál es mi color favorito?', '¿Qué prefiero hacer en mi tiempo libre?'] },
  ],
  confession: [
    { title: 'Déjame una confesión', prompts: ['Cuéntame algo que nunca me hayas dicho…'] },
    { title: 'Dime algo sin filtros', prompts: ['¿Qué siempre has querido decirme?'] },
    { title: 'Una pregunta anónima', prompts: ['Escribe aquí tu pregunta o mensaje…'] },
  ],
  comparison: [
    { title: '¿Qué imagen te gusta más?', prompts: ['¿Cuál de estas imágenes prefieres?'] },
    { title: '¿Qué foto te gusta más?', prompts: ['¿Cuál elegirías?'] },
    { title: '¿Cuál prefieres?', prompts: ['Vota por tu opción favorita'] },
    { title: '¿Qué outfit es mejor?', prompts: ['¿Cuál combina mejor?'] },
  ],
};

function Creator({ user, close, created }) {
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState('');
  const [template, setTemplate] = useState(-1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prompts, setPrompts] = useState(['']);
  const [correctAnswers, setCorrectAnswers] = useState([0]);
  const [options, setOptions] = useState(['Opción 1', 'Opción 2']);
  const [imageFiles, setImageFiles] = useState([null, null]);
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [publish, setPublish] = useState(true);
  const current = kinds.find(k => k.id === kind);
  const needsOptions = kind !== 'confession';

  function chooseKind(id) {
    setKind(id); setTemplate(-1); setTitle(''); setDescription('');
    setPrompts(['']); setCorrectAnswers([0]); setOptions(['Opción 1', 'Opción 2']); setImageFiles([null, null]);
    setStep(2); setError('');
  }
  function chooseTemplate(index) {
    setTemplate(index);
    if (index === -1) { setTitle(''); setPrompts(['']); setCorrectAnswers([0]); }
    else {
      const preset = creatorTemplates[kind][index];
      setTitle(preset.title); setPrompts(preset.prompts); setCorrectAnswers(preset.prompts.map(()=>0));
    }
    setStep(3);
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    let createdId = null; let questionsSaved = false;
    try {
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error('Escribe un título para tu juego.');
      const cleanPrompts = prompts.map(x => x.trim()).filter(Boolean);
      if (!cleanPrompts.length) throw new Error('Añade al menos una pregunta.');
      if (kind === 'comparison' && imageFiles.filter(Boolean).length < 2) throw new Error('Añade las dos imágenes para crear la comparativa.');
      if (needsOptions && (options.filter(x => x.trim()).length < 2 || options.some(x => !x.trim()))) throw new Error('Completa todas las opciones y añade al menos dos.');
      const slug = makeSlug(cleanTitle) + '-' + crypto.randomUUID().slice(0, 6);
      const { data: ex, error: ee } = await supabase.from('experiences').insert({
        owner_id: user.id, slug, kind, title: cleanTitle, description: description.trim(),
        status: publish ? 'published' : 'draft', is_public: true,
        settings: { allow_anonymous: anonymous, template: template === -1 ? 'custom' : String(template) }
      }).select().single();
      if (ee) throw ee;
      createdId = ex.id;
      let questionOptions = [];
      if (needsOptions) {
        for (let i = 0; i < options.length; i++) {
          const label = options[i].trim();
          if (!label) continue;
          questionOptions.push({ label, image_url: imageFiles[i] ? await uploadImage(imageFiles[i], user.id) : null });
        }
      }
      const questionRows = cleanPrompts.map((prompt, position) => ({
        experience_id: ex.id, position, prompt,
        answer_type: kind === 'confession' ? 'text' : kind === 'comparison' ? 'image_choice' : 'single_choice',
        options: questionOptions, media: kind === 'know_me' ? { correct_option_index: Number(correctAnswers[position] || 0) } : []
      }));
      const { error: qe } = await supabase.from('experience_questions').insert(questionRows);
      if (qe) throw qe;
      questionsSaved = true;
      await created();
    } catch (e1) { if (createdId && !questionsSaved) await supabase.from('experiences').delete().eq('id', createdId); setError(e1.message || 'No se pudo crear.'); }
    finally { setBusy(false); }
  }

  return <div className="overlay"><section className="modal creator-modal creator-wizard">
    <button className="x" onClick={close} aria-label="Cerrar">×</button>
    <div className="wizard-progress"><span className={step >= 1 ? 'active' : ''}>01 · Tipo</span><i/><span className={step >= 2 ? 'active' : ''}>02 · Idea</span><i/><span className={step >= 3 ? 'active' : ''}>03 · Diseño</span></div>
    {step === 1 && <>
      <div className="kicker">CREAR JUEGO O EXPERIENCIA</div><h2>¿Qué quieres crear?</h2><p className="subtle">Primero elige el formato. Después podrás escoger una idea preparada o crear la tuya.</p>
      <div className="creator-kind-grid">{kinds.map(k => <button type="button" className={'creator-kind-card ' + k.id} key={k.id} onClick={() => chooseKind(k.id)}><span>{k.icon}</span><b>{k.name}</b><small>{k.detail}</small><em>Elegir formato ↗</em></button>)}</div>
    </>}
    {step === 2 && current && <>
      <button type="button" className="wizard-back" onClick={() => setStep(1)}>← Cambiar formato</button>
      <div className="kicker">IDEAS PREPARADAS</div><h2>{current.name}</h2><p className="subtle">Puedes empezar con una de estas ideas o personalizar el título y las preguntas desde cero.</p>
      <div className="template-grid">{creatorTemplates[kind].map((t,i) => <button type="button" className="template-card" key={t.title} onClick={() => chooseTemplate(i)}><span>✦ PLANTILLA {String(i+1).padStart(2,'0')}</span><b>{t.title}</b><small>{t.prompts.length} {t.prompts.length === 1 ? 'pregunta inicial' : 'preguntas iniciales'}</small><em>Usar esta idea ↗</em></button>)}<button type="button" className="template-card custom-template" onClick={() => chooseTemplate(-1)}><span>＋ TU PROPIA IDEA</span><b>Personalizado</b><small>Empieza con un título y contenido completamente tuyos.</small><em>Crear desde cero ↗</em></button></div>
    </>}
    {step === 3 && current && <>
      <button type="button" className="wizard-back" onClick={() => setStep(2)}>← Volver a las ideas</button>
      <div className="kicker">PERSONALIZA TU EXPERIENCIA</div><h2>{template === -1 ? 'Tu idea, tus reglas.' : title}</h2><p className="subtle">Puedes cambiar cualquier texto de la plantilla antes de publicarla.</p>
      <form className="form" onSubmit={submit}>
        <label>Título del juego<input required maxLength="90" value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'comparison' ? 'Ej. ¿Qué imagen prefieres?' : kind === 'confession' ? 'Ej. Déjame una confesión' : 'Ej. ¿Qué tanto me conoces?'}/></label>
        <label>Descripción<textarea maxLength="240" value={description} onChange={e => setDescription(e.target.value)} placeholder="Explica brevemente de qué trata…"/></label>
        <div className="field-group"><span className="field-title">{kind === 'confession' ? 'Mensaje que verá quien participe' : kind === 'comparison' ? 'Pregunta para votar' : 'Preguntas del juego'}</span>
          {prompts.map((value,index) => <div className="question-edit" key={index}><input required maxLength="180" value={value} onChange={e => setPrompts(v => v.map((x,i) => i === index ? e.target.value : x))} placeholder={kind === 'confession' ? 'Escribe aquí lo que quieras compartir…' : kind === 'comparison' ? 'Ej. ¿Cuál de estas opciones prefieres?' : 'Pregunta ' + (index+1)}/>{prompts.length > 1 && kind === 'know_me' && <button type="button" className="remove-question" onClick={() => {setPrompts(v => v.filter((_,i) => i !== index));setCorrectAnswers(v => v.filter((_,i) => i !== index));}}>Quitar</button>}</div>)}
          {kind === 'know_me' && prompts.map((prompt,index) => <label className="correct-answer-select" key={'correct-'+index}>Respuesta correcta · Pregunta {index+1}<select value={correctAnswers[index] ?? 0} onChange={e => setCorrectAnswers(v => v.map((x,i) => i === index ? Number(e.target.value) : x))}>{options.map((option,i) => <option key={i} value={i}>{option || 'Opción '+(i+1)}</option>)}</select></label>)}
          {kind === 'know_me' && prompts.length < 15 && <button type="button" className="add-option" onClick={() => {setPrompts(v => [...v,'']);setCorrectAnswers(v => [...v,0]);}}>＋ Añadir pregunta</button>}
        </div>
        {needsOptions && <div className="options-editor"><b>{kind === 'comparison' ? 'Opciones e imágenes' : 'Respuestas posibles'}</b>{options.map((op,i) => <div className="option-edit" key={i}><input required value={op} onChange={e => setOptions(v => v.map((x,j) => j === i ? e.target.value : x))} placeholder={kind === 'comparison' ? 'Nombre de la opción ' + (i+1) : 'Respuesta ' + (i+1)}/>{kind === 'comparison' && <label className="file-mini">Foto {i+1}<input required={i < 2 && !imageFiles[i]} type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={e => setImageFiles(v => v.map((x,j) => j === i ? e.target.files?.[0] || null : x))}/></label>}</div>)}{options.length < (kind === 'comparison' ? 6 : 8) && <button type="button" className="add-option" onClick={() => {setOptions(v => [...v,'']);setImageFiles(v => [...v,null]);}}>＋ Añadir opción personalizada</button>}</div>}
        <label className="check-row"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)}/> Permitir participación anónima</label>
        <label className="check-row"><input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)}/> Publicar al crear</label>
        <p className="tiny-note">Las confesiones solo serán visibles en tu panel privado. En las comparativas, evita calificar cuerpos o rostros de personas. No publiques datos personales de otras personas sin su permiso.</p>
        <Notice error={error}/>
        <Button disabled={busy}>{busy ? 'Creando…' : publish ? 'Crear y publicar ↗' : 'Guardar borrador'}</Button>
      </form>
    </>}
  </section></div>;
}

function ExperienceEditor({item,close,saved}) {
  const [title,setTitle]=useState(item.title || '');
  const [description,setDescription]=useState(item.description || '');
  const [questions,setQuestions]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{let live=true;(async()=>{const {data,error:e}=await supabase.from('experience_questions').select('*').eq('experience_id',item.id).order('position');if(live){if(e)setError(e.message);setQuestions(data||[]);setLoading(false);}})();return()=>{live=false;};},[item.id]);
  function updateQuestion(index,patch){setQuestions(v=>v.map((q,i)=>i===index?{...q,...patch}:q));}
  function updateOption(qi,oi,patch){setQuestions(v=>v.map((q,i)=>i===qi?{...q,options:(q.options||[]).map((o,j)=>j===oi?{...o,...patch}:o)}:q));}
  function addQuestion(){setQuestions(v=>[...v,{id:null,position:v.length,prompt:'Nueva pregunta',answer_type:item.kind==='confession'?'text':item.kind==='comparison'?'image_choice':'single_choice',options:item.kind==='confession'?[]:[{label:'Opción 1',image_url:null},{label:'Opción 2',image_url:null}],media:{correct_option_index:0}}]);}
  async function save(e){e.preventDefault();setBusy(true);setError('');try{
    if(!title.trim())throw new Error('Escribe un título.');
    if(!questions.length)throw new Error('Añade al menos una pregunta.');
    if(questions.some(q=>!q.prompt.trim()))throw new Error('Todas las preguntas necesitan un texto.');
    if(item.kind!=='confession'&&questions.some(q=>(q.options||[]).filter(o=>o.label?.trim()).length<2))throw new Error('Cada pregunta necesita al menos dos opciones.');
    const {error:ue}=await supabase.from('experiences').update({title:title.trim(),description:description.trim(),updated_at:new Date().toISOString()}).eq('id',item.id);
    if(ue)throw ue;
    const {data:existing,error:se}=await supabase.from('experience_questions').select('id').eq('experience_id',item.id);if(se)throw se;
    const keep=questions.filter(q=>q.id).map(q=>q.id);const remove=(existing||[]).map(q=>q.id).filter(id=>!keep.includes(id));
    if(remove.length){const {error:de}=await supabase.from('experience_questions').delete().in('id',remove);if(de)throw de;}
    for(let i=0;i<questions.length;i++){const q=questions[i];const row={experience_id:item.id,position:i,prompt:q.prompt.trim(),answer_type:q.answer_type,options:(q.options||[]).filter(o=>o.label?.trim()),media:q.media||[]};const result=q.id?await supabase.from('experience_questions').update(row).eq('id',q.id):await supabase.from('experience_questions').insert(row);if(result.error)throw result.error;}
    await saved();
  }catch(err){setError(err.message||'No se pudieron guardar los cambios.');}finally{setBusy(false);}}
  return <div className="overlay"><section className="modal editor-modal"><button className="x" onClick={close}>×</button><div className="kicker">EDITAR EXPERIENCIA</div><h2>Actualiza tu juego.</h2>{loading?<p>Cargando preguntas…</p>:<form className="form" onSubmit={save}><label>Título<input value={title} maxLength="100" onChange={e=>setTitle(e.target.value)} required/></label><label>Descripción<textarea value={description} maxLength="240" onChange={e=>setDescription(e.target.value)}/></label>{questions.map((q,qi)=><div className="edit-question-card" key={q.id||'new-'+qi}><div className="edit-question-top"><b>Pregunta {qi+1}</b><button type="button" className="danger-link" onClick={()=>setQuestions(v=>v.filter((_,i)=>i!==qi))}>Quitar</button></div><input value={q.prompt} onChange={e=>updateQuestion(qi,{prompt:e.target.value})} placeholder="Escribe la pregunta"/>{item.kind!=='confession'&&<div className="edit-options">{(q.options||[]).map((op,oi)=><div className="edit-option" key={oi}><input value={op.label||''} onChange={e=>updateOption(qi,oi,{label:e.target.value})} placeholder={'Opción '+(oi+1)}/>{item.kind==='comparison'&&<input value={op.image_url||''} onChange={e=>updateOption(qi,oi,{image_url:e.target.value})} placeholder="URL de imagen"/>}<button type="button" className="danger-link" onClick={()=>updateQuestion(qi,{options:q.options.filter((_,i)=>i!==oi)})}>×</button></div>)}<button type="button" className="add-option" onClick={()=>updateQuestion(qi,{options:[...(q.options||[]),{label:'Nueva opción',image_url:null}]})}>＋ Añadir opción</button>{item.kind==='know_me'&&<label>Respuesta correcta<select value={q.media?.correct_option_index??0} onChange={e=>updateQuestion(qi,{media:{...(q.media||{}),correct_option_index:Number(e.target.value)}})}>{(q.options||[]).map((op,i)=><option value={i} key={i}>{op.label||'Opción '+(i+1)}</option>)}</select></label>}</div>}</div>)}<button type="button" className="add-option" onClick={addQuestion}>＋ Añadir pregunta</button><Notice error={error}/><Button disabled={busy}>{busy?'Guardando…':'Guardar cambios'}</Button></form>}</section></div>;
}

function PublicProfile({ username, openAuth }) {
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let live = true; (async () => { const { data: p, error: pe } = await supabase.from('profiles').select('id,username,display_name,bio,avatar_url,is_public').eq('username', username.toLowerCase()).maybeSingle(); if (pe || !p?.is_public) { if (live) setLoading(false); return; } const { data: ex, error: ee } = await supabase.from('experiences').select('id,slug,kind,title,description,created_at').eq('owner_id', p.id).eq('status','published').eq('is_public',true).order('created_at',{ascending:false}); if (live) { setProfile(p); setItems(ex || []); setLoading(false); trackActivity(p.id, null, 'profile_view'); } })(); return () => { live = false; }; }, [username]);
  if (loading) return <PublicShell><div className="panel">Cargando perfil…</div></PublicShell>;
  if (!profile) return <PublicShell><div className="panel empty"><h2>Este perfil no está disponible.</h2><a href={BASE}>Volver al inicio</a></div></PublicShell>;
  return <PublicShell><section className="public-profile panel">{profile.avatar_url ? <img className="public-avatar" src={profile.avatar_url} alt=""/> : <div className="public-avatar avatar-placeholder">{profile.display_name.slice(0,1)}</div>}<div className="kicker">PERFIL PÚBLICO</div><h1>{profile.display_name}</h1><p className="subtle">@{profile.username}</p>{profile.bio && <p className="public-bio">{profile.bio}</p>}</section><section className="public-list"><div className="kicker">SUS EXPERIENCIAS</div><h2>Participa y descubre.</h2>{items.length ? <div className="my-grid">{items.map(x => <a className="my-card public-card" href={'#/e/' + x.slug} key={x.id}><span className="kind-icon">{kinds.find(k => k.id === x.kind)?.icon}</span><h3>{x.title}</h3><p>{x.description}</p><b>Abrir experiencia ↗</b></a>)}</div> : <div className="panel empty"><p>Aún no hay experiencias publicadas.</p></div>}</section><JoinCTA openAuth={openAuth}/></PublicShell>;
}

function PublicExperience({ slug, openAuth }) {
  const [item, setItem] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [owner, setOwner] = useState(null);
  const [answers, setAnswers] = useState({});
  const [name, setName] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [score, setScore] = useState(null);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  useEffect(() => { let live = true; (async () => { const { data: ex, error: exError } = await supabase.from('experiences').select('*').eq('slug', slug).eq('is_public',true).eq('status','published').maybeSingle(); if (exError || !ex) { if (live) setItem(false); return; } const [{ data: qs }, { data: p }] = await Promise.all([supabase.from('experience_questions').select('*').eq('experience_id',ex.id).order('position'),supabase.from('profiles').select('id,username,display_name').eq('id',ex.owner_id).maybeSingle()]); if (live) { setItem(ex); setQuestions(qs || []); setOwner(p); setAllowAnonymous(ex.settings?.allow_anonymous !== false); setAnonymous(ex.settings?.allow_anonymous !== false); trackActivity(ex.owner_id, ex.id, 'experience_view'); } })(); return () => { live = false; }; }, [slug]);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (!supabase || !item) throw new Error('No se pudo conectar con esta experiencia.');
      const missing = questions.find(q => !String(answers[q.id] || '').trim());
      if (missing) throw new Error('Responde la pregunta antes de enviar.');
      const isAnon = allowAnonymous ? anonymous : false;
      if (!isAnon && !name.trim()) throw new Error('Escribe el nombre que quieres mostrar.');
      const { error: e1 } = await supabase.from('experience_entries').insert({ experience_id: item.id, respondent_name: isAnon ? null : name.trim(), is_anonymous: isAnon, answers });
      if (e1) throw e1;
      if (item.kind === 'know_me') {
        const correct = questions.filter(q => Number(q.media?.correct_option_index ?? 0) >= 0 && q.options?.[Number(q.media?.correct_option_index ?? 0)]?.label === answers[q.id]).length;
        setScore({ correct, total: questions.length });
      }
      await trackActivity(item.owner_id, item.id, 'experience_response'); setSuccess(true);
    } catch (e1) { setError(e1.message); } finally { setBusy(false); }
  }
  if (item === null) return <PublicShell><div className="panel">Cargando experiencia…</div></PublicShell>;
  if (item === false) return <PublicShell><div className="panel empty"><h2>Este enlace no está disponible.</h2><a href={BASE}>Volver al inicio</a></div></PublicShell>;
  return <PublicShell><section className="experience-public panel"><div className="kicker">{kinds.find(k => k.id === item.kind)?.short.toUpperCase()}</div><h1>{item.title}</h1><p className="subtle">{item.description}</p>{owner && <a className="owner-link" href={'#/u/' + owner.username}>Creado por {owner.display_name} · @{owner.username}</a>}
    {success ? <div className="success-screen"><span>✓</span><h2>¡Respuesta enviada!</h2><p>Gracias por participar. Tu respuesta llegó a su creador.</p>{score && <div className="quiz-score"><b>{score.correct} / {score.total}</b><small>respuestas correctas</small><p>{score.correct === score.total ? '¡Excelente! Conoces muy bien a esta persona.' : score.correct >= Math.ceil(score.total/2) ? '¡Nada mal! Has acertado varias.' : '¡Ahora ya sabes un poco más sobre esta persona!'}</p></div>}</div> : <form className="form response-form" onSubmit={submit}>{questions.map(q => <div className="question-block" key={q.id}><h3>{q.prompt}</h3>{q.answer_type === 'text' ? <textarea required maxLength="1000" value={answers[q.id] || ''} onChange={e => setAnswers(v => ({...v,[q.id]:e.target.value}))} placeholder="Escribe tu mensaje…"/> : <div className="answer-options">{(q.options || []).map((op,i) => <label className={'answer-option ' + (answers[q.id] === op.label ? 'chosen' : '')} key={i}><input type="radio" name={q.id} checked={answers[q.id] === op.label} onChange={() => setAnswers(v => ({...v,[q.id]:op.label}))}/>{op.image_url && <img src={op.image_url} alt={op.label}/>}<span>{op.label}</span></label>)}</div>}</div>)}
      {allowAnonymous && <label className="check-row"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)}/> Enviar de forma anónima</label>}{(!allowAnonymous || !anonymous) && <label>Tu nombre<input required value={name} onChange={e => setName(e.target.value)} maxLength="60" placeholder="Cómo quieres aparecer"/></label>}<Notice error={error}/><Button disabled={busy}>{busy ? 'Enviando…' : 'Enviar respuesta ↗'}</Button><p className="tiny-note">No necesitas crear una cuenta para participar. Comparte solo información que te sientas cómodo enviando.</p></form>}
  </section><JoinCTA openAuth={openAuth}/></PublicShell>;
}

function PublicShell({ children }) { return <div className="public-shell"><header className="topbar wrap"><Brand/><a className="text-link" href={BASE}>Descubrir Interacción ↗</a></header><main className="public-main wrap">{children}</main><footer className="footer wrap"><Brand/><span>Hecho para conectar.</span><a href={BASE}>Crear mi espacio ↗</a></footer></div>; }
function JoinCTA({ openAuth }) { return <section className="join-cta panel"><div><div className="kicker">¿TE GUSTARÍA TENER EL TUYO?</div><h2>Ahora crea tu propio espacio.</h2><p className="subtle">Diseña preguntas y experiencias para compartir con tus amigos.</p></div><Button onClick={openAuth}>Crear mi cuenta ↗</Button></section>; }

export default App;
