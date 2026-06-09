# EnjoyYourScan

Plateforme de commande par QR code pour restaurants. Les clients scannent le QR code de leur table, consultent le menu et passent commande directement depuis leur smartphone. Les commandes apparaissent en temps réel sur l'écran cuisine (KDS) et dans le dashboard restaurant.

## Stack technique

| Outil | Version | Rôle |
|---|---|---|
| Next.js | 14 (App Router) | Framework React SSR/SSG |
| TypeScript | 5 | Typage statique |
| TailwindCSS | 3 | Styles utilitaires |
| shadcn/ui | 2.x | Composants UI accessibles |
| Supabase | — | Base de données, Auth, Realtime |
| next-pwa | latest | Progressive Web App |

---

## Structure des dossiers

```
EnjoyYourScan/
├── app/                          # Routes Next.js App Router
│   ├── layout.tsx                # Layout racine (métadonnées PWA, polices)
│   ├── page.tsx                  # Page d'accueil / sélecteur de rôle
│   │
│   ├── (client)/                 # Interface client (scan QR → menu → commande)
│   │   ├── layout.tsx            # Layout mobile centré (max-w-lg)
│   │   ├── page.tsx              # Page d'accueil client
│   │   └── menu/
│   │       └── [restaurantSlug]/ # Menu dynamique par restaurant
│   │           └── page.tsx
│   │
│   ├── (dashboard)/              # Espace restaurant
│   │   ├── layout.tsx            # Sidebar + contenu
│   │   └── dashboard/
│   │       └── page.tsx          # Vue d'ensemble : commandes, stats, tables
│   │
│   ├── (kitchen)/                # Écran cuisine KDS (Kitchen Display System)
│   │   ├── layout.tsx            # Fond sombre plein écran
│   │   └── kitchen/
│   │       └── page.tsx          # Grille des tickets en temps réel
│   │
│   └── (admin)/                  # Super-admin (gestion multi-restaurants)
│       ├── layout.tsx            # Sidebar admin sombre
│       └── admin/
│           └── page.tsx          # Liste restaurants, utilisateurs, stats globales
│
├── components/                   # Composants React partagés
│   └── ui/                       # Composants shadcn/ui (Button, Card, …)
│
├── lib/                          # Utilitaires et clients
│   ├── utils.ts                  # cn() helper (clsx + tailwind-merge)
│   ├── supabase.ts               # Client Supabase côté navigateur
│   └── supabase-server.ts        # Client Supabase côté serveur (RSC)
│
├── types/                        # Types TypeScript partagés
│   └── index.ts                  # Restaurant, Table, MenuItem, Order, …
│
├── public/                       # Assets statiques
│   ├── manifest.json             # Web App Manifest (PWA)
│   ├── sw-custom.js              # Logique service worker personnalisée
│   └── icons/                    # Icônes PWA (192×192, 512×512)
│
├── components.json               # Configuration shadcn/ui
├── tailwind.config.ts            # Thème Tailwind + variables CSS shadcn
├── next.config.mjs               # Config Next.js + next-pwa
└── .env.local                    # Variables d'environnement (non versionné)
```

---

## Routes

| URL | Section | Description |
|---|---|---|
| `/` | Accueil | Sélecteur de rôle / landing |
| `/menu/[restaurantSlug]?table=X` | Client | Menu restaurant + panier |
| `/dashboard` | Restaurant | Tableau de bord gérant |
| `/kitchen` | Cuisine | KDS temps réel |
| `/admin` | Super-admin | Gestion globale |

---

## Variables d'environnement

Créer un fichier `.env.local` à la racine :

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

---

## PWA

La configuration PWA est gérée par **next-pwa** :

- Le service worker est généré automatiquement à la compilation (`public/sw.js`).
- `public/manifest.json` déclare le nom, les couleurs et les icônes de l'app.
- `public/sw-custom.js` contient la logique de push notifications personnalisée.
- En développement, le service worker est **désactivé** (`disable: process.env.NODE_ENV === 'development'`).

Pour ajouter les icônes, placer `icon-192x192.png` et `icon-512x512.png` dans `public/icons/`.

---

## Démarrage rapide

```bash
# Installer les dépendances
npm install

# Démarrer en développement
npm run dev

# Build de production
npm run build

# Lancer en production (service worker actif)
npm start
```

---

## Ajouter un composant shadcn/ui

```bash
npx shadcn@2.6.0 add <component-name>
# exemple : npx shadcn@2.6.0 add dialog
```

Les composants sont placés dans `components/ui/`.
