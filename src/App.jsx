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
  if (page.type === 'u' && page.value) return <PublicProfile username={page.value} openAuth={() => setAuthOpen(true)} />;
  if (page.type === 'e' && page.value) return <PublicExperience slug={page.value} openAuth={() => setAuthOpen(true)} />;
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
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    setProfile(p); setItems(ex || []); if (ee) setError(ee.message); setLoading(false);
  }
  useEffect(() => { load(); }, [user.id]);
  async function openEntries(item) {
    setSelected(item);
    const { data, error: e } = await supabase.from('experience_entries').select('*').eq('experience_id', item.id).order('created_at', { ascending: false }).limit(100);
    if (e) setError(e.message); else setEntries(data || []);
  }
  async function removeEntry(id) {
    if (!confirm('¿Eliminar esta respuesta?')) return;
    const { error: e } = await supabase.from('experience_entries').delete().eq('id', id);
    if (e) setError(e.message); else { setEntries(v => v.filter(x => x.id !== id)); setSuccess('Respuesta eliminada.'); }
  }
  return <div className="dashboard">
    <header className="dashbar wrap"><Brand/><div className="dash-actions"><a href={profile?.username ? publicUrl('u/' + profile.username) : '#'} target="_blank" rel="noreferrer">Ver mi perfil ↗</a><Button kind="soft" onClick={signOut}>Salir</Button></div></header>
    <main className="dash-main wrap"><div className="dash-intro"><div><div className="kicker">TU ESPACIO PERSONAL</div><h1>Hola, {profile?.display_name || 'bienvenido'}.</h1><p>Administra tus experiencias y mira lo que tu gente comparte contigo.</p></div><Button onClick={() => setShowCreator(true)}>＋ Crear experiencia</Button></div>
      <Notice error={error} success={success}/>
      {profile && <ProfileEditor profile={profile} user={user} onSaved={async p => { setProfile(p); setEditingProfile(false); setSuccess('Tu perfil se actualizó.'); }} editing={editingProfile} setEditing={setEditingProfile}/>}
      {!profile && !loading && <div className="panel"><h3>Completa tu perfil</h3><p className="subtle">No pudimos encontrar el perfil asociado a esta cuenta. Revisa el identificador y vuelve a intentarlo.</p><Button kind="soft" onClick={load}>Volver a cargar</Button></div>}
      <div className="dash-title"><div><div className="kicker">TU CONTENIDO</div><h2>Tus experiencias</h2></div><span>{items.length} creadas</span></div>
      {loading ? <div className="panel">Cargando tus experiencias…</div> : items.length ? <div className="my-grid">{items.map(item => <article className="my-card" key={item.id}><div className="my-card-top"><span className={'kind-icon ' + item.kind}>{kinds.find(k => k.id === item.kind)?.icon}</span><span className={'status ' + item.status}>{item.status === 'published' ? 'Publicada' : 'Borrador'}</span></div><h3>{item.title}</h3><p>{item.description || kinds.find(k => k.id === item.kind)?.detail}</p><div className="my-link">{publicUrl('e/' + item.slug)}</div><div className="my-card-actions"><button onClick={() => openEntries(item)}>Ver respuestas</button><a href={'#/e/' + item.slug} target="_blank" rel="noreferrer">Abrir ↗</a></div></article>)}</div> : <div className="empty panel"><span>✧</span><h3>Este espacio está esperando tu primera idea.</h3><p>Crea una experiencia y comparte el enlace con tus personas favoritas.</p><Button onClick={() => setShowCreator(true)}>Crear mi primera experiencia</Button></div>}
      {selected && <section className="panel responses"><div className="responses-head"><div><div className="kicker">RESPUESTAS RECIBIDAS</div><h2>{selected.title}</h2></div><button className="close-small" onClick={() => setSelected(null)}>Cerrar ×</button></div>{entries.length ? entries.map(entry => <article className="entry" key={entry.id}><div><b>{entry.is_anonymous ? 'Anónimo' : entry.respondent_name || 'Participante'}</b><small>{new Date(entry.created_at).toLocaleString()}</small></div><pre>{JSON.stringify(entry.answers, null, 2)}</pre><button className="danger-link" onClick={() => removeEntry(entry.id)}>Eliminar respuesta</button></article>) : <p className="subtle">Todavía no hay respuestas para esta experiencia.</p>}</section>}
    </main>
    {showCreator && <Creator user={user} close={() => setShowCreator(false)} created={async () => { setShowCreator(false); setSuccess('Tu experiencia ya está creada.'); await load(); }}/>}
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
    { title: '¿Quién es más lindo?', prompts: ['Elige tu favorito'] },
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
    setPrompts(['']); setOptions(['Opción 1', 'Opción 2']); setImageFiles([null, null]);
    setStep(2); setError('');
  }
  function chooseTemplate(index) {
    setTemplate(index);
    if (index === -1) { setTitle(''); setPrompts(['']); }
    else {
      const preset = creatorTemplates[kind][index];
      setTitle(preset.title); setPrompts(preset.prompts);
    }
    setStep(3);
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error('Escribe un título para tu juego.');
      const cleanPrompts = prompts.map(x => x.trim()).filter(Boolean);
      if (!cleanPrompts.length) throw new Error('Añade al menos una pregunta.');
      if (kind === 'comparison' && imageFiles.filter(Boolean).length < 2) throw new Error('Añade las dos imágenes para crear la comparativa.');
      if (needsOptions && options.filter(x => x.trim()).length < 2) throw new Error('Añade al menos dos opciones.');
      const slug = makeSlug(cleanTitle) + '-' + crypto.randomUUID().slice(0, 6);
      const { data: ex, error: ee } = await supabase.from('experiences').insert({
        owner_id: user.id, slug, kind, title: cleanTitle, description: description.trim(),
        status: publish ? 'published' : 'draft', is_public: true,
        settings: { allow_anonymous: anonymous, template: template === -1 ? 'custom' : String(template) }
      }).select().single();
      if (ee) throw ee;
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
        options: questionOptions, media: []
      }));
      const { error: qe } = await supabase.from('experience_questions').insert(questionRows);
      if (qe) throw qe;
      await created();
    } catch (e1) { setError(e1.message || 'No se pudo crear.'); }
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
        <label>Título del juego<input required maxLength="90" value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'comparison' ? 'Ej. ¿Quién es más lindo?' : kind === 'confession' ? 'Ej. Déjame una confesión' : 'Ej. ¿Qué tanto me conoces?'}/></label>
        <label>Descripción<textarea maxLength="240" value={description} onChange={e => setDescription(e.target.value)} placeholder="Explica brevemente de qué trata…"/></label>
        <div className="field-group"><span className="field-title">{kind === 'confession' ? 'Mensaje que verá quien participe' : kind === 'comparison' ? 'Pregunta para votar' : 'Preguntas del juego'}</span>
          {prompts.map((value,index) => <div className="question-edit" key={index}><input required maxLength="180" value={value} onChange={e => setPrompts(v => v.map((x,i) => i === index ? e.target.value : x))} placeholder={kind === 'confession' ? 'Escribe aquí lo que quieras compartir…' : kind === 'comparison' ? 'Ej. ¿Cuál de estas opciones prefieres?' : 'Pregunta ' + (index+1)}/>{prompts.length > 1 && kind === 'know_me' && <button type="button" className="remove-question" onClick={() => setPrompts(v => v.filter((_,i) => i !== index))}>Quitar</button>}</div>)}
          {kind === 'know_me' && prompts.length < 15 && <button type="button" className="add-option" onClick={() => setPrompts(v => [...v,''])}>＋ Añadir pregunta</button>}
        </div>
        {needsOptions && <div className="options-editor"><b>{kind === 'comparison' ? 'Opciones e imágenes' : 'Respuestas posibles'}</b>{options.map((op,i) => <div className="option-edit" key={i}><input required value={op} onChange={e => setOptions(v => v.map((x,j) => j === i ? e.target.value : x))} placeholder={kind === 'comparison' ? 'Nombre de la opción ' + (i+1) : 'Respuesta ' + (i+1)}/>{kind === 'comparison' && <label className="file-mini">Foto {i+1}<input required={i < 2 && !imageFiles[i]} type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={e => setImageFiles(v => v.map((x,j) => j === i ? e.target.files?.[0] || null : x))}/></label>}</div>)}{options.length < (kind === 'comparison' ? 6 : 8) && <button type="button" className="add-option" onClick={() => {setOptions(v => [...v,'']);setImageFiles(v => [...v,null]);}}>＋ Añadir opción personalizada</button>}</div>}
        <label className="check-row"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)}/> Permitir participación anónima</label>
        <label className="check-row"><input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)}/> Publicar al crear</label>
        <p className="tiny-note">Las confesiones solo serán visibles en tu panel privado. No publiques datos personales de otras personas sin su permiso.</p>
        <Notice error={error}/>
        <Button disabled={busy}>{busy ? 'Creando…' : publish ? 'Crear y publicar ↗' : 'Guardar borrador'}</Button>
      </form>
    </>}
  </section></div>;
}

function PublicProfile({ username, openAuth }) {
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let live = true; (async () => { const { data: p } = await supabase.from('profiles').select('username,display_name,bio,avatar_url,is_public').eq('username', username.toLowerCase()).maybeSingle(); if (!p?.is_public) { if (live) setLoading(false); return; } const { data: ex } = await supabase.from('experiences').select('id,slug,kind,title,description,created_at').eq('owner_id', (await supabase.from('profiles').select('id').eq('username', username.toLowerCase()).single()).data?.id).eq('status','published').eq('is_public',true).order('created_at',{ascending:false}); if (live) { setProfile(p); setItems(ex || []); setLoading(false); } })(); return () => { live = false; }; }, [username]);
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
  useEffect(() => { let live = true; (async () => { const { data: ex } = await supabase.from('experiences').select('*').eq('slug', slug).eq('is_public',true).eq('status','published').maybeSingle(); if (!ex) { if (live) setItem(false); return; } const [{ data: qs }, { data: p }] = await Promise.all([supabase.from('experience_questions').select('*').eq('experience_id',ex.id).order('position'),supabase.from('profiles').select('username,display_name').eq('id',ex.owner_id).maybeSingle()]); if (live) { setItem(ex); setQuestions(qs || []); setOwner(p); } })(); return () => { live = false; }; }, [slug]);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (!supabase || !item) throw new Error('No se pudo conectar con esta experiencia.');
      const missing = questions.find(q => !String(answers[q.id] || '').trim());
      if (missing) throw new Error('Responde la pregunta antes de enviar.');
      const { error: e1 } = await supabase.from('experience_entries').insert({ experience_id: item.id, respondent_name: anonymous ? null : name.trim(), is_anonymous: anonymous, answers });
      if (e1) throw e1; setSuccess(true);
    } catch (e1) { setError(e1.message); } finally { setBusy(false); }
  }
  if (item === null) return <PublicShell><div className="panel">Cargando experiencia…</div></PublicShell>;
  if (item === false) return <PublicShell><div className="panel empty"><h2>Este enlace no está disponible.</h2><a href={BASE}>Volver al inicio</a></div></PublicShell>;
  return <PublicShell><section className="experience-public panel"><div className="kicker">{kinds.find(k => k.id === item.kind)?.short.toUpperCase()}</div><h1>{item.title}</h1><p className="subtle">{item.description}</p>{owner && <a className="owner-link" href={'#/u/' + owner.username}>Creado por {owner.display_name} · @{owner.username}</a>}
    {success ? <div className="success-screen"><span>✓</span><h2>¡Respuesta enviada!</h2><p>Gracias por participar. Tu respuesta llegó a su creador.</p></div> : <form className="form response-form" onSubmit={submit}>{questions.map(q => <div className="question-block" key={q.id}><h3>{q.prompt}</h3>{q.answer_type === 'text' ? <textarea required maxLength="1000" value={answers[q.id] || ''} onChange={e => setAnswers(v => ({...v,[q.id]:e.target.value}))} placeholder="Escribe tu mensaje…"/> : <div className="answer-options">{(q.options || []).map((op,i) => <label className={'answer-option ' + (answers[q.id] === op.label ? 'chosen' : '')} key={i}><input type="radio" name={q.id} checked={answers[q.id] === op.label} onChange={() => setAnswers(v => ({...v,[q.id]:op.label}))}/>{op.image_url && <img src={op.image_url} alt={op.label}/>}<span>{op.label}</span></label>)}</div>}</div>)}
      <label className="check-row"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)}/> Enviar de forma anónima</label>{!anonymous && <label>Tu nombre<input required value={name} onChange={e => setName(e.target.value)} maxLength="60" placeholder="Cómo quieres aparecer"/></label>}<Notice error={error}/><Button disabled={busy}>{busy ? 'Enviando…' : 'Enviar respuesta ↗'}</Button><p className="tiny-note">No necesitas crear una cuenta para participar. Comparte solo información que te sientas cómodo enviando.</p></form>}
  </section><JoinCTA openAuth={openAuth}/></PublicShell>;
}

function PublicShell({ children }) { return <div className="public-shell"><header className="topbar wrap"><Brand/><a className="text-link" href={BASE}>Descubrir Interacción ↗</a></header><main className="public-main wrap">{children}</main><footer className="footer wrap"><Brand/><span>Hecho para conectar.</span><a href={BASE}>Crear mi espacio ↗</a></footer></div>; }
function JoinCTA({ openAuth }) { return <section className="join-cta panel"><div><div className="kicker">¿TE GUSTARÍA TENER EL TUYO?</div><h2>Ahora crea tu propio espacio.</h2><p className="subtle">Diseña preguntas y experiencias para compartir con tus amigos.</p></div><Button onClick={openAuth}>Crear mi cuenta ↗</Button></section>; }

export default App;
