
const express = require('express');
const router = express.Router();
const productsController = require('../controllers/productsController');
const statsController = require('../controllers/statsController');


router.get('/stats/summary', productsController.getProductStats);


router.get('/categories', productsController.getAllCategories);


router.get('/search/advanced', productsController.advancedSearch);


router.get('/:id', productsController.getProductById);

router.put('/:id', productsController.updateProduct);


router.delete('/:id', productsController.deleteProduct);


router.get('/health/check', async (req, res) => {
    try {
        const { getDB } = require('../config/database');
        const db = getDB();
        
        await db.command({ ping: 1 });
        
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

router.get('/sample/data', async (req, res) => {
    try {
        const { getDB } = require('../config/database');
        const db = getDB();
        const collection = db.collection('products');
        
        const samples = await collection.find().limit(3).toArray();
        
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


router.get('/stats/summary', productsController.getProductStats); 


router.get('/stats/categories', statsController.getCategoryStats); 

module.exports = router;