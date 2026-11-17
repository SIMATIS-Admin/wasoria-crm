const CLE = 'wasoria-crm-jeton';

export const lireJeton = (): string | null => {
  try {
    return sessionStorage.getItem(CLE);
  } catch {
    return null;
  }
};
export const poserJeton = (jeton: string | null) => {
  try {
    if (jeton) sessionStorage.setItem(CLE, jeton);
    else sessionStorage.removeItem(CLE);
  } catch {
    // stockage indisponible : le jeton ne survit pas au rechargement, rien de plus
  }
};

export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

export async function appel<T>(
  methode: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  chemin: string,
  corps?: object,
): Promise<T> {
  const reponse = await fetch(`/api${chemin}`, {
    method: methode,
    headers: {
      authorization: `Bearer ${lireJeton() ?? ''}`,
      ...(corps ? { 'content-type': 'application/json' } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  if (reponse.status === 401) {
    poserJeton(null);
    window.dispatchEvent(new Event('jeton-refuse'));
  }
  if (!reponse.ok) {
    const json = (await reponse.json().catch(() => ({}))) as {
      erreur?: string;
      details?: string[];
    };
    throw new ErreurApi(reponse.status, json.erreur ?? `Erreur ${reponse.status}`, json.details);
  }
  return reponse.status === 204 ? (undefined as T) : ((await reponse.json()) as T);
}

export const lire = <T>(chemin: string) => appel<T>('GET', chemin);
