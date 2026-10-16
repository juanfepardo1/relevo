import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase, must, type Row } from './supabase';

export type Etapa = { pipeline: 'vendedor' | 'comprador'; codigo: string; nombre: string; orden: number; fase: string; sla_dias: number | null; terminal: boolean };
export type Miembro = { email: string; nombre: string; apodo: string | null; socio: string | null; es_admin?: boolean; activo?: boolean };

type Cat = { etapas: Etapa[]; equipo: Miembro[]; yo: Miembro | undefined; etapasDe: (p: 'vendedor' | 'comprador') => Etapa[]; nombreEtapa: (p: 'vendedor' | 'comprador', c: string) => string };
const Ctx = createContext<Cat>({ etapas: [], equipo: [], yo: undefined, etapasDe: () => [], nombreEtapa: (_p, c) => c });

export function CatalogoProvider({ children, email }: { children: ReactNode; email: string }) {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [equipo, setEquipo] = useState<Miembro[]>([]);
  useEffect(() => {
    supabase.from('etapas').select('*').order('orden').then(({ data }) => setEtapas((data as Etapa[]) || []));
    supabase.from('equipo').select('*').eq('activo', true).then(({ data }) => setEquipo((data as Miembro[]) || []));
  }, []);
  const etapasDe = useCallback((p: 'vendedor' | 'comprador') => etapas.filter((e) => e.pipeline === p), [etapas]);
  const nombreEtapa = useCallback((p: 'vendedor' | 'comprador', c: string) => etapas.find((e) => e.pipeline === p && e.codigo === c)?.nombre ?? c, [etapas]);
  const yo = equipo.find((m) => m.email === email.toLowerCase());
  return <Ctx.Provider value={{ etapas, equipo, yo, etapasDe, nombreEtapa }}>{children}</Ctx.Provider>;
}
export const useCatalogo = () => useContext(Ctx);

/** Carga simple con recarga manual. */
export function useQuery<T = Row[]>(fn: () => PromiseLike<{ data: any; error: any }>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(deps);
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    // Solo muestra "cargando" la primera vez o si cambia lo que se pide. Al recargar tras guardar, deja los datos en pantalla.
    if (lastKey.current !== key) { setLoading(true); setData(null); lastKey.current = key; }
    must(fn()).then(
      (d) => { if (alive) { setData(d as T); setError(null); setLoading(false); } },
      (e) => { if (alive) { setError(e.message); setLoading(false); } },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData };
}

export async function guardar(tabla: string, id: string, cambios: Row, key = 'id') {
  return must(supabase.from(tabla).update(cambios).eq(key, id).select().single());
}
