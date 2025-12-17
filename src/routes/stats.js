const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');


router.get('/', statsController.getProductStats);


router.get('/categories', statsController.getCategoryStats);


router.get('/test', statsController.testAggregationPipeline);


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


router.get('/top-rated', statsController.getTopRatedProducts);



router.get('/brand-analysis', statsController.getBrandAnalysis);


router.get('/brands/simple', statsController.getBrandSimpleAnalysis);

module.exports = router;