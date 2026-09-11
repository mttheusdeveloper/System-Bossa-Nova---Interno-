import { useState, type FormEvent } from 'react';
import { useAuth } from '../../state/AuthContext';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) setError(error);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-0)' }}>
      <div className="card w-full max-w-sm p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="brand-logo-box" style={{ width: 56, height: 56, flex: '0 0 56px' }}>
            <img src="/assets/logo-bossa.png" alt="Logo Bossa Nova" style={{ width: 38, height: 44 }} />
          </div>
          <div>
            <div className="brand-name">Bossa Nova</div>
            <div className="brand-subtitle">Finance OS</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="kpi-label">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              className="w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="kpi-label">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              className="w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-[#F87171]">{error}</p>}
          <button type="submit" className="chip-btn active w-full justify-center h-10" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
