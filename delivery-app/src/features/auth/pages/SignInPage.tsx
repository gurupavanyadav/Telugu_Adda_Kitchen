import { useState } from 'react';
import { Mail, Lock, UtensilsCrossed, AlertCircle } from 'lucide-react';
import { useAuth } from '@/features/auth/context/auth';
import { navigate } from '@/lib/router';

export function SignInPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) { setError(error); } else { navigate('/'); }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-cream-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary-700 text-gold-300 mb-4">
            <UtensilsCrossed className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-charcoal-900">Welcome back</h1>
          <p className="text-charcoal-500 text-sm mt-1">Sign in to order and track your meals</p>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-400" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="input pl-10" />
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-400" />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className="input pl-10" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Signing in...' : 'Sign In'}</button>
          <p className="text-center text-sm text-charcoal-500">New here? <button type="button" onClick={() => navigate('/signup')} className="font-semibold text-primary-700 hover:underline">Create an account</button></p>
        </form>
      </div>
    </div>
  );
}