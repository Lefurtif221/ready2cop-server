# Ready2Cop Server

Backend API pour la plateforme Ready2Cop.

## Deploy sur Render

1. Creer un compte sur [render.com](https://render.com)
2. New > Web Service
3. Connecter ton repo GitHub
4. Remplir :
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
5. Ajouter les variables d'environnement :
   - `DATABASE_URL` = ta connection string Neon
   - `JWT_SECRET` = un secret aleatoire
6. Deploy

## Variables d'environnement

Voir `.env.example` pour la liste des variables.

## Development

```bash
npm install
node index.js
```
