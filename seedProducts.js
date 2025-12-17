
const { MongoClient } = require('mongodb');
const axios = require('axios'); 
require('dotenv').config();

async function seedProducts() {
    console.log('='.repeat(60));
    console.log(' DÉMARRAGE DU SEEDING POUR MONGODB COMPASS');
    console.log('='.repeat(60));
    
    const uri = process.env.DB_STRING || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'produitsDB';
    
    console.log(` Connexion à: ${uri}`);
    console.log(` Base de données: ${dbName}`);
    
    const client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
    });
    
    try {
        // 3. CONNEXION À MONGODB
        console.log('\n Connexion à MongoDB...');
        await client.connect();
        console.log(' Connexion à MongoDB établie');
        
        // Vérification de la connexion
        await client.db().admin().ping();
        console.log(' Ping MongoDB réussi');
        
        const db = client.db(dbName);
        const collection = db.collection('products');
        
        // 4. VÉRIFIER LA COLLECTION
        console.log('\n Vérification de la collection...');
        const collections = await db.listCollections().toArray();
        const collectionExists = collections.some(col => col.name === 'products');
        
        if (!collectionExists) {
            console.log(' Création de la collection "products"...');
            await db.createCollection('products');
            console.log(' Collection créée');
        } else {
            console.log(' Collection "products" trouvée');
        }
        
        // 5. SUPPRIMER LES ANCIENS PRODUITS (pour un seed propre)
        console.log('\n Nettoyage des anciens produits...');
        const deleteResult = await collection.deleteMany({});
        console.log(` ${deleteResult.deletedCount} anciens produits supprimés`);
        
        // 6. RÉCUPÉRER LES DONNÉES DEPUIS L'API EXTERNE
        console.log('\n Récupération des produits depuis dummyjson.com...');
        console.log(' Cette opération peut prendre quelques secondes...');
        
        try {
            const response = await axios.get('https://dummyjson.com/products?limit=100', {
                timeout: 10000 // 10 secondes timeout
            });
            
            const products = response.data.products; // Tableau de produits
        
            console.log(` ${products.length} produits récupérés avec succès`);
            
            // 7. INSÉRER LES NOUVEAUX PRODUITS
            if (products.length > 0) {
                console.log('\n Transformation et insertion des données...');
                
                // Transformer les données pour notre besoin
                const productsToInsert = products.map(product => {
                    // Calculer le prix après réduction si applicable
                    const discountPercentage = product.discountPercentage || 0;
                    const originalPrice = product.price;
                    const discountedPrice = discountPercentage > 0 
                        ? originalPrice * (1 - discountPercentage / 100)
                        : originalPrice;
                    
                    return {
                        // Données de base
                        title: product.title || 'Produit sans nom',
                        description: product.description || 'Aucune description disponible',
                        price: parseFloat(originalPrice.toFixed(2)),
                        category: product.category || 'Non catégorisé',
                        brand: product.brand || 'Marque inconnue',
                        
                        // Évaluations et stock
                        rating: parseFloat((product.rating || 0).toFixed(1)),
                        stock: product.stock || 0,
                        reviews: product.reviews || [],
                        
                        // Images
                        thumbnail: product.thumbnail || '',
                        images: product.images || [],
                        
                        // Informations de réduction
                        discountPercentage: parseFloat(discountPercentage.toFixed(2)),
                        discountedPrice: parseFloat(discountedPrice.toFixed(2)),
                        hasDiscount: discountPercentage > 0,
                        
                        // Métadonnées
                        sku: `SKU-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                        tags: Array.isArray(product.tags) ? product.tags : [],
                        
                        // Pour la recherche
                        searchKeywords: [
                            (product.title || '').toLowerCase(),
                            (product.brand || '').toLowerCase(),
                            (product.category || '').toLowerCase(),
                            ...(Array.isArray(product.tags) ? product.tags.map(tag => tag.toLowerCase()) : [])
                        ].filter(keyword => keyword),
                        
                        // Dates
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        
                        // Informations supplémentaires
                        weight: product.weight || null,
                        dimensions: product.dimensions || {},
                        warranty: product.warrantyInformation || 'Garantie standard',
                        shippingInfo: product.shippingInformation || 'Livraison standard'
                    };
                });
                
                console.log(` ${productsToInsert.length} produits préparés pour l'insertion`);
                console.log(' Insertion en cours...');
                
                const result = await collection.insertMany(productsToInsert);
                console.log(` ${result.insertedCount} produits insérés avec succès !`);
                
                // 8. CRÉER LES INDEXES POUR AMÉLIORER LES PERFORMANCES
                console.log('\n⚡ Création des indexes pour MongoDB Compass...');
                
                try {
                    // Index pour la recherche textuelle (pour MongoDB Compass)
                    await collection.createIndex(
                        { 
                            title: "text", 
                            description: "text", 
                            category: "text", 
                            brand: "text",
                            tags: "text"
                        },
                        {
                            name: "text_search_index",
                            default_language: "french",
                            weights: {
                                title: 10,
                                brand: 5,
                                category: 3,
                                description: 1,
                                tags: 2
                            }
                        }
                    );
                    console.log(' Index de recherche textuelle créé');
                } catch (indexError) {
                    if (!indexError.message.includes('already exists')) {
                        console.log('  Index de recherche textuelle déjà existant');
                    }
                }
                
                // Index pour les filtres courants
                const indexesToCreate = [
                    { category: 1 },
                    { price: 1 },
                    { brand: 1 },
                    { rating: -1 },
                    { stock: 1 },
                    { createdAt: -1 },
                    { "discountPercentage": -1 }
                ];
                
                for (const indexSpec of indexesToCreate) {
                    try {
                        const fieldName = Object.keys(indexSpec)[0];
                        await collection.createIndex(indexSpec);
                        console.log(` Index créé: ${fieldName}`);
                    } catch (error) {
                        // Ignorer les indexes qui existent déjà
                        if (!error.message.includes('already exists')) {
                            console.warn(`  Erreur avec l'index: ${error.message}`);
                        }
                    }
                }
                
                console.log(' Tous les indexes créés avec succès');
                
                // 9. VÉRIFICATION ET STATISTIQUES
                console.log('\n VÉRIFICATION FINALE');
                console.log('-'.repeat(40));
                
                // Compter le nombre total
                const totalCount = await collection.countDocuments();
                console.log(` Total produits: ${totalCount}`);
                
                // Statistiques par catégorie
                const categories = await collection.distinct('category');
                console.log(`  Catégories uniques: ${categories.length}`);
                
                // Statistiques par marque
                const brands = await collection.distinct('brand');
                console.log(` Marques uniques: ${brands.length}`);
                
                // Prix moyen
                const avgPriceResult = await collection.aggregate([
                    { $group: { _id: null, avgPrice: { $avg: "$price" } } }
                ]).toArray();
                const avgPrice = avgPriceResult[0]?.avgPrice || 0;
                console.log(` Prix moyen: ${avgPrice.toFixed(2)}€`);
                
                // Produits en promotion
                const discountCount = await collection.countDocuments({ hasDiscount: true });
                console.log(` Produits en promotion: ${discountCount}`);
                
                // 10. AFFICHER QUELQUES EXEMPLES
                console.log('\n EXEMPLES DE PRODUITS INSÉRÉS:');
                console.log('-'.repeat(40));
                
                const sampleProducts = await collection
                    .find({})
                    .limit(5)
                    .toArray();
                
                sampleProducts.forEach((product, index) => {
                    const discountInfo = product.hasDiscount 
                        ? ` -${product.discountPercentage}% (${product.discountedPrice}€)`
                        : '';
                    
                    console.log(`${index + 1}. ${product.title}`);
                    console.log(`    Prix: ${product.price}€ ${discountInfo}`);
                    console.log(`     Catégorie: ${product.category}`);
                    console.log(`    Note: ${product.rating}/5`);
                    console.log(`    Stock: ${product.stock} unités`);
                    console.log(`    Marque: ${product.brand}`);
                    console.log('');
                });
                
                // 11. INSTRUCTIONS POUR MONGODB COMPASS
                console.log('\n INSTRUCTIONS POUR MONGODB COMPASS:');
                console.log('='.repeat(60));
                console.log('1.  Ouvrir MongoDB Compass');
                console.log(`2.  Se connecter à: ${uri}`);
                console.log(`3.  Sélectionner la base: ${dbName}`);
                console.log('4.  Cliquer sur la collection "products"');
                console.log('5.   Vérifier les données insérées');
                console.log('6.  Utiliser les filtres et la recherche');
                console.log('');
                console.log(' FILTRES DISPONIBLES DANS MONGODB COMPASS:');
                console.log('   • category: "smartphones", "laptops", etc.');
                console.log('   • price: { $gte: 100, $lte: 1000 }');
                console.log('   • rating: { $gte: 4 }');
                console.log('   • brand: "Apple", "Samsung", etc.');
                console.log('   • hasDiscount: true');
                console.log('='.repeat(60));
                
            } else {
                console.warn('  Aucun produit récupéré de l\'API');
            }
            
        } catch (apiError) {
            console.error(' Erreur lors de la récupération des données API:', apiError.message);
            console.log('\n SOLUTION DE SECOURS: Insertion de données de test locales');
            
            // Données de secours
            const backupProducts = [
                {
                    title: "iPhone 15 Pro",
                    description: "Smartphone Apple avec écran Super Retina XDR",
                    price: 1199.99,
                    category: "smartphones",
                    brand: "Apple",
                    rating: 4.8,
                    stock: 50,
                    thumbnail: "https://example.com/iphone.jpg",
                    discountPercentage: 5,
                    tags: ["apple", "iphone", "premium"]
                },
                {
                    title: "Samsung Galaxy S23",
                    description: "Smartphone Android avec appareil photo 200MP",
                    price: 899.99,
                    category: "smartphones",
                    brand: "Samsung",
                    rating: 4.6,
                    stock: 75,
                    thumbnail: "https://example.com/galaxy.jpg",
                    discountPercentage: 0,
                    tags: ["samsung", "android", "camera"]
                },
                {
                    title: "MacBook Pro 16\"",
                    description: "Ordinateur portable Apple M2 Pro",
                    price: 2499.99,
                    category: "laptops",
                    brand: "Apple",
                    rating: 4.9,
                    stock: 25,
                    thumbnail: "https://example.com/macbook.jpg",
                    discountPercentage: 10,
                    tags: ["apple", "laptop", "professional"]
                }
            ];
            
            const backupToInsert = backupProducts.map(product => ({
                ...product,
                discountedPrice: product.price * (1 - (product.discountPercentage || 0) / 100),
                hasDiscount: (product.discountPercentage || 0) > 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                searchKeywords: [
                    product.title.toLowerCase(),
                    product.brand.toLowerCase(),
                    product.category.toLowerCase(),
                    ...product.tags.map(tag => tag.toLowerCase())
                ]
            }));
            
            const backupResult = await collection.insertMany(backupToInsert);
            console.log(` ${backupResult.insertedCount} produits de secours insérés`);
        }
        
    } catch (error) {
        console.error('\n ERREUR CRITIQUE LORS DU SEEDING:');
        console.error('Message:', error.message);
        console.error('\n DÉPANNAGE MONGODB COMPASS:');
        console.log('1. Vérifiez que MongoDB est en cours d\'exécution');
        console.log('2. Ouvrez MongoDB Compass et testez la connexion');
        console.log(`3. Vérifiez l\'URI: ${uri}`);
        console.log('4. Assurez-vous d\'avoir les permissions nécessaires');
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n MONGODB N\'EST PAS DÉMARRÉ');
            console.log('Windows: Vérifiez le service "MongoDB"');
            console.log('Mac: brew services start mongodb-community');
            console.log('Linux: sudo systemctl start mongod');
        }
        
    } finally {
        // Fermer la connexion
        await client.close();
        console.log('\n Connexion à MongoDB fermée.');
        console.log('\n PROCESSUS DE SEEDING TERMINÉ');
        console.log('='.repeat(60));
        
        // Instructions finales
        console.log('\n POUR DÉMARRER VOTRE API:');
        console.log('   npm run dev');
        console.log('\n POUR TESTER VOTRE API:');
        console.log('   http://localhost:3000/api/products');
        console.log('\n POUR VÉRIFIER DANS MONGODB COMPASS:');
        console.log(`   Base: ${dbName}, Collection: products`);
    }
}

// 12. EXÉCUTER LA FONCTION
seedProducts();