import { useState } from 'react'
import { supabase } from './supabaseClient'
import { Activity } from 'lucide-react'

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signUpDone, setSignUpDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (error) alert(error.error_description || error.message)
    else if (isSignUp) setSignUpDone(true)

    setLoading(false)
  }

  const toggleMode = () => {
    setIsSignUp((v) => !v)
    setSignUpDone(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--k-ink)] text-[var(--k-text)] px-4">
      <div className="w-full max-w-md p-8 bg-[var(--k-surface)] border border-[var(--k-line)] rounded-3xl shadow-2xl">
        <h1 className="font-display text-2xl font-bold mb-1 text-[var(--k-text)] text-center flex items-center justify-center gap-2">
          <Activity className="w-6 h-6 text-indigo-400" /> Kinetix
        </h1>
        <p className="text-[var(--k-text-4)] text-center mb-6 text-sm">
          {isSignUp ? 'Crea un account per gestire la tua energia' : 'Accedi per gestire la tua energia'}
        </p>

        {signUpDone ? (
          <p className="text-center text-sm text-[var(--k-text-2)] py-4">
            Controlla la tua email per confermare l'account, poi torna qui e accedi.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="La tua email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="p-3 rounded-xl bg-[var(--k-ink)] text-[var(--k-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="p-3 rounded-xl bg-[var(--k-ink)] text-[var(--k-text)] focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
            />

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Caricamento...' : isSignUp ? 'Registrati' : 'Accedi'}
            </button>
          </form>
        )}

        <button onClick={toggleMode} className="w-full text-center text-sm text-[var(--k-text-4)] hover:text-[var(--k-text-2)] mt-5">
          {isSignUp ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
        </button>

        {!isSignUp && <p className="text-[var(--k-text-5)] text-xs text-center mt-4">Resterai connesso su questo dispositivo dopo il primo accesso.</p>}
      </div>
    </div>
  )
}
