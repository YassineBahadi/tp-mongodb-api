// src/controllers/productsController.js - LOGIQUE MÉTIER DES PRODUITS

const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

/**
 * 🛒 RÉCUPÉRER TOUS LES PRODUITS AVEC FILTRES AVANCÉS
 * GET /api/products?page=1&limit=10&category=smartphones&search=iphone&minPrice=100&maxPrice=1000&sort=price&order=desc
 */
async function getAllProducts(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        // ========== 1. EXTRACTION DES PARAMÈTRES ==========
        const {
            page = 1,
            limit = 10,
            category,
            search,
            minPrice,
            maxPrice,
            brand,
            inStock,
            rating,
            tags,
            sort = 'createdAt',
            order = 'desc'
        } = req.query;

        console.log('🔍 Paramètres de requête reçus:', req.query);

        // ========== 2. VALIDATION DES PARAMÈTRES ==========
        const pageNumber = Math.max(1, parseInt(page));
        const limitNumber = Math.min(100, Math.max(1, parseInt(limit)));
        const sortOrder = order.toLowerCase() === 'asc' ? 1 : -1;

        // ========== 3. CONSTRUCTION DU FILTRE ==========
        let filter = {};

        // 🔸 Filtre par catégorie (insensible à la casse)
        if (category && category.trim() !== '') {
            filter.category = { 
                $regex: new RegExp(`^${category.trim()}$`, 'i') 
            };
            console.log(`🎯 Filtre catégorie: ${category}`);
        }

        // 🔸 Filtre par marque
        if (brand && brand.trim() !== '') {
            filter.brand = { 
                $regex: new RegExp(brand.trim(), 'i') 
            };
        }

        // 🔸 Filtre par prix
        if (minPrice || maxPrice) {
            filter.price = {};
            
            const min = parseFloat(minPrice);
            const max = parseFloat(maxPrice);
            
            if (!isNaN(min) && min >= 0) {
                filter.price.$gte = min;
                console.log(`💰 Prix min: ${min}€`);
            }
            
            if (!isNaN(max) && max >= 0) {
                filter.price.$lte = max;
                console.log(`💰 Prix max: ${max}€`);
            }
            
            // Si seulement max est fourni
            if (filter.price.$gte === undefined && filter.price.$lte !== undefined) {
                filter.price.$gte = 0;
            }
        }

        // 🔸 Filtre par stock
        if (inStock === 'true') {
            filter.stock = { $gt: 0 };
            console.log('📦 Seulement produits en stock');
        } else if (inStock === 'false') {
            filter.stock = { $lte: 0 };
            console.log('📦 Seulement produits épuisés');
        }

        // 🔸 Filtre par rating
        if (rating) {
            const ratingNum = parseFloat(rating);
            if (!isNaN(ratingNum) && ratingNum >= 0 && ratingNum <= 5) {
                filter.rating = { $gte: ratingNum };
                console.log(`⭐ Rating minimum: ${ratingNum}`);
            }
        }

        // 🔸 Filtre par tags
        if (tags) {
            const tagsArray = Array.isArray(tags) ? tags : [tags];
            filter.tags = { $in: tagsArray.map(tag => new RegExp(tag.trim(), 'i')) };
        }

        // 🔸 Recherche texte avancée
        if (search && search.trim() !== '') {
            const searchTerm = search.trim();
            console.log(`🔎 Recherche: "${searchTerm}"`);
            
            // Utiliser l'index de recherche textuelle
            filter.$text = { $search: searchTerm };
            
            // Alternative: recherche regex si $text échoue
            const searchRegex = new RegExp(searchTerm, 'i');
            filter.$or = [
                { title: searchRegex },
                { description: searchRegex },
                { category: searchRegex },
                { brand: searchRegex },
                { tags: searchRegex }
            ];
        }

        // ========== 4. CONSTRUCTION DU TRI ==========
        let sortOption = {};
        
        const sortFieldMapping = {
            'price': 'price',
            'name': 'title',
            'title': 'title',
            'rating': 'rating',
            'created': 'createdAt',
            'createdAt': 'createdAt',
            'stock': 'stock',
            'brand': 'brand',
            'updated': 'updatedAt'
        };
        
        const sortField = sortFieldMapping[sort] || 'createdAt';
        sortOption[sortField] = sortOrder;

        console.log(`📊 Tri appliqué: ${sortField} (${sortOrder === 1 ? 'ascendant' : 'descendant'})`);

        // ========== 5. PAGINATION ==========
        const skip = (pageNumber - 1) * limitNumber;
        console.log(`📄 Pagination: page ${pageNumber}, limit ${limitNumber}, skip ${skip}`);

        // ========== 6. EXÉCUTION DES REQUÊTES ==========
        
        // 🔹 6.1 Compter le nombre total
        const totalProducts = await productsCollection.countDocuments(filter);
        console.log(`📈 Total produits correspondants: ${totalProducts}`);
        
        // 🔹 6.2 Récupérer les produits
        let products = [];
        
        if (totalProducts > 0) {
            products = await productsCollection
                .find(filter)
                .sort(sortOption)
                .skip(skip)
                .limit(limitNumber)
                .toArray();
        }
        
        console.log(`✅ ${products.length} produits récupérés`);

        // ========== 7. CALCUL DES STATISTIQUES DE LA PAGE ==========
        const totalPages = Math.ceil(totalProducts / limitNumber);
        const hasNextPage = pageNumber < totalPages;
        const hasPrevPage = pageNumber > 1;

        // Statistiques des produits récupérés
        const stats = products.length > 0 ? {
            minPrice: Math.min(...products.map(p => p.price || 0)),
            maxPrice: Math.max(...products.map(p => p.price || 0)),
            avgPrice: (products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length).toFixed(2),
            totalStock: products.reduce((sum, p) => sum + (p.stock || 0), 0),
            categories: [...new Set(products.map(p => p.category).filter(Boolean))]
        } : null;

        // ========== 8. PRÉPARATION DE LA RÉPONSE ==========
        const response = {
            success: true,
            message: totalProducts === 0 ? 'Aucun produit trouvé' : 'Produits récupérés avec succès',
            data: {
                products,
                pagination: {
                    currentPage: pageNumber,
                    totalPages,
                    totalProducts,
                    limit: limitNumber,
                    hasNextPage,
                    hasPrevPage,
                    nextPage: hasNextPage ? pageNumber + 1 : null,
                    prevPage: hasPrevPage ? pageNumber - 1 : null
                },
                filters: {
                    applied: Object.keys(filter).length > 0 ? 'Oui' : 'Non',
                    details: {
                        category: category || 'Toutes',
                        search: search || 'Aucune',
                        priceRange: {
                            min: minPrice || 'Non défini',
                            max: maxPrice || 'Non défini'
                        },
                        brand: brand || 'Toutes',
                        inStock: inStock || 'Tous'
                    }
                },
                stats,
                sort: {
                    by: sortField,
                    order: sortOrder === 1 ? 'ascendant' : 'descendant'
                }
            },
            metadata: {
                timestamp: new Date().toISOString(),
                executionTime: Date.now(),
                requestId: Math.random().toString(36).substr(2, 9)
            }
        };

        // ========== 9. ENVOI DE LA RÉPONSE ==========
        res.json(response);

    } catch (error) {
        console.error('❌ Erreur dans getAllProducts:', error);
        console.error('Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des produits',
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                code: error.code,
                stack: error.stack
            } : undefined,
            troubleshooting: {
                mongoDB: 'Vérifiez votre connexion MongoDB avec MongoDB Compass',
                collection: 'Assurez-vous que la collection "products" existe',
                indexes: 'Les indexes peuvent être nécessaires pour la recherche'
            },
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 📊 STATISTIQUES DES PRODUITS AVANCÉES
 * GET /api/products/stats/summary
 */
async function getProductStats(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        console.log('📊 Calcul des statistiques des produits...');

        // ========== 1. STATISTIQUES GÉNÉRALES ==========
        const generalStatsPipeline = [
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    averagePrice: { $avg: '$price' },
                    maxPrice: { $max: '$price' },
                    minPrice: { $min: '$price' },
                    totalStock: { $sum: { $ifNull: ['$stock', 0] } },
                    totalValue: { 
                        $sum: { 
                            $multiply: [
                                { $ifNull: ['$price', 0] },
                                { $ifNull: ['$stock', 0] }
                            ]
                        }
                    },
                    averageRating: { $avg: { $ifNull: ['$rating', 0] } },
                    outOfStock: {
                        $sum: { $cond: [{ $lte: [{ $ifNull: ['$stock', 0] }, 0] }, 1, 0] }
                    },
                    lowStock: {
                        $sum: { $cond: [
                            { 
                                $and: [
                                    { $gt: [{ $ifNull: ['$stock', 0] }, 0] },
                                    { $lte: [{ $ifNull: ['$stock', 0] }, 10] }
                                ]
                            }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalProducts: 1,
                    averagePrice: { $round: ['$averagePrice', 2] },
                    maxPrice: { $round: ['$maxPrice', 2] },
                    minPrice: { $round: ['$minPrice', 2] },
                    totalStock: 1,
                    totalValue: { $round: ['$totalValue', 2] },
                    averageRating: { $round: ['$averageRating', 2] },
                    outOfStock: 1,
                    lowStock: 1,
                    inStock: { $subtract: ['$totalProducts', '$outOfStock'] }
                }
            }
        ];

        // ========== 2. STATISTIQUES PAR CATÉGORIE ==========
        const categoryStatsPipeline = [
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    avgPrice: { $avg: '$price' },
                    totalStock: { $sum: { $ifNull: ['$stock', 0] } },
                    totalValue: { 
                        $sum: { 
                            $multiply: [
                                { $ifNull: ['$price', 0] },
                                { $ifNull: ['$stock', 0] }
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    category: '$_id',
                    count: 1,
                    avgPrice: { $round: ['$avgPrice', 2] },
                    totalStock: 1,
                    totalValue: { $round: ['$totalValue', 2] },
                    percentage: { 
                        $multiply: [
                            { $divide: ['$count', { $literal: 1 }] }, // Will be updated
                            100
                        ]
                    },
                    _id: 0
                }
            },
            { $sort: { count: -1 } }
        ];

        // ========== 3. STATISTIQUES PAR MARQUE ==========
        const brandStatsPipeline = [
            {
                $match: { brand: { $exists: true, $ne: "" } }
            },
            {
                $group: {
                    _id: '$brand',
                    count: { $sum: 1 },
                    avgPrice: { $avg: '$price' },
                    avgRating: { $avg: { $ifNull: ['$rating', 0] } }
                }
            },
            {
                $project: {
                    brand: '$_id',
                    count: 1,
                    avgPrice: { $round: ['$avgPrice', 2] },
                    avgRating: { $round: ['$avgRating', 2] },
                    _id: 0
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ];

        // ========== 4. ÉVOLUTION DES PRIX (derniers produits) ==========
        const priceEvolutionPipeline = [
            { $sort: { createdAt: -1 } },
            { $limit: 20 },
            {
                $project: {
                    title: 1,
                    price: 1,
                    category: 1,
                    createdAt: 1,
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                }
            },
            { $sort: { createdAt: 1 } }
        ];

        // Exécuter toutes les aggregations en parallèle
        const [
            generalStats,
            categoryStats,
            brandStats,
            priceEvolution
        ] = await Promise.all([
            productsCollection.aggregate(generalStatsPipeline).toArray(),
            productsCollection.aggregate(categoryStatsPipeline).toArray(),
            productsCollection.aggregate(brandStatsPipeline).toArray(),
            productsCollection.aggregate(priceEvolutionPipeline).toArray()
        ]);

        // Calculer les pourcentages pour les catégories
        const totalCount = generalStats[0]?.totalProducts || 1;
        categoryStats.forEach(cat => {
            cat.percentage = ((cat.count / totalCount) * 100).toFixed(2);
        });

        const response = {
            success: true,
            message: 'Statistiques récupérées avec succès',
            data: {
                general: generalStats[0] || {
                    totalProducts: 0,
                    averagePrice: 0,
                    maxPrice: 0,
                    minPrice: 0,
                    totalStock: 0,
                    totalValue: 0,
                    averageRating: 0,
                    outOfStock: 0,
                    lowStock: 0,
                    inStock: 0
                },
                byCategory: categoryStats,
                byBrand: brandStats,
                priceEvolution: priceEvolution,
                summary: {
                    totalCategories: categoryStats.length,
                    totalBrands: brandStats.length,
                    lastUpdated: new Date().toISOString(),
                    dataFreshness: 'Temps réel'
                }
            },
            metadata: {
                timestamp: new Date().toISOString(),
                executionTime: Date.now(),
                collection: 'products',
                database: db.databaseName
            }
        };

        console.log(`📈 Statistiques calculées: ${generalStats[0]?.totalProducts || 0} produits analysés`);
        res.json(response);

    } catch (error) {
        console.error('❌ Erreur dans getProductStats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors du calcul des statistiques',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * ➕ CRÉER UN NOUVEAU PRODUIT
 * POST /api/products
 */
async function createProduct(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        console.log('➕ Création d\'un nouveau produit...');
        console.log('📦 Données reçues:', req.body);

        // ========== 1. VALIDATION DES DONNÉES ==========
        const requiredFields = ['title', 'price'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Champs requis manquants',
                missingFields,
                example: {
                    title: "Nom du produit",
                    description: "Description optionnelle",
                    price: 99.99,
                    category: "Électronique",
                    stock: 10,
                    brand: "Marque"
                }
            });
        }

        // Validation du prix
        const price = parseFloat(req.body.price);
        if (isNaN(price) || price < 0) {
            return res.status(400).json({
                success: false,
                message: 'Le prix doit être un nombre positif',
                received: req.body.price
            });
        }

        // Validation du stock
        const stock = req.body.stock !== undefined ? parseInt(req.body.stock) : 0;
        if (isNaN(stock) || stock < 0) {
            return res.status(400).json({
                success: false,
                message: 'Le stock doit être un nombre positif',
                received: req.body.stock
            });
        }

        // Validation du rating
        let rating = null;
        if (req.body.rating !== undefined) {
            rating = parseFloat(req.body.rating);
            if (isNaN(rating) || rating < 0 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'Le rating doit être entre 0 et 5',
                    received: req.body.rating
                });
            }
        }

        // ========== 2. PRÉPARATION DES DONNÉES ==========
        const now = new Date();
        const productData = {
            // Champs obligatoires
            title: req.body.title.trim(),
            price: price,
            
            // Champs optionnels avec valeurs par défaut
            description: req.body.description ? req.body.description.trim() : '',
            category: req.body.category ? req.body.category.trim() : 'Non catégorisé',
            stock: stock,
            brand: req.body.brand ? req.body.brand.trim() : '',
            
            // Champs supplémentaires
            imageUrl: req.body.imageUrl || '',
            tags: Array.isArray(req.body.tags) 
                ? req.body.tags.map(tag => tag.trim()).filter(tag => tag)
                : (req.body.tags ? [req.body.tags.trim()] : []),
            rating: rating,
            specifications: req.body.specifications || {},
            
            // Métadonnées
            createdAt: now,
            updatedAt: now,
            createdBy: 'api',
            
            // Pour la recherche
            searchKeywords: [
                req.body.title.trim().toLowerCase(),
                ...(req.body.brand ? [req.body.brand.trim().toLowerCase()] : []),
                ...(req.body.category ? [req.body.category.trim().toLowerCase()] : [])
            ]
        };

        console.log('✅ Données validées et préparées');

        // ========== 3. INSERTION DANS LA BASE ==========
        const result = await productsCollection.insertOne(productData);
        
        console.log(`🎉 Produit créé avec l'ID: ${result.insertedId}`);

        // ========== 4. RÉPONSE ==========
        const response = {
            success: true,
            message: 'Produit créé avec succès',
            data: {
                productId: result.insertedId,
                product: {
                    ...productData,
                    _id: result.insertedId
                },
                links: {
                    view: `/api/products/${result.insertedId}`,
                    edit: `/api/products/${result.insertedId}`,
                    all: '/api/products'
                }
            },
            metadata: {
                timestamp: now.toISOString(),
                collection: 'products',
                operation: 'insertOne',
                insertedCount: 1
            }
        };

        res.status(201).json(response);

    } catch (error) {
        console.error('❌ Erreur dans createProduct:', error);
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du produit',
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                code: error.code,
                operation: 'insertOne'
            } : undefined,
            troubleshooting: {
                mongoDB: 'Vérifiez que MongoDB est accessible via MongoDB Compass',
                collection: 'Assurez-vous que la collection "products" existe',
                validation: 'Les données doivent correspondre au schéma attendu'
            },
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 👁️ RÉCUPÉRER UN PRODUIT PAR ID
 * GET /api/products/:id
 */
async function getProductById(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        const productId = req.params.id;
        console.log(`👁️  Recherche du produit avec ID: ${productId}`);

        // ========== 1. VALIDATION DE L'ID ==========
        if (!ObjectId.isValid(productId)) {
            console.log(`❌ ID invalide: ${productId}`);
            return res.status(400).json({
                success: false,
                message: 'Format d\'ID invalide',
                receivedId: productId,
                expectedFormat: 'ObjectId MongoDB (24 caractères hexadécimaux)',
                example: '507f1f77bcf86cd799439011'
            });
        }

        // ========== 2. RECHERCHE DU PRODUIT ==========
        const product = await productsCollection.findOne({
            _id: new ObjectId(productId)
        });

        // ========== 3. VÉRIFICATION SI TROUVÉ ==========
        if (!product) {
            console.log(`❌ Produit non trouvé: ${productId}`);
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé',
                productId: productId,
                suggestion: {
                    checkId: 'Vérifiez l\'ID dans MongoDB Compass',
                    listAll: 'Voir tous les produits: GET /api/products',
                    createNew: 'Créer un nouveau produit: POST /api/products'
                }
            });
        }

        console.log(`✅ Produit trouvé: "${product.title}"`);

        // ========== 4. RÉCUPÉRATION DES PRODUITS SIMILAIRES ==========
        let similarProducts = [];
        if (product.category) {
            similarProducts = await productsCollection
                .find({ 
                    _id: { $ne: new ObjectId(productId) },
                    category: product.category 
                })
                .limit(4)
                .toArray();
        }

        // ========== 5. PRÉPARATION DE LA RÉPONSE ==========
        const response = {
            success: true,
            message: 'Produit récupéré avec succès',
            data: {
                product,
                related: {
                    similarProducts: similarProducts,
                    count: similarProducts.length
                },
                navigation: {
                    previous: null, // Pourrait être implémenté avec tri
                    next: null,
                    allInCategory: `/api/products?category=${encodeURIComponent(product.category || '')}`,
                    edit: `/api/products/${productId}`,
                    delete: `/api/products/${productId}`
                }
            },
            metadata: {
                timestamp: new Date().toISOString(),
                id: productId,
                found: true,
                category: product.category || 'Non catégorisé'
            }
        };

        res.json(response);

    } catch (error) {
        console.error('❌ Erreur dans getProductById:', error);
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du produit',
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack
            } : undefined,
            productId: req.params.id,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * ✏️ METTRE À JOUR UN PRODUIT
 * PUT /api/products/:id
 */
async function updateProduct(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        const productId = req.params.id;
        console.log(`✏️  Mise à jour du produit: ${productId}`);
        console.log('📝 Données de mise à jour:', req.body);

        // ========== 1. VALIDATION DE L'ID ==========
        if (!ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Format d\'ID invalide'
            });
        }

        // ========== 2. VÉRIFICATION DE L'EXISTENCE ==========
        const existingProduct = await productsCollection.findOne({
            _id: new ObjectId(productId)
        });

        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }

        // ========== 3. VALIDATION DES DONNÉES ==========
        const updateData = { updatedAt: new Date() };
        
        // Champs autorisés pour la mise à jour
        const allowedFields = [
            'title', 'description', 'price', 'category', 
            'stock', 'brand', 'imageUrl', 'tags', 'rating', 
            'specifications'
        ];
        
        let hasUpdates = false;
        
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                // Validation spécifique selon le champ
                switch (field) {
                    case 'price':
                        const price = parseFloat(req.body[field]);
                        if (isNaN(price) || price < 0) {
                            return res.status(400).json({
                                success: false,
                                message: 'Le prix doit être un nombre positif'
                            });
                        }
                        updateData[field] = price;
                        break;
                        
                    case 'stock':
                        const stock = parseInt(req.body[field]);
                        if (isNaN(stock) || stock < 0) {
                            return res.status(400).json({
                                success: false,
                                message: 'Le stock doit être un nombre positif'
                            });
                        }
                        updateData[field] = stock;
                        break;
                        
                    case 'rating':
                        const rating = parseFloat(req.body[field]);
                        if (isNaN(rating) || rating < 0 || rating > 5) {
                            return res.status(400).json({
                                success: false,
                                message: 'Le rating doit être entre 0 et 5'
                            });
                        }
                        updateData[field] = rating;
                        break;
                        
                    case 'title':
                        if (!req.body[field].trim()) {
                            return res.status(400).json({
                                success: false,
                                message: 'Le titre ne peut pas être vide'
                            });
                        }
                        updateData[field] = req.body[field].trim();
                        break;
                        
                    default:
                        if (typeof req.body[field] === 'string') {
                            updateData[field] = req.body[field].trim();
                        } else {
                            updateData[field] = req.body[field];
                        }
                }
                
                hasUpdates = true;
            }
        }

        if (!hasUpdates) {
            return res.status(400).json({
                success: false,
                message: 'Aucune donnée valide fournie pour la mise à jour',
                allowedFields
            });
        }

        // ========== 4. MISE À JOUR ==========
        const result = await productsCollection.updateOne(
            { _id: new ObjectId(productId) },
            { $set: updateData }
        );

        // ========== 5. RÉCUPÉRATION DU PRODUIT MIS À JOUR ==========
        const updatedProduct = await productsCollection.findOne({
            _id: new ObjectId(productId)
        });

        // ========== 6. RÉPONSE ==========
        const response = {
            success: true,
            message: 'Produit mis à jour avec succès',
            data: {
                product: updatedProduct,
                update: {
                    modifiedCount: result.modifiedCount,
                    matchedCount: result.matchedCount,
                    changes: Object.keys(updateData).filter(k => k !== 'updatedAt')
                },
                links: {
                    view: `/api/products/${productId}`,
                    all: '/api/products'
                }
            },
            metadata: {
                timestamp: new Date().toISOString(),
                operation: 'updateOne',
                productId
            }
        };

        console.log(`✅ Produit mis à jour: ${result.modifiedCount} modification(s)`);
        res.json(response);

    } catch (error) {
        console.error('❌ Erreur dans updateProduct:', error);
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du produit',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 🗑️ SUPPRIMER UN PRODUIT
 * DELETE /api/products/:id
 */
async function deleteProduct(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        const productId = req.params.id;
        console.log(`🗑️  Suppression du produit: ${productId}`);

        // ========== 1. VALIDATION DE L'ID ==========
        if (!ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Format d\'ID invalide'
            });
        }

        // ========== 2. VÉRIFICATION DE L'EXISTENCE ==========
        const existingProduct = await productsCollection.findOne({
            _id: new ObjectId(productId)
        });

        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Produit non trouvé'
            });
        }

        // ========== 3. SUPPRESSION ==========
        const result = await productsCollection.deleteOne({
            _id: new ObjectId(productId)
        });

        // ========== 4. RÉPONSE ==========
        const response = {
            success: true,
            message: 'Produit supprimé avec succès',
            data: {
                deletedProduct: existingProduct,
                deletion: {
                    deletedCount: result.deletedCount,
                    acknowledged: result.acknowledged
                },
                backup: {
                    note: 'Le produit a été définitivement supprimé de la base de données',
                    suggestion: 'Conservez une copie des données importantes'
                }
            },
            metadata: {
                timestamp: new Date().toISOString(),
                operation: 'deleteOne',
                productId
            }
        };

        console.log(`✅ Produit supprimé: "${existingProduct.title}"`);
        res.json(response);

    } catch (error) {
        console.error('❌ Erreur dans deleteProduct:', error);
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du produit',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 🔍 RECHERCHE AVANCÉE DE PRODUITS
 * GET /api/products/search/advanced
 */
async function advancedSearch(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        const {
            query,
            minPrice,
            maxPrice,
            category,
            brand,
            inStock,
            minRating,
            tags,
            sortBy = 'relevance',
            sortOrder = 'desc',
            limit = 20
        } = req.query;

        console.log('🔍 Recherche avancée lancée:', req.query);

        // Construction du filtre
        let filter = {};

        // Recherche texte avec priorité
        if (query) {
            filter.$text = { $search: query };
        }

        // Filtres supplémentaires
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = parseFloat(minPrice);
            if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
        }

        if (category) {
            filter.category = new RegExp(category, 'i');
        }

        if (brand) {
            filter.brand = new RegExp(brand, 'i');
        }

        if (inStock === 'true') {
            filter.stock = { $gt: 0 };
        }

        if (minRating) {
            filter.rating = { $gte: parseFloat(minRating) };
        }

        if (tags) {
            const tagsArray = Array.isArray(tags) ? tags : [tags];
            filter.tags = { $in: tagsArray };
        }

        // Options de tri
        let sortOptions = {};
        if (query && sortBy === 'relevance') {
            sortOptions = { score: { $meta: 'textScore' } };
        } else {
            const sortField = sortBy === 'price' ? 'price' : 
                            sortBy === 'rating' ? 'rating' : 
                            sortBy === 'newest' ? 'createdAt' : 'title';
            sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;
        }

        // Exécution de la recherche
        let cursor = productsCollection.find(filter);
        
        if (query && sortBy === 'relevance') {
            cursor = cursor.project({ score: { $meta: 'textScore' } });
        }
        
        const products = await cursor
            .sort(sortOptions)
            .limit(parseInt(limit))
            .toArray();

        const total = await productsCollection.countDocuments(filter);

        res.json({
            success: true,
            data: {
                products,
                total,
                filters: req.query,
                sort: { by: sortBy, order: sortOrder }
            }
        });

    } catch (error) {
        console.error('❌ Erreur dans advancedSearch:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la recherche avancée' 
        });
    }
}

/**
 * 🏷️ RÉCUPÉRER TOUTES LES CATÉGORIES
 * GET /api/products/categories
 */
async function getAllCategories(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        const categories = await productsCollection.distinct('category');
        
        // Filtrer les valeurs nulles/vides et trier
        const filteredCategories = categories
            .filter(cat => cat && cat.trim() !== '')
            .sort();

        res.json({
            success: true,
            data: {
                categories: filteredCategories,
                count: filteredCategories.length,
                withProducts: await Promise.all(
                    filteredCategories.map(async cat => ({
                        name: cat,
                        count: await productsCollection.countDocuments({ category: cat })
                    }))
                )
            }
        });

    } catch (error) {
        console.error('❌ Erreur dans getAllCategories:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la récupération des catégories' 
        });
    }
}

// Exporter toutes les fonctions
module.exports = {
    getAllProducts,
    getProductStats,
    createProduct,
    getProductById,
    updateProduct,
    deleteProduct,
    advancedSearch,
    getAllCategories
};