// 1. IMPORTER LES OUTILS
const express = require('express');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// 2. CRÉER L'APPLICATION EXPRESS
const app = express();
const port = process.env.PORT || 3000;

// Middleware pour lire le JSON envoyé dans les requêtes
app.use(express.json());

// 3. VARIABLES POUR MONGODB
let db; // Cette variable contiendra notre connexion à la base

// 4. CHAÎNE DE CONNEXION (récupérée depuis .env)
const uri = process.env.DB_STRING;
const client = new MongoClient(uri);

// 5. CONNEXION À LA BASE DE DONNÉES
async function connectDB() {
    try {
        await client.connect();
        db = client.db('produitsDB'); // Nom de notre base
        console.log('✅ Connecté à MongoDB avec succès !');
        
        // Vérifier les collections disponibles
        const collections = await db.listCollections().toArray();
        console.log("Collections disponibles dans produitsDB :");
        collections.forEach(col => console.log(` - ${col.name}`));
        
    } catch (error) {
        console.error('❌ Erreur de connexion à MongoDB :', error);
        process.exit(1); // Arrête le serveur si la connexion échoue
    }
}

// 6. ROUTE DE TEST
app.get('/', (req, res) => {
    res.json({ message: '✅ Serveur fonctionne correctement !' });
});

// 7. EXEMPLE DE ROUTE POUR RÉCUPÉRER DES PRODUITS
app.get('/api/products', async (req, res) => {
    try {
        const products = await db.collection('products').find({}).toArray();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
    }
});

// 8. EXEMPLE DE ROUTE POUR AJOUTER UN PRODUIT
app.post('/api/products', async (req, res) => {
    try {
        const nouveauProduit = req.body;
        const result = await db.collection('products').insertOne(nouveauProduit);
        res.status(201).json({ 
            message: 'Produit ajouté avec succès', 
            id: result.insertedId 
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de l\'ajout du produit' });
    }
});

// =====================================
// ROUTES DE L'API PRODUITS
// =====================================

// Route test
app.get('/', (req, res) => {
    res.send('🎉 API de gestion de produits fonctionnelle !');
});

// 1. GET TOUS LES PRODUITS (avec pagination, tri, filtrage)
app.get('/api/products', async (req, res) => {
    try {
        const collection = db.collection('products');
        
        // Récupérer les paramètres de requête
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const category = req.query.category;
        const minPrice = parseFloat(req.query.minPrice);
        const maxPrice = parseFloat(req.query.maxPrice);
        const search = req.query.search;
        const sortBy = req.query.sortBy || '_id';
        const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
        
        // Construire le filtre
        let filter = {};
        
        if (category) {
            filter.category = category;
        }
        
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            filter.price = {};
            if (!isNaN(minPrice)) filter.price.$gte = minPrice;
            if (!isNaN(maxPrice)) filter.price.$lte = maxPrice;
        }
        
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Calculer le nombre de produits correspondants
        const totalProducts = await collection.countDocuments(filter);
        
        // Récupérer les produits (avec pagination et tri)[citation:2]
        const products = await collection.find(filter)
            .sort({ [sortBy]: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
        
        // Réponse
        res.json({
            success: true,
            page,
            limit,
            totalProducts,
            totalPages: Math.ceil(totalProducts / limit),
            products
        });
        
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. GET UN PRODUIT PAR ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const collection = db.collection('products');
        const product = await collection.findOne({ _id: new require('mongodb').ObjectId(req.params.id) });
        
        if (!product) {
            return res.status(404).json({ success: false, message: 'Produit non trouvé' });
        }
        
        res.json({ success: true, product });
        
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. POST CRÉER UN NOUVEAU PRODUIT
app.post('/api/products', async (req, res) => {
    try {
        const collection = db.collection('products');
        
        // Validation basique
        if (!req.body.title || !req.body.price) {
            return res.status(400).json({ 
                success: false, 
                message: 'Le titre et le prix sont requis' 
            });
        }
        
        const newProduct = {
            ...req.body,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await collection.insertOne(newProduct);
        
        res.status(201).json({ 
            success: true, 
            message: 'Produit créé avec succès',
            productId: result.insertedId 
        });
        
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. PUT METTRE À JOUR UN PRODUIT
app.put('/api/products/:id', async (req, res) => {
    try {
        const collection = db.collection('products');
        const productId = new require('mongodb').ObjectId(req.params.id);
        
        const updateData = {
            ...req.body,
            updatedAt: new Date()
        };
        
        const result = await collection.updateOne(
            { _id: productId },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Produit non trouvé' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Produit mis à jour avec succès',
            modifiedCount: result.modifiedCount 
        });
        
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. DELETE SUPPRIMER UN PRODUIT
app.delete('/api/products/:id', async (req, res) => {
    try {
        const collection = db.collection('products');
        const productId = new require('mongodb').ObjectId(req.params.id);
        
        const result = await collection.deleteOne({ _id: productId });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Produit non trouvé' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Produit supprimé avec succès' 
        });
        
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. GET STATISTIQUES DES PRODUITS (avec aggregation)
app.get('/api/products/stats/summary', async (req, res) => {
    try {
        const collection = db.collection('products');
        
        // Pipeline d'aggregation
        const pipeline = [
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    averagePrice: { $avg: '$price' },
                    maxPrice: { $max: '$price' },
                    minPrice: { $min: '$price' },
                    totalStock: { $sum: '$stock' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalProducts: 1,
                    averagePrice: { $round: ['$averagePrice', 2] },
                    maxPrice: 1,
                    minPrice: 1,
                    totalStock: 1
                }
            }
        ];
        
        const stats = await collection.aggregate(pipeline).toArray();
        
        res.json({ 
            success: true, 
            stats: stats[0] || {} 
        });
        
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 9. DÉMARRAGE DU SERVEUR
app.listen(port, async () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
    await connectDB(); // Se connecte à MongoDB quand le serveur démarre
});

// 10. GESTION DE LA FERMETURE PROPRE
process.on('SIGINT', async () => {
    console.log('\n⚠️  Fermeture du serveur...');
    await client.close();
    console.log('✅ Connexion MongoDB fermée');
    process.exit(0);
});