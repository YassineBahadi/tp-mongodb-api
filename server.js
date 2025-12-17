
const express = require('express');
const dotenv = require('dotenv');
const { connectDB } = require('./src/config/database');
const productRoutes = require('./src/routes/products');
const statsRoutes = require('./src/routes/stats'); 


dotenv.config();


const app = express();
const port = process.env.PORT || 3000;


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use((req, res, next) => {
    console.log(` ${req.method} ${req.originalUrl} - ${new Date().toLocaleTimeString()}`);
    next();
});

connectDB().catch(console.error);

app.use('/api/products', productRoutes);
app.use('/api/products/stats', statsRoutes); 

app.get('/', (req, res) => {
    res.json({ 
        message: ' API de gestion de produits avec MongoDB Compass',
        version: '1.0.0',
        database: 'produitsDB',
        collections: ['products'],
        endpoints: {
            // Produits
            getAllProducts: 'GET /api/products',
            getProductById: 'GET /api/products/:id',
            createProduct: 'POST /api/products',
            updateProduct: 'PUT /api/products/:id',
            deleteProduct: 'DELETE /api/products/:id',
            getProductStats: 'GET /api/products/stats/summary',
            
            // Recherche avancée
            advancedSearch: 'GET /api/products/search/advanced',
            
            // Catégories
            getAllCategories: 'GET /api/products/categories',
            getProductsByCategory: 'GET /api/products?category=:category'
        },
        queryParameters: {
            pagination: '?page=1&limit=10',
            filtering: '?category=électronique&minPrice=100&maxPrice=1000',
            search: '?search=ordinateur',
            sorting: '?sort=price&order=desc'
        },
        instructions: {
            mongoDBCompass: '1. Ouvrir MongoDB Compass',
            connection: '2. Se connecter à mongodb://localhost:27017',
            database: '3. Vérifier la base "produitsDB"',
            collection: '4. Vérifier la collection "products"'
        }
    });
});

// Route de santé
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'Connected'
    });
});

// Documentation des endpoints
app.get('/api/docs', (req, res) => {
    res.json({
        baseURL: 'http://localhost:3000',
        examples: {
            // GET Examples
            getProducts: {
                url: 'GET http://localhost:3000/api/products?page=1&limit=5',
                description: 'Récupère 5 produits (page 1)'
            },
            getFilteredProducts: {
                url: 'GET http://localhost:3000/api/products?category=électronique&minPrice=500',
                description: 'Produits électroniques à partir de 500€'
            },
            getProductById: {
                url: 'GET http://localhost:3000/api/products/507f1f77bcf86cd799439011',
                description: 'Récupère un produit spécifique'
            },
            
            // POST Example
            createProduct: {
                url: 'POST http://localhost:3000/api/products',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    "title": "Nouveau Produit",
                    "description": "Description du produit",
                    "price": 99.99,
                    "category": "Électronique",
                    "stock": 50,
                    "brand": "Marque"
                }
            },
            
            // PUT Example
            updateProduct: {
                url: 'PUT http://localhost:3000/api/products/507f1f77bcf86cd799439011',
                headers: { 'Content-Type': 'application/json' },
                body: { "price": 119.99, "stock": 25 }
            },
            
            // DELETE Example
            deleteProduct: {
                url: 'DELETE http://localhost:3000/api/products/507f1f77bcf86cd799439011'
            },
            
            // Stats
            getStats: {
                url: 'GET http://localhost:3000/api/products/stats/summary'
            }
        }
    });
});

// Route pour tester MongoDB Compass
app.get('/api/mongodb-check', async (req, res) => {
    try {
        const { getDB } = require('./src/config/database');
        const db = getDB();
        
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);
        
        // Vérifier si la collection products existe
        const productsCollection = db.collection('products');
        const productCount = await productsCollection.countDocuments();
        
        res.json({
            connected: true,
            database: db.databaseName,
            collections: collectionNames,
            products: {
                collectionExists: collectionNames.includes('products'),
                count: productCount,
                sample: productCount > 0 ? await productsCollection.findOne() : null
            },
            mongoDBCompass: {
                connectionString: process.env.DB_STRING,
                instructions: 'Connectez-vous avec cette chaîne dans MongoDB Compass'
            }
        });
    } catch (error) {
        res.status(500).json({
            connected: false,
            error: error.message,
            mongoDBCompass: {
                manualCheck: '1. Ouvrir MongoDB Compass',
                connection: '2. Coller: ' + process.env.DB_STRING,
                verify: '3. Vérifier la base "produitsDB"'
            }
        });
    }
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: ' Route non trouvée',
        requestedPath: req.originalUrl,
        availableRoutes: [
            'GET /',
            'GET /health',
            'GET /api/docs',
            'GET /api/mongodb-check',
            'GET /api/products',
            'GET /api/products/:id',
            'POST /api/products',
            'PUT /api/products/:id',
            'DELETE /api/products/:id',
            'GET /api/products/stats/summary'
        ]
    });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
    console.error(' Erreur serveur:', {
        message: err.message,
        stack: err.stack,
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
        success: false, 
        message: ' Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? {
            message: err.message,
            stack: err.stack
        } : undefined,
        support: 'Vérifiez votre connexion MongoDB avec MongoDB Compass'
    });
});

// Démarrer le serveur
const server = app.listen(port, async () => {
    console.log('='.repeat(50));
    console.log(' SERVEUR API PRODUITS AVEC MONGODB COMPASS');
    console.log('='.repeat(50));
    console.log(` Serveur démarré sur http://localhost:${port}`);
    console.log(` Port: ${port}`);
    console.log(`  Base de données: produitsDB`);
    console.log(` Chaîne de connexion: ${process.env.DB_STRING}`);
    console.log('='.repeat(50));
    console.log(' ENDPOINTS DISPONIBLES:');
    console.log(`    Accueil: http://localhost:${port}`);
    console.log(`    Santé: http://localhost:${port}/health`);
    console.log(`    Documentation: http://localhost:${port}/api/docs`);
    console.log(`    Produits: http://localhost:${port}/api/products`);
    console.log(`   Vérif MongoDB: http://localhost:${port}/api/mongodb-check`);
    console.log('='.repeat(50));
    console.log(' POUR MONGODB COMPASS:');
    console.log(`   1. Ouvrir MongoDB Compass`);
    console.log(`   2. Coller: ${process.env.DB_STRING}`);
    console.log(`   3. Se connecter`);
    console.log(`   4. Vérifier la base "produitsDB"`);
    console.log(`   5. Vérifier la collection "products"`);
    console.log('='.repeat(50));
});

// Gestion de la fermeture propre
process.on('SIGINT', () => {
    console.log('\n  Fermeture du serveur...');
    server.close(() => {
        console.log(' Serveur arrêté proprement');
        process.exit(0);
    });
});

module.exports = { app, server };