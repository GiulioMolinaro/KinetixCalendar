import { BookOpen, Dumbbell, PenLine, Briefcase, User, Car } from 'lucide-react'

export const palette = [
  { id: 'indigo', hex: '#9a45f2', classes: 'bg-indigo-500/20 border-indigo-500/50 text-[var(--k-event-indigo-text)]', dot: 'bg-indigo-400' },
  { id: 'emerald', hex: '#34c266', classes: 'bg-emerald-500/20 border-emerald-500/50 text-[var(--k-event-emerald-text)]', dot: 'bg-emerald-400' },
  { id: 'amber', hex: '#e2a22b', classes: 'bg-amber-500/20 border-amber-500/50 text-[var(--k-event-amber-text)]', dot: 'bg-amber-400' },
  { id: 'rose', hex: '#ff6b5b', classes: 'bg-rose-500/20 border-rose-500/50 text-[var(--k-event-rose-text)]', dot: 'bg-rose-400' },
  { id: 'purple', hex: '#e14bd4', classes: 'bg-purple-500/20 border-purple-500/50 text-[var(--k-event-purple-text)]', dot: 'bg-purple-400' },
  { id: 'zinc', hex: '#8a7391', classes: 'bg-zinc-500/20 border-zinc-500/50 text-[var(--k-event-zinc-text)]', dot: 'bg-zinc-400' },
]

export const getColorClasses = (colorId) => (palette.find((p) => p.id === colorId) || palette[0]).classes
export const getColorHex = (colorId) => (palette.find((p) => p.id === colorId) || palette[0]).hex

// Deve corrispondere esattamente ai valori ammessi dal vincolo CHECK su events.category nel database.
export const categories = [
  { id: 'universita', label: 'Università', icon: BookOpen },
  { id: 'sport', label: 'Sport', icon: Dumbbell },
  { id: 'studio', label: 'Studio', icon: PenLine },
  { id: 'lavoro', label: 'Lavoro', icon: Briefcase },
  { id: 'personale', label: 'Personale', icon: User },
  { id: 'spostamento', label: 'Spostamento', icon: Car },
]

export const getCategory = (categoryId) => categories.find((c) => c.id === categoryId) || categories[categories.length - 1]

// Livello di carico energetico di una giornata, in base alla somma di energy_cost degli eventi.
export function getEnergyLevel(totalEnergy) {
  if (totalEnergy <= 0) return null
  if (totalEnergy <= 8) return { level: 'light', dot: 'bg-emerald-400', ring: 'border-emerald-400' }
  if (totalEnergy <= 14) return { level: 'moderate', dot: 'bg-amber-400', ring: 'border-amber-400' }
  return { level: 'heavy', dot: 'bg-rose-500', ring: 'border-rose-500' }
}

// Energia residua stimata di una giornata (100% = leggera, verso 0% = pesante),
// in stile "recovery" — carico massimo di riferimento: 20 punti (es. 4 eventi da 5).
const MAX_DAILY_ENERGY = 20
export function getEnergyRemaining(totalEnergy) {
  const pct = Math.max(0, Math.min(100, Math.round(100 - (totalEnergy / MAX_DAILY_ENERGY) * 100)))
  if (pct >= 67) return { pct, tier: 'light', color: '#4ade80', label: 'Leggera' }
  if (pct >= 34) return { pct, tier: 'moderate', color: '#f5b942', label: 'Equilibrata' }
  return { pct, tier: 'heavy', color: '#ff6b5b', label: 'Pesante' }
}
