
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

let dbClient = null;
let dbInstance = null;

const uri = process.env.DB_STRING || 'mongodb://localhost:27017';

const clientOptions = {
    maxPoolSize: 50,
    minPoolSize: 5,
    maxIdleTimeMS: 10000,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    monitorCommands: true // Pour le debug
};

/**
 * Établit la connexion à MongoDB
 * @returns {Promise<MongoClient>}
 */
async function connectDB() {
    if (dbClient) {
        console.log(' Utilisation de la connexion MongoDB existante');
        return dbClient;
    }

    try {
        console.log(' Tentative de connexion à MongoDB...');
        console.log(` URI: ${uri.replace(/\/\/[^@]+@/, '//***:***@')}`);
        
        // Créer le client MongoDB
        const client = new MongoClient(uri, clientOptions);
        
        // Se connecter
        await client.connect();
        
        // Vérifier la connexion avec un ping
        await client.db().admin().ping();
        console.log(' Ping MongoDB réussi!');
        
        // Sélectionner la base de données
        const dbName = process.env.DB_NAME || 'produitsDB';
        dbClient = client;
        dbInstance = client.db(dbName);
        
        console.log(' Connecté à MongoDB avec succès !');
        console.log(` Base de données: ${dbInstance.databaseName}`);
        
        // Vérifier et lister les collections
        await checkAndListCollections();
        
        // Créer les indexes si nécessaire
        await createIndexes();
        
        // Vérifier des données de test
        await checkSampleData();
        
        // Événements de monitoring
        client.on('connectionPoolCreated', (event) => {
            console.log(` Pool de connexions créé (size: ${event.options.maxPoolSize})`);
        });
        
        client.on('connectionPoolReady', () => {
            console.log(' Pool de connexions prêt');
        });
        
        return client;
        
    } catch (error) {
        console.error(' Erreur de connexion à MongoDB:', error.message);
        console.log(' Dépannage MongoDB Compass:');
        console.log('   1. Vérifiez que MongoDB est en cours d\'exécution');
        console.log('   2. Ouvrez MongoDB Compass');
        console.log(`   3. Collez cette URI: ${uri}`);
        console.log('   4. Cliquez sur "Connect"');
        
        // Tentative de reconnexion
        console.log(' Nouvelle tentative dans 5 secondes...');
        setTimeout(connectDB, 5000);
        
        throw error;
    }
}

/**
 * Vérifie et liste les collections
 */
async function checkAndListCollections() {
    try {
        const collections = await dbInstance.listCollections().toArray();
        
        console.log(` Collections disponibles (${collections.length}):`);
        
        if (collections.length === 0) {
            console.log('     Aucune collection trouvée');
            console.log('    Pour créer la collection "products":');
            console.log('      1. Ouvrir MongoDB Compass');
            console.log('      2. Sélectionner la base "produitsDB"');
            console.log('      3. Cliquer sur "CREATE COLLECTION"');
            console.log('      4. Nommer "products"');
        } else {
            collections.forEach((col, index) => {
                console.log(`   ${index + 1}. ${col.name}`);
            });
            
            // Vérifier si products existe
            const hasProducts = collections.some(col => col.name === 'products');
            if (!hasProducts) {
                console.log('     Collection "products" non trouvée');
                console.log('    Créez-la via MongoDB Compass ou l\'API');
            } else {
                console.log('    Collection "products" trouvée');
            }
        }
    } catch (error) {
        console.error(' Erreur lors du listing des collections:', error.message);
    }
}

/**
 * Crée les indexes nécessaires
 */
async function createIndexes() {
    try {
        const productsCollection = dbInstance.collection('products');
        
        // Index pour la recherche textuelle
        await productsCollection.createIndex(
            { title: "text", description: "text", category: "text", brand: "text" },
            { 
                name: "text_search_index",
                default_language: "french",
                weights: {
                    title: 10,
                    brand: 5,
                    category: 3,
                    description: 1
                }
            }
        );
        console.log(' Index de recherche textuelle créé');
        
        // Index pour les filtres courants
        await productsCollection.createIndex({ category: 1 });
        await productsCollection.createIndex({ price: 1 });
        await productsCollection.createIndex({ brand: 1 });
        await productsCollection.createIndex({ createdAt: -1 });
        await productsCollection.createIndex({ "rating": -1 });
        
        console.log(' Indexes de performance créés');
        
    } catch (error) {
        // Ignorer si les indexes existent déjà
        if (!error.message.includes('already exists')) {
            console.warn('  Erreur lors de la création des indexes:', error.message);
        }
    }
}

/**
 * Vérifie les données d'exemple
 */
async function checkSampleData() {
    try {
        const productsCollection = dbInstance.collection('products');
        const count = await productsCollection.countDocuments();
        
        console.log(` Nombre de produits dans la collection: ${count}`);
        
        if (count === 0) {
            console.log(' Collection vide. Vous pouvez:');
            console.log('   1. Ajouter des produits via l\'API POST /api/products');
            console.log('   2. Insérer manuellement dans MongoDB Compass');
            console.log('   3. Exécuter le script de seed: npm run seed');
        } else {
            // Montrer un échantillon
            const sample = await productsCollection.findOne();
            console.log('  Exemple de produit:');
            console.log(`   - Titre: ${sample.title || 'N/A'}`);
            console.log(`   - Catégorie: ${sample.category || 'N/A'}`);
            console.log(`   - Prix: ${sample.price || 'N/A'}€`);
            console.log(`   - Stock: ${sample.stock || 0}`);
        }
    } catch (error) {
        console.error(' Erreur lors de la vérification des données:', error.message);
    }
}

/**
 * Récupère l'instance de la base de données
 * @returns {Db} Instance MongoDB
 */
function getDB() {
    if (!dbInstance) {
        console.error(' Base de données non initialisée');
        console.log(' Solution:');
        console.log('   1. Vérifiez votre connexion MongoDB');
        console.log('   2. Ouvrez MongoDB Compass et connectez-vous');
        console.log('   3. Assurez-vous que la base "produitsDB" existe');
        console.log('   4. Redémarrez le serveur');
        throw new Error('Base de données non initialisée. Vérifiez MongoDB Compass.');
    }
    return dbInstance;
}

/**
 * Ferme la connexion à MongoDB
 * @returns {Promise<void>}
 */
async function closeDB() {
    if (dbClient) {
        try {
            await dbClient.close();
            console.log(' Connexion MongoDB fermée proprement');
            dbClient = null;
            dbInstance = null;
        } catch (error) {
            console.error(' Erreur lors de la fermeture:', error.message);
        }
    }
}

/**
 * Vérifie l'état de la connexion
 * @returns {boolean}
 */
function isConnected() {
    return dbClient !== null && dbInstance !== null;
}

/**
 * Teste la connexion (pour les routes de santé)
 * @returns {Promise<boolean>}
 */
async function testConnection() {
    try {
        if (!dbClient) return false;
        await dbClient.db().admin().ping();
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {
    connectDB,
    getDB,
    closeDB,
    isConnected,
    testConnection,
    uri
};