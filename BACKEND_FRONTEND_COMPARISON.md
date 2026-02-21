# Comparaison Compatibilite Frontend vs Backend (Spring Boot)

Date: 2026-02-19
Source backend: spec endpoints fournie (contrat officiel)
Projet frontend analyse: `invoices-frontend`

## Resume executif

Verdict: **integration non compatible en l'etat**.

Decision recommandee:
- **Changer principalement le frontend** (fortement recommande).
- Changer le backend seulement pour 2 points de confort (voir section "Ajustements backend optionnels").

Principales causes:
1. Le frontend actif utilise majoritairement `lib/api.ts` qui ne gere pas le wrapper `{ success, data }`.
2. Le frontend est encore mappe sur des statuts legacy (`pending`, `treated`, `error`, etc.) au lieu de `VERIFY`, `READY_TO_TREAT`, `READY_TO_VALIDATE`, `VALIDATED`, `REJECTED`.
3. L'upload frontend n'envoie pas `dossierId`.
4. Le flux auth frontend attend un format de login different de celui fourni.
5. Le mode mock est force (`USE_MOCK = true`), donc integration reelle desactivee.

---

## 1) Compatibilite endpoint par endpoint

| Endpoint backend | Contrat backend | Frontend actuel | Etat | Action |
|---|---|---|---|---|
| `POST /api/auth/login` | `data: { token, userId, email, role }` | `AuthService` attend `{ token, user }` | Incompatible | Adapter frontend (mapper data -> user local) ou ajouter `user` cote backend |
| `GET /api/auth/me` | non documente dans ta spec | Frontend appelle `/api/auth/me` | Incompatible | Ajouter endpoint backend **ou** arreter de l'appeler et reconstruire user depuis token/login |
| `POST /api/dossiers` | body `{ nom, fournisseurEmail }` | UI dossiers utilise encore mocks, formulaire local non aligne | Incompatible | Implementer service dossier reel + payload backend |
| `GET /api/dossiers` | `data.dossiers[]` | UI dossiers lit mock local | Incompatible | Brancher UI sur API reelle |
| `DELETE /api/dossiers/{id}` | `data.deleted` | appel present, retour peu exploite | Partiel | OK endpoint, juste harmoniser parsing envelope |
| `POST /api/dynamic-invoices/upload` | multipart `file` + `dossierId` (obligatoire role) | envoie seulement `file` | Incompatible | Ajouter `dossierId` dans formulaire et API call |
| `GET /api/dynamic-invoices/{id}` | reponse enveloppee `data` | `lib/api.ts` lit souvent objet brut | Incompatible | Unwrapper `data` partout ou migrer vers client axios standardise |
| `GET /api/dynamic-invoices?status&limit` | `data.invoices[]` | `lib/api.ts` lit `data.invoices` sans wrapper | Incompatible | Lire `response.data.invoices` (apres unwrap) |
| `PUT /api/dynamic-invoices/{id}/status` | `VERIFY -> READY_TO_TREAT` | UI envoie parfois `pending` | Incompatible | Envoyer uniquement `READY_TO_TREAT` |
| `POST /api/dynamic-invoices/{id}/process` | retourne statut backend | UI logique basee statuts legacy | Partiel/Incompatible | Mapper statuts backend dans UI |
| `POST /api/dynamic-invoices/process-bulk` | present | non implemente UI | Manquant | ajouter fonctionnalite UI si necessaire |
| `POST /api/dynamic-invoices/reprocess-bulk` | present | non implemente UI | Manquant | ajouter fonctionnalite UI si necessaire |
| `PUT /api/dynamic-invoices/{id}/fields` | interdit fournisseur | UI doit masquer/bloquer edition fournisseur | Partiel | appliquer regles role strictes cote UI |
| `POST /api/dynamic-invoices/{id}/link-tier` | present | present mais parsing legacy | Partiel | harmoniser parsing + permissions |
| `POST /api/dynamic-invoices/{id}/validate` | retourne facture `data` | frontend attend parfois `{ message, invoice }` | Incompatible | adapter type/handler frontend |
| `DELETE /api/dynamic-invoices/{id}` | interdit selon statut/role | UI affiche action delete trop large | Partiel/Incompatible | conditionner action delete selon role+statut backend |
| `GET /api/dynamic-invoices/stats` | `verify, readyToTreat, ...` | UI/stats legacy | Partiel/Incompatible | mapper champs stats backend |
| `PUT /api/admin/reset-password` | present | pas de consommation visible cote UI | Manquant | implementer page/service admin si requis |

---

## 2) Incompatibilites critiques (bloquantes)

1. **Wrapper de reponse non gere globalement**
- Backend renvoie toujours `{ success, data, timestamp }`.
- `lib/api.ts` renvoie souvent `response.json()` direct sans extraire `data`.
- Resultat: objets inattendus dans UI.

2. **Auth contract mismatch**
- Login backend ne renvoie pas `user` complet.
- Frontend construit son contexte avec `response.user`.

3. **Statuts metier non alignes**
- Backend: `VERIFY`, `READY_TO_TREAT`, `READY_TO_VALIDATE`, `VALIDATED`, `REJECTED`.
- Frontend actif: `pending`, `processing`, `treated`, `ready_to_validate`, `error`, `to_verify`.

4. **Upload sans `dossierId`**
- Bloquant pour `COMPTABLE`/`FOURNISSEUR`.

5. **Mode mock force**
- `src/mock/data.mock.ts` contient `USE_MOCK = true`.

---

## 3) Qui doit changer quoi?

### A changer cote frontend (obligatoire)
1. Desactiver mock en runtime (env) et passer en mode API reel.
2. Migrer les ecrans utilises vers `src/api/api-client.ts` (interceptor JWT + unwrap).
3. Unifier enum de statuts sur ceux du backend.
4. Ajouter `dossierId` dans le flow upload.
5. Corriger confirmation fournisseur (`READY_TO_TREAT`).
6. Bloquer edition champs pour `FOURNISSEUR`.
7. Corriger types de retour (`validate`, `list`, `stats`, etc.).

### Ajustements backend optionnels (confort)
1. Ajouter `GET /api/auth/me` pour simplifier la session frontend.
2. Au login, optionnellement retourner aussi un objet `user` complet en plus des champs actuels.

---

## 4) Recommandation finale

Tu n'as pas besoin de revoir toute l'architecture backend: ta spec est propre et coherente.

La priorite est de **normaliser le frontend** autour de:
- un seul client API (`src/api/api-client.ts`),
- le contrat enveloppe backend,
- les statuts backend reels,
- les regles role+permissions backend.

Quand ces points sont faits, ton frontend sera compatible avec ton backend sans contournements.
