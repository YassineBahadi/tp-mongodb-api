// src/routes/products.js - ROUTES COMPLÈTES DES PRODUITS

const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');

// ========== DOCUMENTATION DES ROUTES ==========
/**
 * @swagger
 * tags:
 *   name: Produits
 *   description: Gestion des produits
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Récupère tous les produits avec filtres avancés
 *     tags: [Produits]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrer par catégorie
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Recherche texte
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Prix minimum
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Prix maximum
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: createdAt
 *           enum: [price, title, rating, createdAt, stock, brand]
 *         description: Champ de tri
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           default: desc
 *           enum: [asc, desc]
 *         description: Ordre de tri
 *     responses:
 *       200:
 *         description: Liste des produits récupérée avec succès
 *       500:
 *         description: Erreur serveur
 */

// 🛒 ROUTE PRINCIPALE AVEC FILTRES AVANCÉS
router.get('/', productsController.getAllProducts);

/**
 * @swagger
 * /api/products/stats/summary:
 *   get:
 *     summary: Récupère les statistiques des produits
 *     tags: [Produits]
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *       500:
 *         description: Erreur serveur
 */
router.get('/stats/summary', productsController.getProductStats);

/**
 * @swagger
 * /api/products/categories:
 *   get:
 *     summary: Récupère toutes les catégories disponibles
 *     tags: [Produits]
 *     responses:
 *       200:
 *         description: Catégories récupérées avec succès
 *       500:
 *         description: Erreur serveur
 */
router.get('/categories', productsController.getAllCategories);

/**
 * @swagger
 * /api/products/search/advanced:
 *   get:
 *     summary: Recherche avancée de produits
 *     tags: [Produits]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Terme de recherche
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrer par catégorie
 *     responses:
 *       200:
 *         description: Résultats de la recherche
 *       500:
 *         description: Erreur serveur
 */
router.get('/search/advanced', productsController.advancedSearch);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Crée un nouveau produit
 *     tags: [Produits]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - price
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Ordinateur Portable Pro"
 *               price:
 *                 type: number
 *                 example: 1299.99
 *               description:
 *                 type: string
 *                 example: "PC portable avec écran 15 pouces"
 *               category:
 *                 type: string
 *                 example: "Électronique"
 *               stock:
 *                 type: integer
 *                 example: 25
 *     responses:
 *       201:
 *         description: Produit créé avec succès
 *       400:
 *         description: Données invalides
 *       500:
 *         description: Erreur serveur
 */
router.post('/', productsController.createProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Récupère un produit par son ID
 *     tags: [Produits]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du produit
 *     responses:
 *       200:
 *         description: Produit récupéré avec succès
 *       404:
 *         description: Produit non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id', productsController.getProductById);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Met à jour un produit existant
 *     tags: [Produits]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du produit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               price:
 *                 type: number
 *               stock:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Produit mis à jour avec succès
 *       404:
 *         description: Produit non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.put('/:id', productsController.updateProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Supprime un produit
 *     tags: [Produits]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du produit
 *     responses:
 *       200:
 *         description: Produit supprimé avec succès
 *       404:
 *         description: Produit non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.delete('/:id', productsController.deleteProduct);

// ========== ROUTES ADDITIONNELLES UTILES ==========

/**
 * Route pour tester la connexion MongoDB
 * GET /api/products/health
 */
router.get('/health/check', async (req, res) => {
    try {
        const { getDB } = require('../config/database');
        const db = getDB();
        
        // Tester la connexion
        await db.command({ ping: 1 });
        
        // Compter les produits
        const count = await db.collection('products').countDocuments();
        
        res.json({
            status: 'healthy',
            database: db.databaseName,
            collection: 'products',
            productCount: count,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Route pour obtenir des informations sur la collection
 * GET /api/products/info/collection
 */
router.get('/info/collection', async (req, res) => {
    try {
        const { getDB } = require('../config/database');
        const db = getDB();
        const collection = db.collection('products');
        
        const stats = await db.command({ collStats: 'products' });
        const indexes = await collection.indexes();
        
        res.json({
            success: true,
            collection: 'products',
            stats: {
                count: stats.count,
                size: stats.size,
                avgObjSize: stats.avgObjSize,
                storageSize: stats.storageSize,
                totalIndexSize: stats.totalIndexSize
            },
            indexes: indexes.map(idx => ({
                name: idx.name,
                keys: idx.key,
                unique: idx.unique || false
            })),
            metadata: {
                database: db.databaseName,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des informations',
            error: error.message
        });
    }
});

/**
 * Route pour obtenir un exemple de données
 * GET /api/products/sample/data
 */
router.get('/sample/data', async (req, res) => {
    try {
        const { getDB } = require('../config/database');
        const db = getDB();
        const collection = db.collection('products');
        
        // Récupérer quelques exemples
        const samples = await collection.find().limit(3).toArray();
        
        // Exemple de structure pour création
        const exampleProduct = {
            title: "Exemple de Produit",
            description: "Ceci est un exemple de description",
            price: 99.99,
            category: "Électronique",
            stock: 50,
            brand: "Marque Exemple",
            imageUrl: "https://example.com/image.jpg",
            tags: ["nouveau", "promotion"],
            rating: 4.5,
            specifications: {
                couleur: "Noir",
                poids: "1.5kg"
            }
        };
        
        res.json({
            success: true,
            existingSamples: samples,
            exampleForCreation: exampleProduct,
            endpoints: {
                create: 'POST /api/products',
                getAll: 'GET /api/products',
                getOne: 'GET /api/products/{id}',
                update: 'PUT /api/products/{id}',
                delete: 'DELETE /api/products/{id}'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des exemples',
            error: error.message
        });
    }
});

/**
 * Route pour tester différents filtres
 * GET /api/products/examples/filters
 */
router.get('/examples/filters', (req, res) => {
    res.json({
        title: "Exemples de filtres disponibles",
        examples: {
            pagination: {
                description: "Pagination simple",
                url: "/api/products?page=2&limit=5"
            },
            categoryFilter: {
                description: "Filtrer par catégorie",
                url: "/api/products?category=Électronique"
            },
            priceRange: {
                description: "Filtrer par prix",
                url: "/api/products?minPrice=100&maxPrice=500"
            },
            search: {
                description: "Recherche texte",
                url: "/api/products?search=ordinateur"
            },
            combination: {
                description: "Combinaison de filtres",
                url: "/api/products?category=Électronique&minPrice=200&sort=price&order=asc"
            },
            inStock: {
                description: "Produits en stock uniquement",
                url: "/api/products?inStock=true"
            }
        },
        sortOptions: ["price", "title", "rating", "createdAt", "stock", "brand"],
        orderOptions: ["asc", "desc"]
    });
});

module.exports = router;