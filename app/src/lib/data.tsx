import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, must, type Row } from './supabase';

export type Etapa = { pipeline: 'vendedor' | 'comprador'; codigo: string; nombre: string; orden: number; fase: string; sla_dias: number | null; terminal: boolean };
export type Miembro = { email: string; nombre: string };

type Cat = { etapas: Etapa[]; equipo: Miembro[]; etapasDe: (p: 'vendedor' | 'comprador') => Etapa[]; nombreEtapa: (p: 'vendedor' | 'comprador', c: string) => string };
const Ctx = createContext<Cat>({ etapas: [], equipo: [], etapasDe: () => [], nombreEtapa: (_p, c) => c });

export function CatalogoProvider({ children }: { children: ReactNode }) {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [equipo, setEquipo] = useState<Miembro[]>([]);
  useEffect(() => {
    supabase.from('etapas').select('*').order('orden').then(({ data }) => setEtapas((data as Etapa[]) || []));
    supabase.from('equipo').select('email,nombre').eq('activo', true).then(({ data }) => setEquipo((data as Miembro[]) || []));
  }, []);
  const etapasDe = useCallback((p: 'vendedor' | 'comprador') => etapas.filter((e) => e.pipeline === p), [etapas]);
  const nombreEtapa = useCallback((p: 'vendedor' | 'comprador', c: string) => etapas.find((e) => e.pipeline === p && e.codigo === c)?.nombre ?? c, [etapas]);
  return <Ctx.Provider value={{ etapas, equipo, etapasDe, nombreEtapa }}>{children}</Ctx.Provider>;
}
export const useCatalogo = () => useContext(Ctx);

/** Carga simple con recarga manual. */
export function useQuery<T = Row[]>(fn: () => PromiseLike<{ data: any; error: any }>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    must(fn()).then(
      (d) => { if (alive) { setData(d as T); setError(null); setLoading(false); } },
      (e) => { if (alive) { setError(e.message); setLoading(false); } },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}

export async function guardar(tabla: string, id: string, cambios: Row, key = 'id') {
  return must(supabase.from(tabla).update(cambios).eq(key, id).select().single());
}
