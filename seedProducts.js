// 1. IMPORTER LES OUTILS
const { MongoClient } = require('mongodb');
const axios = require('axios'); // Pour faire des requêtes HTTP
require('dotenv').config();

// 2. FONCTION PRINCIPALE
async function seedProducts() {
    // Chaîne de connexion MongoDB
    const uri = process.env.DB_STRING;
    const client = new MongoClient(uri);
    
    try {
        // Connexion à MongoDB
        await client.connect();
        console.log('🌱 Connexion à MongoDB établie pour le seeding...');
        
        const db = client.db('produitsDB');
        const collection = db.collection('products');
        
        // 3. SUPPRIMER LES ANCIENS PRODUITS (pour un seed propre)
        await collection.deleteMany({});
        console.log('🧹 Anciens produits supprimés.');
        
        // 4. RÉCUPÉRER LES DONNÉES DEPUIS L'API EXTERNE
        console.log('📡 Récupération des produits depuis dummyjson.com...');
        const response = await axios.get('https://dummyjson.com/products');
        const products = response.data.products; // Tableau de produits
        
        console.log(`📦 ${products.length} produits récupérés.`);
        
        // 5. INSÉRER LES NOUVEAUX PRODUITS
        if (products.length > 0) {
            // Transformer un peu les données pour notre besoin
            const productsToInsert = products.map(product => ({
                title: product.title,
                description: product.description,
                price: product.price,
                category: product.category,
                brand: product.brand,
                rating: product.rating,
                stock: product.stock,
                thumbnail: product.thumbnail,
                images: product.images,
                createdAt: new Date() // Date d'ajout
            }));
            
            const result = await collection.insertMany(productsToInsert);
            console.log(`✅ ${result.insertedCount} produits insérés avec succès !`);
        }
        
    } catch (error) {
        console.error('❌ Erreur lors du seeding :', error.message);
    } finally {
        // Fermer la connexion
        await client.close();
        console.log('🔌 Connexion à MongoDB fermée.');
    }
}

// 6. EXÉCUTER LA FONCTION
seedProducts();