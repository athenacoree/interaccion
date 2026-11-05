import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const experiences = [
  { kind: 'know_me', number: '01', icon: '✦', title: '¿Qué tanto me conoces?', text: 'Descubre quién conoce tus gustos, tus manías y esas pequeñas cosas que te hacen ser tú.', tag: 'El reto personal', color: 'violet' },
  { kind: 'confession', number: '02', icon: '✉', title: 'Secretos y confesiones', text: 'Abre un espacio para pensamientos, mensajes y confesiones. Tú decides cómo recibirlos.', tag: 'Sin filtros, con respeto', color: 'rose' },
  { kind: 'comparison', number: '03', icon: '◈', title: 'Cara a cara', text: 'Pon dos fotos frente a frente, escribe tu pregunta y deja que las personas elijan.', tag: 'La comunidad decide', color: 'blue' },
];

function Stars() {
  return <div className="stars" aria-hidden="true"><span className="star-layer star-one"/><span className="star-layer star-two"/><span className="shooting-star"/></div>;
}

function AuthDialog({ onClose, onSignedIn }) {
  const [mode, setMode] = useState('signup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });

  const change = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (!supabase) { setError('Falta configurar la conexión de Supabase en las variables de entorno.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'signup') {
        const username = form.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (username.length < 3) throw new Error('El usuario debe tener al menos 3 caracteres.');
        const { data, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { display_name: form.name.trim(), username } } });
        if (authError) throw authError;
        if (data.session && data.user) {
          const { error: profileError } = await supabase.from('profiles').insert({ id: data.user.id, username, display_name: form.name.trim() });
          if (profileError) throw profileError;
          onSignedIn(data.user);
        } else {
          setMessage('Revisa tu correo para confirmar la cuenta. Después podrás completar tu perfil.');
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (authError) throw authError;
        onSignedIn(data.user);
      }
    } catch (e) { setError(e.message || 'No se pudo completar la operación.'); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
      <div className="eyebrow">TU ESPACIO TE ESPERA</div>
      <h2 id="auth-title">{mode === 'signup' ? 'Empieza tu historia' : 'Qué bueno verte'}</h2>
      <p className="muted">{mode === 'signup' ? 'Crea tu cuenta y consigue tus propios enlaces para compartir.' : 'Entra para administrar tus experiencias.'}</p>
      <form onSubmit={submit} className="auth-form">
        {mode === 'signup' && <>
          <label>Cómo te llamas<input required maxLength="60" value={form.name} onChange={change('name')} placeholder="Tu nombre" /></label>
          <label>Tu identificador<input required minLength="3" maxLength="24" pattern="[A-Za-z0-9_]+" value={form.username} onChange={change('username')} placeholder="tu_usuario" /></label>
        </>}
        <label>Correo electrónico<input required type="email" value={form.email} onChange={change('email')} placeholder="hola@ejemplo.com" /></label>
        <label>Contraseña<input required minLength="8" type="password" value={form.password} onChange={change('password')} placeholder="Mínimo 8 caracteres" /></label>
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        <button className="button button-primary full" disabled={busy}>{busy ? 'Un momento…' : mode === 'signup' ? 'Crear mi cuenta ↗' : 'Iniciar sesión ↗'}</button>
      </form>
      <p className="switch-auth">{mode === 'signup' ? '¿Ya tienes cuenta?' : '¿Todavía no tienes cuenta?'} <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setMessage(''); }}>{mode === 'signup' ? 'Inicia sesión' : 'Crear cuenta'}</button></p>
    </section>
  </div>;
}

function Dashboard({ user, onSignOut }) {
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: p }, { data: ex }] = await Promise.all([
        supabase.from('profiles').select('username,display_name').eq('id', user.id).maybeSingle(),
        supabase.from('experiences').select('id,slug,kind,title,status,is_public,created_at').eq('owner_id', user.id).order('created_at', { ascending: false })
      ]);
      if (active) { setProfile(p); setItems(ex || []); setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [user.id]);
  return <main className="dashboard-shell">
    <header className="dash-top"><a className="brand" href="/"><span className="brand-mark">i.</span> interacción</a><button className="button button-quiet" onClick={onSignOut}>Cerrar sesión</button></header>
    <section className="dash-welcome"><div className="eyebrow">TU UNIVERSO</div><h1>Hola{profile?.display_name ? ', ' + profile.display_name : ''}.</h1><p className="muted">Aquí viven tus enlaces, tus ideas y las respuestas de tu gente.</p><div className="profile-link">interaccion.app/@{profile?.username || 'configura-tu-usuario'}</div></section>
    <section className="dash-section"><div className="section-heading"><div><div className="eyebrow">TU CONTENIDO</div><h2>Tus experiencias</h2></div></div>
      {loading ? <p className="muted">Cargando tu espacio…</p> : items.length ? <div className="experience-list">{items.map(x => <article className="experience-row" key={x.id}><div><strong>{x.title}</strong><small>{x.kind} · {x.status === 'published' ? 'Publicado' : 'Borrador'}</small></div><span className="muted">/{x.slug}</span></article>)}</div> : <div className="empty-state"><span>✧</span><h3>Tu primera experiencia empieza aquí</h3><p className="muted">Estamos preparando el creador para que diseñes tus preguntas, confesiones y comparativas.</p></div>}
    </section>
  </main>;
}

function App() {
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [activeKind, setActiveKind] = useState('all');

  useEffect(() => {
    if (!supabase) { setSessionReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setSessionReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => listener.subscription.unsubscribe();
  }, []);

  const visible = useMemo(() => activeKind === 'all' ? experiences : experiences.filter(x => x.kind === activeKind), [activeKind]);

  async function signOut() { await supabase?.auth.signOut(); setUser(null); }
  if (!sessionReady) return <div className="loading-screen"><span className="brand-mark">i.</span><p>Preparando tu universo…</p></div>;
  if (user) return <Dashboard user={user} onSignOut={signOut} />;

  return <div className="site-shell">
    <Stars />
    <nav className="nav wrap"><a className="brand" href="#"><span className="brand-mark">i.</span> interacción</a><div className="nav-links"><a href="#experiencias">Experiencias</a><a href="#como-funciona">Cómo funciona</a></div><button className="button button-outline" onClick={() => setAuthOpen(true)}>Entrar <span>↗</span></button></nav>
    <main>
      <section className="hero wrap">
        <div className="hero-copy"><div className="eyebrow"><span className="live-dot"/> UN LUGAR PARA CONECTAR DE VERDAD</div><h1>Hay cosas que<br/>solo pasan cuando<br/><em>interactuamos.</em></h1><p className="hero-text">Crea preguntas, descubre secretos y deja que todos elijan. Comparte momentos que hacen que las personas se conozcan de otra manera.</p><div className="hero-actions"><button className="button button-primary" onClick={() => setAuthOpen(true)}>Crear mi espacio <span>↗</span></button><a className="text-link" href="#experiencias">Explorar experiencias <span>↓</span></a></div><div className="hero-note"><span className="avatars"><i>✦</i><i>♡</i><i>◈</i></span><span>Tu enlace. Tus reglas. Tu gente.</span></div></div>
        <div className="hero-art"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="planet"><div className="planet-glow"/><span>i.</span></div><div className="float-card float-card-one"><span>✦</span><div><b>¿Cuánto me conoces?</b><small>Una pregunta puede decir mucho</small></div></div><div className="float-card float-card-two"><span>♡</span><div><b>Vota por tu favorita</b><small>Dos opciones, una decisión</small></div></div><div className="tiny-star star-a">✧</div><div className="tiny-star star-b">✦</div><div className="tiny-star star-c">·</div></div>
      </section>
      <section className="experience-section wrap" id="experiencias"><div className="section-heading"><div><div className="eyebrow">UN UNIVERSO DE POSIBILIDADES</div><h2>¿Qué quieres descubrir?</h2></div><p className="muted heading-note">Elige una experiencia y hazla tuya.</p></div>
        <div className="filters"><button className={activeKind === 'all' ? 'filter active' : 'filter'} onClick={() => setActiveKind('all')}>Todas</button><button className={activeKind === 'know_me' ? 'filter active' : 'filter'} onClick={() => setActiveKind('know_me')}>Conóceme</button><button className={activeKind === 'confession' ? 'filter active' : 'filter'} onClick={() => setActiveKind('confession')}>Confesiones</button><button className={activeKind === 'comparison' ? 'filter active' : 'filter'} onClick={() => setActiveKind('comparison')}>Comparativas</button></div>
        <div className="experience-grid">{visible.map(x => <article className={'experience-card '+x.color} key={x.kind}><div className="card-top"><span className="card-number">{x.number} / 03</span><span className="card-icon">{x.icon}</span></div><div className="card-content"><span className="card-tag">{x.tag}</span><h3>{x.title}</h3><p>{x.text}</p><button className="card-action" onClick={() => setAuthOpen(true)}>Crear experiencia <span>↗</span></button></div><div className="card-decoration"/></article>)}</div>
      </section>
      <section className="how-section wrap" id="como-funciona"><div className="eyebrow">ASÍ DE SENCILLO</div><h2>De una idea a un enlace<br/><em>que todos quieren abrir.</em></h2><div className="steps"><div><span>01</span><h3>Crea</h3><p>Diseña una experiencia con tus preguntas, fotos y opciones.</p></div><div><span>02</span><h3>Comparte</h3><p>Obtén un enlace propio. Cualquiera podrá entrar sin registrarse.</p></div><div><span>03</span><h3>Descubre</h3><p>Recibe respuestas y revisa los resultados desde tu panel.</p></div></div></section>
      <section className="final-cta wrap"><div className="cta-spark">✧</div><div className="eyebrow">TU HISTORIA EMPIEZA AQUÍ</div><h2>¿Y si hoy descubres<br/><em>algo nuevo?</em></h2><p className="muted">Crea tu espacio y comparte tu primer enlace.</p><button className="button button-primary" onClick={() => setAuthOpen(true)}>Quiero empezar <span>↗</span></button></section>
    </main>
    <footer className="footer wrap"><a className="brand" href="#"><span className="brand-mark">i.</span> interacción</a><span>Hecho para conectar ✦</span><button onClick={() => setAuthOpen(true)}>Crea tu cuenta</button></footer>
    {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onSignedIn={(nextUser) => { setUser(nextUser); setAuthOpen(false); }} />}
  </div>;
}

export default App;
