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
app.get('/api/produits', async (req, res) => {
    try {
        const produits = await db.collection('products').find({}).toArray();
        res.json(produits);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
    }
});

// 8. EXEMPLE DE ROUTE POUR AJOUTER UN PRODUIT
app.post('/api/produits', async (req, res) => {
    try {
        const nouveauProduit = req.body;
        const result = await db.collection('produits').insertOne(nouveauProduit);
        res.status(201).json({ 
            message: 'Produit ajouté avec succès', 
            id: result.insertedId 
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de l\'ajout du produit' });
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