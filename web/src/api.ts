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
    // Le cookie de session part tout seul (même adresse) ; il n'est pas lisible par la page.
    headers: corps ? { 'content-type': 'application/json' } : {},
    body: corps ? JSON.stringify(corps) : undefined,
  });
  if (reponse.status === 401 && chemin !== '/connexion' && chemin !== '/installation') {
    window.dispatchEvent(new Event('session-expiree'));
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
