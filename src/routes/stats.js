// src/routes/stats.js - ROUTES DES STATISTIQUES AVANCÉES

const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

/**
 * @swagger
 * tags:
 *   name: Statistiques
 *   description: Endpoints d'agrégation avancée pour les statistiques produits
 */

/**
 * @swagger
 * /api/products/stats:
 *   get:
 *     summary: Récupère toutes les statistiques avancées des produits
 *     tags: [Statistiques]
 *     description: |
 *       Cet endpoint exécute plusieurs pipelines d'agrégation MongoDB pour répondre à différentes questions business.
 *       
 *       **Exercices inclus:**
 *       - 6.1: Statistiques globales par catégorie
 *       - 6.2: Distribution des prix par tranche
 *       - 6.3: Top 10 des marques
 *       - 6.4: Analyse des ratings
 *       - 6.5: Tendance des prix par catégorie
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     categoryStatistics:
 *                       type: object
 *                       description: Statistiques par catégorie (Exercice 6.1)
 *                     priceDistribution:
 *                       type: object
 *                       description: Distribution des prix (Exercice 6.2)
 *                     topBrands:
 *                       type: object
 *                       description: Top 10 des marques (Exercice 6.3)
 *                     ratingAnalysis:
 *                       type: object
 *                       description: Analyse des ratings (Exercice 6.4)
 *                     priceTrends:
 *                       type: object
 *                       description: Tendance des prix (Exercice 6.5)
 *       500:
 *         description: Erreur serveur
 */
router.get('/', statsController.getProductStats);

/**
 * @swagger
 * /api/products/stats/categories:
 *   get:
 *     summary: Statistiques par catégorie (Exercice 6.1)
 *     tags: [Statistiques]
 *     description: |
 *       **Exercice 6.1: Calcul des Statistiques Globales par Catégorie**
 *       
 *       Pipeline MongoDB:
 *       1. $match - Filtrer les produits avec catégorie
 *       2. $group - Regrouper par catégorie et calculer les statistiques
 *       3. $sort - Trier par prix moyen décroissant
 *       4. $project - Renommer et formater les champs
 *       
 *       Retourne pour chaque catégorie:
 *       - Nombre total de produits
 *       - Prix moyen (μ)
 *       - Prix maximum
 *       - Prix minimum
 *     responses:
 *       200:
 *         description: Statistiques par catégorie récupérées
 *       500:
 *         description: Erreur serveur
 */
router.get('/categories', statsController.getCategoryStats);

/**
 * @swagger
 * /api/products/stats/test:
 *   get:
 *     summary: Tester différents pipelines d'agrégation
 *     tags: [Statistiques]
 *     parameters:
 *       - in: query
 *         name: pipeline
 *         schema:
 *           type: string
 *           enum: [category, price, brand, rating]
 *         required: true
 *         description: Type de pipeline à tester
 *     responses:
 *       200:
 *         description: Résultat du pipeline
 *       400:
 *         description: Pipeline invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/test', statsController.testAggregationPipeline);

/**
 * @swagger
 * /api/products/stats/summary:
 *   get:
 *     summary: Statistiques sommaires (endpoint existant)
 *     tags: [Statistiques]
 *     description: Endpoint existant pour les statistiques sommaires
 *     responses:
 *       200:
 *         description: Statistiques sommaires récupérées
 *       500:
 *         description: Erreur serveur
 */
// Note: Cette route est déjà définie dans products.js
// Elle est mentionnée ici pour la documentation

/**
 * Route pour la documentation des pipelines
 * GET /api/products/stats/docs
 */
router.get('/docs', (req, res) => {
    res.json({
        title: 'Documentation des Endpoints de Statistiques',
        description: 'Phase 3 - Requêtes d\'Aggrégation Avancée',
        endpoints: {
            main: {
                path: '/api/products/stats',
                method: 'GET',
                description: 'Toutes les statistiques avancées (Exercices 6.1 à 6.5)'
            },
            categories: {
                path: '/api/products/stats/categories',
                method: 'GET',
                description: 'Exercice 6.1 - Statistiques par catégorie'
            },
            test: {
                path: '/api/products/stats/test',
                method: 'GET',
                parameters: 'pipeline=category|price|brand|rating',
                description: 'Tester des pipelines spécifiques'
            }
        },
        exercises: {
            '6.1': {
                title: 'Calcul des Statistiques Globales par Catégorie',
                stages: ['$match', '$group', '$sort', '$project'],
                description: 'Pour chaque catégorie: nombre de produits, prix moyen, max, min'
            },
            '6.2': {
                title: 'Distribution des Prix par Tranche',
                stages: ['$bucket', '$project'],
                description: 'Répartition des produits par tranche de prix'
            },
            '6.3': {
                title: 'Top 10 des Marques',
                stages: ['$match', '$group', '$sort', '$limit', '$project'],
                description: 'Classement des marques par nombre de produits'
            },
            '6.4': {
                title: 'Analyse des Ratings',
                stages: ['$bucket', '$project'],
                description: 'Distribution des évaluations des produits'
            },
            '6.5': {
                title: 'Tendance des Prix par Catégorie',
                stages: ['$group', '$group', '$project', '$sort', '$limit'],
                description: 'Segmentation des prix par catégorie'
            }
        },
        examples: {
            curl: {
                allStats: 'curl http://localhost:3000/api/products/stats',
                categoryStats: 'curl http://localhost:3000/api/products/stats/categories',
                testPipeline: 'curl "http://localhost:3000/api/products/stats/test?pipeline=category"'
            },
            browser: {
                allStats: 'http://localhost:3000/api/products/stats',
                categoryStats: 'http://localhost:3000/api/products/stats/categories',
                testCategory: 'http://localhost:3000/api/products/stats/test?pipeline=category'
            }
        },
        aggregationOperators: {
            grouping: ['$group', '$bucket'],
            transformation: ['$project', '$addFields'],
            sorting: ['$sort'],
            limiting: ['$limit'],
            filtering: ['$match'],
            arithmetic: ['$multiply', '$divide', '$subtract', '$add'],
            array: ['$push', '$addToSet', '$size', '$map'],
            conditional: ['$switch', '$case', '$cond'],
            rounding: ['$round'],
            date: ['$dateToString']
        }
    });
});

module.exports = router;