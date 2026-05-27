# RGE Pilot - Suivi des Certifications RGE

SaaS pour artisans certifies RGE (Reconnu Garant de l Environnement). Pilotez vos certifications, anticipez les echeances, generez vos documents de conformite.

## Stack

- Next.js 14 (App Router)
- PostgreSQL + Prisma
- Stripe (abonnements)
- AWS S3 (stockage documents)
- Puppeteer (generation PDF avancee)
- XLSX (export Excel)
- Nodemailer (alertes email)
- Tailwind CSS + Zod

## Fonctionnalites

- Tableau de bord certifications : RGE QualiPAC, QualiSOL, RGE Qualibat..
- Alertes automatiques avant expiration (90j, 30j, 7j)
- Suivi des formations obligatoires et heures CPF
- Stockage documents sur AWS S3 (certificats, attestations)
- Generation PDF de rapports de conformite via Puppeteer
- Export Excel du portefeuille de certifications
- Historique complet des renouvellements

## Demarrage

bash
npm install
npx prisma migrate dev
npm run dev


Variables requises : DATABASE_URL, STRIPE_SECRET_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET