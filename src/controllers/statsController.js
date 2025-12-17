// src/controllers/statsController.js - CONTRÔLEUR DES STATISTIQUES AVANCÉES

const { getDB } = require('../config/database');

/**
 * 📊 ENDPOINT COMPLET DES STATISTIQUES
 * GET /api/products/stats
 * 
 * Cet endpoint utilise plusieurs pipelines d'agrégation MongoDB
 * pour répondre à différentes questions business.
 */
async function getProductStats(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        console.log('📊 Démarrage des calculs de statistiques avancées...');

        // ========== EXERCICE 6.1 : STATISTIQUES GLOBALES PAR CATÉGORIE ==========
        const categoryStatsPipeline = [
            // Étape 1: Filtrer les documents (optionnel, pour exclure les catégories vides)
            {
                $match: {
                    category: { $exists: true, $ne: "" }
                }
            },
            
            // Étape 2: Regroupement par catégorie
            {
                $group: {
                    _id: "$category", // Regroupe par catégorie
                    
                    // Accumulateurs pour les statistiques
                    totalProducts: { $sum: 1 }, // Compte le nombre de produits
                    totalStock: { $sum: "$stock" }, // Somme du stock
                    totalValue: { 
                        $sum: { 
                            $multiply: ["$price", "$stock"] // Valeur totale = prix * stock
                        } 
                    },
                    
                    // Statistiques de prix
                    averagePrice: { $avg: "$price" }, // Prix moyen (μ)
                    maxPrice: { $max: "$price" }, // Prix maximum
                    minPrice: { $min: "$price" }, // Prix minimum
                    
                    // Statistiques de rating
                    averageRating: { $avg: "$rating" },
                    maxRating: { $max: "$rating" },
                    minRating: { $min: "$rating" },
                    
                    // Statistiques de réduction
                    totalDiscountProducts: {
                        $sum: { 
                            $cond: [{ $gt: ["$discountPercentage", 0] }, 1, 0]
                        }
                    },
                    averageDiscount: { $avg: "$discountPercentage" }
                }
            },
            
            // Étape 3: Calcul de statistiques supplémentaires
            {
                $addFields: {
                    // Calculer la médiane (approximation)
                    priceRange: { 
                        $subtract: ["$maxPrice", "$minPrice"] 
                    },
                    
                    // Taux de produits en réduction
                    discountRate: {
                        $multiply: [
                            { $divide: ["$totalDiscountProducts", "$totalProducts"] },
                            100
                        ]
                    },
                    
                    // Valeur moyenne par produit
                    averageValuePerProduct: {
                        $divide: ["$totalValue", "$totalProducts"]
                    }
                }
            },
            
            // Étape 4: Tri par prix moyen décroissant
            {
                $sort: { 
                    averagePrice: -1 // -1 = ordre décroissant
                }
            },
            
            // Étape 5: Projection pour formater la réponse
            {
                $project: {
                    _id: 0, // Exclure le champ _id
                    
                    // Renommage des champs pour plus de clarté
                    categoryName: "$_id", // Renommer _id en categoryName
                    
                    // Statistiques de base
                    totalProducts: 1,
                    totalStock: 1,
                    totalValue: { $round: ["$totalValue", 2] },
                    
                    // Statistiques de prix (arrondies à 2 décimales)
                    averagePrice: { $round: ["$averagePrice", 2] },
                    maxPrice: { $round: ["$maxPrice", 2] },
                    minPrice: { $round: ["$minPrice", 2] },
                    priceRange: { $round: ["$priceRange", 2] },
                    
                    // Statistiques de rating (arrondies à 1 décimale)
                    averageRating: { $round: ["$averageRating", 1] },
                    maxRating: { $round: ["$maxRating", 1] },
                    minRating: { $round: ["$minRating", 1] },
                    
                    // Statistiques de réduction
                    totalDiscountProducts: 1,
                    discountRate: { $round: ["$discountRate", 2] },
                    averageDiscount: { $round: ["$averageDiscount", 2] },
                    
                    // Métriques business
                    averageValuePerProduct: { $round: ["$averageValuePerProduct", 2] },
                    
                    // Indicateurs de performance
                    performanceScore: {
                        $multiply: [
                            { $divide: ["$averageRating", 5] }, // Normalisé entre 0 et 1
                            { $log10: { $add: ["$totalProducts", 1] } } // Log pour éviter les valeurs trop grandes
                        ]
                    }
                }
            },
            
            // Étape 6: Limiter si nécessaire (optionnel)
            {
                $limit: 50 // Limite pour éviter des réponses trop grandes
            }
        ];

        const brandAnalysisPipeline = [
    {
        $match: {
            brand: { $exists: true, $ne: "" }
        }
    },
    {
        $group: {
            _id: "$brand",
            totalStock: { $sum: "$stock" },
            totalValue: { 
                $sum: { $multiply: ["$price", "$stock"] }
            },
            productCount: { $sum: 1 },
            averagePrice: { $avg: "$price" }
        }
    },
    {
        $sort: { totalValue: -1 }
    },
    {
        $limit: 10
    },
    {
        $project: {
            _id: 0,
            brand: "$_id",
            totalStock: 1,
            totalValue: { $round: ["$totalValue", 2] },
            productCount: 1,
            averagePrice: { $round: ["$averagePrice", 2] }
        }
    }
];


        // ========== EXERCICE 6.2 : DISTRIBUTION DES PRIX PAR TRANCHE ==========
        const priceDistributionPipeline = [
            {
                $bucket: {
                    groupBy: "$price",
                    boundaries: [0, 100, 500, 1000, 2000, 5000, 10000], // Tranches de prix
                    default: "10000+", // Pour les prix > 10000
                    output: {
                        count: { $sum: 1 },
                        averageRating: { $avg: "$rating" },
                        totalStock: { $sum: "$stock" },
                        categories: { $addToSet: "$category" }
                    }
                }
            },
            {
                $project: {
                    priceRange: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$_id", 0] }, then: "0-100€" },
                                { case: { $eq: ["$_id", 100] }, then: "100-500€" },
                                { case: { $eq: ["$_id", 500] }, then: "500-1000€" },
                                { case: { $eq: ["$_id", 1000] }, then: "1000-2000€" },
                                { case: { $eq: ["$_id", 2000] }, then: "2000-5000€" },
                                { case: { $eq: ["$_id", 5000] }, then: "5000-10000€" }
                            ],
                            default: "10000€+"
                        }
                    },
                    count: 1,
                    percentage: { $multiply: [{ $divide: ["$count", { $literal: 1 }] }, 100] }, // À compléter plus tard
                    averageRating: { $round: ["$averageRating", 2] },
                    totalStock: 1,
                    categoryCount: { $size: "$categories" }
                }
            },
            { $sort: { _id: 1 } }
        ];

        // ========== EXERCICE 6.3 : TOP 10 DES MARQUES ==========
        const topBrandsPipeline = [
            {
                $match: {
                    brand: { $exists: true, $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$brand",
                    productCount: { $sum: 1 },
                    averagePrice: { $avg: "$price" },
                    averageRating: { $avg: "$rating" },
                    totalRevenuePotential: {
                        $sum: { $multiply: ["$price", "$stock"] }
                    },
                    marketShare: { $sum: 1 } // À convertir en pourcentage plus tard
                }
            },
            {
                $sort: { productCount: -1 }
            },
            {
                $limit: 10
            },
            {
                $project: {
                    _id: 0,
                    brand: "$_id",
                    productCount: 1,
                    averagePrice: { $round: ["$averagePrice", 2] },
                    averageRating: { $round: ["$averageRating", 2] },
                    totalRevenuePotential: { $round: ["$totalRevenuePotential", 2] }
                }
            }
        ];

        // ========== EXERCICE 6.4 : ANALYSE DES RATINGS ==========
        const ratingAnalysisPipeline = [
            {
                $bucket: {
                    groupBy: "$rating",
                    boundaries: [0, 1, 2, 3, 4, 5],
                    default: "No Rating",
                    output: {
                        count: { $sum: 1 },
                        averagePrice: { $avg: "$price" },
                        categories: { $addToSet: "$category" }
                    }
                }
            },
            {
                $project: {
                    ratingRange: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$_id", 0] }, then: "0-1 ⭐" },
                                { case: { $eq: ["$_id", 1] }, then: "1-2 ⭐" },
                                { case: { $eq: ["$_id", 2] }, then: "2-3 ⭐" },
                                { case: { $eq: ["$_id", 3] }, then: "3-4 ⭐" },
                                { case: { $eq: ["$_id", 4] }, then: "4-5 ⭐" }
                            ],
                            default: "Non noté"
                        }
                    },
                    count: 1,
                    averagePrice: { $round: ["$averagePrice", 2] },
                    categoryCount: { $size: "$categories" }
                }
            },
            { $sort: { _id: 1 } }
        ];

        // ========== EXERCICE 6.2 : MEILLEURS PRODUITS PAR NOTATION ==========
const bestRatedPipeline = [
    // $match - Prix > 500 et rating existant
    {
        $match: {
            price: { $gt: 500 },
            rating: { $exists: true, $ne: null }
        }
    },
    
    // $sort - Par rating décroissant
    {
        $sort: { rating: -1 }
    },
    
    // $limit - 5 premiers
    {
        $limit: 5
    },
    
    // $project - Champs demandés
    {
        $project: {
            _id: 0,
            title: 1,
            price: 1,
            rating: 1,
            category: 1,
            brand: 1
        }
    }
];


        // ========== EXERCICE 6.5 : TENDANCE DES PRIX PAR CATÉGORIE ==========
        const priceTrendPipeline = [
            {
                $group: {
                    _id: {
                        category: "$category",
                        priceRange: {
                            $switch: {
                                branches: [
                                    { case: { $lt: ["$price", 100] }, then: "Bas (<100€)" },
                                    { case: { $lt: ["$price", 500] }, then: "Moyen (100-500€)" },
                                    { case: { $lt: ["$price", 1000] }, then: "Élevé (500-1000€)" }
                                ],
                                default: "Premium (>1000€)"
                            }
                        }
                    },
                    count: { $sum: 1 },
                    avgRating: { $avg: "$rating" }
                }
            },
            {
                $group: {
                    _id: "$_id.category",
                    priceSegments: {
                        $push: {
                            range: "$_id.priceRange",
                            count: "$count",
                            percentage: { $multiply: [{ $divide: ["$count", { $literal: 1 }] }, 100] }
                        }
                    },
                    totalProducts: { $sum: "$count" }
                }
            },
            {
                $project: {
                    category: "$_id",
                    priceSegments: {
                        $map: {
                            input: "$priceSegments",
                            as: "segment",
                            in: {
                                range: "$$segment.range",
                                count: "$$segment.count",
                                percentage: {
                                    $round: [
                                        { $multiply: [{ $divide: ["$$segment.count", "$totalProducts"] }, 100] },
                                        2
                                    ]
                                }
                            }
                        }
                    },
                    totalProducts: 1
                }
            },
            { $sort: { totalProducts: -1 } },
            { $limit: 5 }
        ];

        // ========== EXÉCUTION PARALLÈLE DE TOUS LES PIPELINES ==========
        console.log('⚡ Exécution des pipelines d\'agrégation en parallèle...');
        
        const [
            categoryStats,
            priceDistribution,
            topBrands,
            ratingAnalysis,
            priceTrends,
            overallStats,
            bestRatedProducts,
            brandAnalysis
        ] = await Promise.all([
            productsCollection.aggregate(categoryStatsPipeline).toArray(),
            productsCollection.aggregate(priceDistributionPipeline).toArray(),
            productsCollection.aggregate(topBrandsPipeline).toArray(),
            productsCollection.aggregate(ratingAnalysisPipeline).toArray(),
            productsCollection.aggregate(priceTrendPipeline).toArray(),
            productsCollection.aggregate(bestRatedPipeline).toArray(),
            productsCollection.aggregate(brandAnalysisPipeline).toArray(),

            
            
            // Statistiques globales
            productsCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalProducts: { $sum: 1 },
                        totalCategories: { $addToSet: "$category" },
                        totalBrands: { $addToSet: "$brand" },
                        avgPrice: { $avg: "$price" },
                        avgRating: { $avg: "$rating" },
                        totalStockValue: {
                            $sum: { $multiply: ["$price", "$stock"] }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalProducts: 1,
                        totalCategories: { $size: "$totalCategories" },
                        totalBrands: { $size: "$totalBrands" },
                        avgPrice: { $round: ["$avgPrice", 2] },
                        avgRating: { $round: ["$avgRating", 2] },
                        totalStockValue: { $round: ["$totalStockValue", 2] }
                    }
                }
            ]).toArray()
        ]);

        // ========== CALCUL DES POURCENTAGES POUR LA DISTRIBUTION DES PRIX ==========
        const totalProducts = overallStats[0]?.totalProducts || 1;
        
        priceDistribution.forEach(item => {
            item.percentage = ((item.count / totalProducts) * 100).toFixed(2);
        });

        // Calcul du market share pour les marques
        topBrands.forEach(brand => {
            brand.marketShare = ((brand.productCount / totalProducts) * 100).toFixed(2);
        });

        // ========== PRÉPARATION DE LA RÉPONSE ==========
        const response = {
            success: true,
            message: 'Statistiques avancées récupérées avec succès',
            metadata: {
                timestamp: new Date().toISOString(),
                totalProducts: totalProducts,
                executionTime: Date.now(),
                pipelinesExecuted: 6
            },
            data: {
                // Exercice 6.1 - Statistiques globales par catégorie
                categoryStatistics: {
                    description: "📊 Statistiques détaillées par catégorie (Exercice 6.1)",
                    totalCategories: categoryStats.length,
                    categories: categoryStats,
                    insights: {
                        highestAvgPriceCategory: categoryStats[0] || null,
                        lowestAvgPriceCategory: categoryStats[categoryStats.length - 1] || null,
                        mostProductsCategory: [...categoryStats].sort((a, b) => b.totalProducts - a.totalProducts)[0] || null
                    }
                },

                // Exercice 6.2 - Distribution des prix
                priceDistribution: {
                    description: "💰 Distribution des produits par tranche de prix",
                    distribution: priceDistribution,
                    summary: {
                        affordableProducts: priceDistribution.filter(p => p.priceRange.includes("0-100") || p.priceRange.includes("100-500")).reduce((sum, p) => sum + p.count, 0),
                        premiumProducts: priceDistribution.filter(p => p.priceRange.includes("1000-2000") || p.priceRange.includes("2000-5000") || p.priceRange.includes("5000-10000") || p.priceRange.includes("10000€+")).reduce((sum, p) => sum + p.count, 0)
                    }
                },

                brandAnalysis: {
    description: "🏭 Top 10 des marques par valeur de stock - Exercice 6.3",
    brands: brandAnalysis,
    totalStockValue: brandAnalysis.reduce((sum, brand) => sum + brand.totalValue, 0),
    pipeline: [
        "$match: produits avec marque définie",
        "$group: regrouper par brand avec $sum et $multiply",
        "$sort: par totalValue décroissant",
        "$limit: 10 marques",
        "$project: formater les résultats"
    ]
},

                // Exercice 6.3 - Top 10 des marques
                topBrands: {
                    description: "🏭 Top 10 des marques par nombre de produits",
                    brands: topBrands,
                    marketLeader: topBrands[0] || null
                },

                // Exercice 6.4 - Analyse des ratings
                ratingAnalysis: {
                    description: "⭐ Distribution des évaluations des produits",
                    ratings: ratingAnalysis,
                    overallRating: overallStats[0]?.avgRating || 0
                },

                bestRatedAnalysis: {
    description: "🏆 Top 5 des produits les mieux notés (prix > 500€) - Exercice 6.2",
    products: bestRatedProducts,
    pipeline: [
        "$match: price > 500 et rating existant",
        "$sort: rating décroissant",
        "$limit: 5 résultats",
        "$project: title, price, rating"
    ]
},

                // Exercice 6.5 - Tendance des prix par catégorie
                priceTrends: {
                    description: "📈 Segmentation des prix par catégorie",
                    trends: priceTrends
                },

                // Statistiques globales
                overall: overallStats[0] || {
                    totalProducts: 0,
                    totalCategories: 0,
                    totalBrands: 0,
                    avgPrice: 0,
                    avgRating: 0,
                    totalStockValue: 0
                },

                // KPIs Business
                businessKPIs: {
                    inventoryValue: overallStats[0]?.totalStockValue || 0,
                    averageProductValue: overallStats[0]?.totalStockValue ? (overallStats[0].totalStockValue / totalProducts).toFixed(2) : 0,
                    ratingDistribution: ratingAnalysis.reduce((acc, curr) => {
                        if (curr.ratingRange.includes("4-5")) {
                            acc.highRatedProducts = curr.count;
                        } else if (curr.ratingRange.includes("0-1") || curr.ratingRange.includes("1-2")) {
                            acc.lowRatedProducts = (acc.lowRatedProducts || 0) + curr.count;
                        }
                        return acc;
                    }, { highRatedProducts: 0, lowRatedProducts: 0 })
                }
            },
            
            // Documentation de l'API
            documentation: {
                endpoint: "/api/products/stats",
                exercises: {
                    "6.1": "Statistiques globales par catégorie ($group, $sort, $project)",
                    "6.2": "Distribution des prix par tranche ($bucket)",
                    "6.3": "Top 10 des marques ($group, $sort, $limit)",
                    "6.4": "Analyse des ratings ($bucket)",
                    "6.5": "Tendance des prix par catégorie ($group imbriqué)"
                },
                aggregationStagesUsed: [
                    "$match", "$group", "$sort", "$project", "$bucket",
                    "$addFields", "$limit", "$addToSet", "$size", "$multiply",
                    "$divide", "$round", "$switch", "$case", "$push", "$map"
                ]
            }
        };

        console.log(`✅ Statistiques calculées: ${totalProducts} produits analysés`);
        console.log(`📈 ${categoryStats.length} catégories traitées`);
        console.log(`🏭 ${topBrands.length} marques analysées`);

        res.json(response);

    } catch (error) {
        console.error('❌ Erreur dans getProductStats:', error);
        console.error('Stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors du calcul des statistiques avancées',
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                code: error.code,
                operation: 'aggregate'
            } : undefined,
            timestamp: new Date().toISOString(),
            troubleshooting: {
                mongoDB: 'Vérifiez votre connexion MongoDB avec MongoDB Compass',
                collection: 'Assurez-vous que la collection "products" existe et contient des données',
                aggregation: 'Les pipelines d\'agrégation peuvent nécessiter des indexes spécifiques'
            }
        });
    }
}

/**
 * 📈 ENDPOINT SIMPLIFIÉ POUR LES STATISTIQUES PAR CATÉGORIE
 * GET /api/products/stats/categories
 * 
 * Version simplifiée de l'exercice 6.1
 */
async function getCategoryStats(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        // Pipeline spécifique pour l'exercice 6.1
        const pipeline = [
            // Étape 1: Filtrer les produits avec une catégorie
            {
                $match: {
                    category: { $exists: true, $ne: "" }
                }
            },
            
            // Étape 2: Regroupement par catégorie (Exercice 6.1 - $group)
            {
                $group: {
                    _id: "$category",
                    
                    // Accumulateurs demandés
                    totalProducts: { $sum: 1 },           // Nombre total de produits
                    averagePrice: { $avg: "$price" },     // Prix moyen (μ)
                    maxPrice: { $max: "$price" },         // Prix maximum
                    minPrice: { $min: "$price" },         // Prix minimum
                    
                    // Statistiques supplémentaires
                    totalStock: { $sum: "$stock" }
                }
            },
            
            // Étape 3: Tri par prix moyen décroissant (Exercice 6.1 - $sort)
            {
                $sort: { 
                    averagePrice: -1 
                }
            },
            
            // Étape 4: Projection pour formater la réponse (Exercice 6.1 - $project)
            {
                $project: {
                    _id: 0,
                    categoryName: "$_id",                 // Renommer _id en categoryName
                    totalProducts: 1,
                    averagePrice: { $round: ["$averagePrice", 2] },  // Arrondir à 2 décimales
                    maxPrice: { $round: ["$maxPrice", 2] },
                    minPrice: { $round: ["$minPrice", 2] },
                    totalStock: 1,
                    
                    // Calculer la fourchette de prix
                    priceRange: {
                        $round: [
                            { $subtract: ["$maxPrice", "$minPrice"] },
                            2
                        ]
                    }
                }
            }
        ];

        const categoryStats = await productsCollection.aggregate(pipeline).toArray();

        // Calcul des statistiques globales
        const summary = {
            totalCategories: categoryStats.length,
            totalProducts: categoryStats.reduce((sum, cat) => sum + cat.totalProducts, 0),
            averagePriceAcrossCategories: categoryStats.length > 0 
                ? (categoryStats.reduce((sum, cat) => sum + cat.averagePrice, 0) / categoryStats.length).toFixed(2)
                : 0
        };

        res.json({
            success: true,
            message: 'Statistiques par catégorie récupérées avec succès',
            exercise: '6.1 - Calcul des Statistiques Globales par Catégorie',
            pipelineStages: [
                '$match: Filtrer les produits avec catégorie',
                '$group: Regrouper par catégorie et calculer les statistiques',
                '$sort: Trier par prix moyen décroissant',
                '$project: Renommer et formater les champs'
            ],
            data: {
                categories: categoryStats,
                summary: summary
            },
            metadata: {
                timestamp: new Date().toISOString(),
                collection: 'products',
                stagesCount: 4
            }
        });

    } catch (error) {
        console.error('❌ Erreur dans getCategoryStats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors du calcul des statistiques par catégorie' 
        });
    }
}

/**
 * 🎯 ENDPOINT POUR TESTER DIFFÉRENTS PIPELINES
 * GET /api/products/stats/test?pipeline=category|price|brand|rating
 */
async function testAggregationPipeline(req, res) {
    try {
        const { pipeline } = req.query;
        const db = getDB();
        const productsCollection = db.collection('products');

        let selectedPipeline = [];
        let description = '';

        switch (pipeline) {
            case 'category':
                // Pipeline de l'exercice 6.1
                selectedPipeline = [
                    { $group: { 
                        _id: "$category", 
                        totalProducts: { $sum: 1 },
                        averagePrice: { $avg: "$price" },
                        maxPrice: { $max: "$price" },
                        minPrice: { $min: "$price" }
                    }},
                    { $sort: { averagePrice: -1 } },
                    { $project: { 
                        _id: 0, 
                        categoryName: "$_id", 
                        totalProducts: 1,
                        averagePrice: { $round: ["$averagePrice", 2] },
                        maxPrice: { $round: ["$maxPrice", 2] },
                        minPrice: { $round: ["$minPrice", 2] }
                    }}
                ];
                description = 'Exercice 6.1 - Statistiques par catégorie';
                break;

            case 'price':
                // Distribution des prix
                selectedPipeline = [
                    { $bucket: {
                        groupBy: "$price",
                        boundaries: [0, 100, 500, 1000, 2000],
                        default: "2000+",
                        output: { count: { $sum: 1 } }
                    }},
                    { $project: {
                        priceRange: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$_id", 0] }, then: "0-100€" },
                                    { case: { $eq: ["$_id", 100] }, then: "100-500€" },
                                    { case: { $eq: ["$_id", 500] }, then: "500-1000€" },
                                    { case: { $eq: ["$_id", 1000] }, then: "1000-2000€" }
                                ],
                                default: "2000€+"
                            }
                        },
                        count: 1
                    }}
                ];
                description = 'Distribution des prix par tranche';
                break;

            case 'brand':
                // Top des marques
                selectedPipeline = [
                    { $match: { brand: { $exists: true, $ne: "" } } },
                    { $group: {
                        _id: "$brand",
                        productCount: { $sum: 1 },
                        averagePrice: { $avg: "$price" }
                    }},
                    { $sort: { productCount: -1 } },
                    { $limit: 5 },
                    { $project: {
                        _id: 0,
                        brand: "$_id",
                        productCount: 1,
                        averagePrice: { $round: ["$averagePrice", 2] }
                    }}
                ];
                description = 'Top 5 des marques';
                break;

            case 'rating':
                // Analyse des ratings
                selectedPipeline = [
                    { $bucket: {
                        groupBy: "$rating",
                        boundaries: [0, 2, 3, 4, 5],
                        output: { count: { $sum: 1 } }
                    }},
                    { $project: {
                        ratingRange: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$_id", 0] }, then: "0-2 ⭐" },
                                    { case: { $eq: ["$_id", 2] }, then: "2-3 ⭐" },
                                    { case: { $eq: ["$_id", 3] }, then: "3-4 ⭐" },
                                    { case: { $eq: ["$_id", 4] }, then: "4-5 ⭐" }
                                ],
                                default: "Non noté"
                            }
                        },
                        count: 1
                    }}
                ];
                description = 'Distribution des ratings';
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Pipeline non spécifié ou invalide',
                    availablePipelines: ['category', 'price', 'brand', 'rating']
                });
        }

        const result = await productsCollection.aggregate(selectedPipeline).toArray();

        res.json({
            success: true,
            pipeline: pipeline,
            description: description,
            stages: selectedPipeline.map((stage, index) => ({
                stageNumber: index + 1,
                operator: Object.keys(stage)[0],
                details: stage[Object.keys(stage)[0]]
            })),
            result: result,
            count: result.length,
            metadata: {
                timestamp: new Date().toISOString(),
                collection: 'products'
            }
        });

    } catch (error) {
        console.error('❌ Erreur dans testAggregationPipeline:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors du test du pipeline' 
        });
    }
}

async function getBestRatedProducts(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        // Récupérer les paramètres de la requête
        const minPrice = parseFloat(req.query.minPrice) || 500;
        const limit = parseInt(req.query.limit) || 5;
        const sortOrder = req.query.order === 'asc' ? 1 : -1; // desc par défaut

        console.log(`🔍 Recherche des meilleurs produits: prix > ${minPrice}€, limit: ${limit}`);

        // ========== PIPELINE EXERCICE 6.2 ==========
        const pipeline = [
            // Étape 1: $match - Filtrer les produits avec price > minPrice
            {
                $match: {
                    price: { $gt: minPrice },           // Prix supérieur à minPrice
                    rating: { $exists: true, $ne: null } // Rating doit exister
                }
            },
            
            // Étape 2: $sort - Trier par rating en ordre décroissant (ou croissant)
            {
                $sort: { 
                    rating: sortOrder                   // -1 = décroissant, 1 = croissant
                }
            },
            
            // Étape 3: $limit - Limiter aux N premiers résultats
            {
                $limit: limit
            },
            
            // Étape 4: $project - Sélectionner uniquement les champs nécessaires
            {
                $project: {
                    _id: 0,                            // Exclure l'ID
                    title: 1,                          // Inclure le titre
                    price: 1,                          // Inclure le prix
                    rating: 1,                         // Inclure le rating
                    
                    // Informations supplémentaires utiles
                    category: 1,
                    brand: 1,
                    stock: 1,
                    thumbnail: 1,
                    
                    // Calculer le rapport qualité-prix
                    valueScore: {
                        $round: [
                            { $divide: ["$rating", "$price"] },
                            4
                        ]
                    }
                }
            }
        ];

        // Exécuter le pipeline
        const bestProducts = await productsCollection.aggregate(pipeline).toArray();

        // Calculer des statistiques supplémentaires
        const stats = {
            totalFound: bestProducts.length,
            averageRating: bestProducts.length > 0 
                ? (bestProducts.reduce((sum, p) => sum + p.rating, 0) / bestProducts.length).toFixed(2)
                : 0,
            averagePrice: bestProducts.length > 0 
                ? (bestProducts.reduce((sum, p) => sum + p.price, 0) / bestProducts.length).toFixed(2)
                : 0,
            priceRange: bestProducts.length > 0 
                ? {
                    min: Math.min(...bestProducts.map(p => p.price)),
                    max: Math.max(...bestProducts.map(p => p.price))
                }
                : null
        };

        // ========== PIPELINE POUR LES PIRE PRODUITS (BONUS) ==========
        let worstProducts = [];
        if (req.query.includeWorst === 'true') {
            const worstPipeline = [
                {
                    $match: {
                        price: { $gt: minPrice },
                        rating: { $exists: true, $ne: null }
                    }
                },
                {
                    $sort: { 
                        rating: 1  // Ordre croissant pour les pires
                    }
                },
                {
                    $limit: limit
                },
                {
                    $project: {
                        _id: 0,
                        title: 1,
                        price: 1,
                        rating: 1,
                        category: 1,
                        brand: 1
                    }
                }
            ];

            worstProducts = await productsCollection.aggregate(worstPipeline).toArray();
        }

        // ========== PRÉPARATION DE LA RÉPONSE ==========
        const response = {
            success: true,
            message: bestProducts.length > 0 
                ? `${bestProducts.length} meilleurs produits trouvés`
                : 'Aucun produit ne correspond aux critères',
            
            exercise: '6.2 - Recherche des Meilleurs Produits par Notation',
            description: 'Trouver les produits les mieux notés avec un prix supérieur au seuil défini',
            
            parameters: {
                minPrice: minPrice,
                limit: limit,
                sortOrder: sortOrder === -1 ? 'descendant (meilleurs)' : 'ascendant (pires)',
                ratingRequired: true
            },
            
            pipelineStages: [
                {
                    stage: 1,
                    operator: '$match',
                    description: `Filtrer les produits avec price > ${minPrice} et rating non null`,
                    query: { price: { $gt: minPrice }, rating: { $exists: true } }
                },
                {
                    stage: 2,
                    operator: '$sort',
                    description: `Trier par rating (${sortOrder === -1 ? 'descendant' : 'ascendant'})`,
                    sort: { rating: sortOrder }
                },
                {
                    stage: 3,
                    operator: '$limit',
                    description: `Limiter à ${limit} résultats`
                },
                {
                    stage: 4,
                    operator: '$project',
                    description: 'Sélectionner les champs title, price, rating',
                    fields: ['title', 'price', 'rating', 'category', 'brand', 'valueScore']
                }
            ],
            
            data: {
                bestProducts: bestProducts,
                statistics: stats,
                
                // Données supplémentaires si demandées
                ...(worstProducts.length > 0 && {
                    worstProducts: worstProducts,
                    comparison: {
                        bestAverageRating: stats.averageRating,
                        worstAverageRating: worstProducts.length > 0 
                            ? (worstProducts.reduce((sum, p) => sum + p.rating, 0) / worstProducts.length).toFixed(2)
                            : 0
                    }
                })
            },
            
            insights: bestProducts.length > 0 ? {
                bestProduct: bestProducts[0],
                bestValueProduct: [...bestProducts].sort((a, b) => b.valueScore - a.valueScore)[0],
                categories: [...new Set(bestProducts.map(p => p.category))],
                brands: [...new Set(bestProducts.map(p => p.brand))]
            } : null,
            
            metadata: {
                timestamp: new Date().toISOString(),
                collection: 'products',
                totalProducts: await productsCollection.countDocuments({
                    price: { $gt: minPrice },
                    rating: { $exists: true }
                })
            }
        };

        console.log(`✅ ${bestProducts.length} meilleurs produits trouvés (prix > ${minPrice}€)`);
        
        if (bestProducts.length > 0) {
            console.log(`🏆 Meilleur produit: ${bestProducts[0].title} (${bestProducts[0].rating}⭐)`);
        }

        res.json(response);

    } catch (error) {
        console.error('❌ Erreur dans getBestRatedProducts:', error);
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche des meilleurs produits',
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                operation: 'aggregation'
            } : undefined,
            exercise: '6.2',
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 🎯 VERSION ALTERNATIVE AVEC PLUS D'OPTIONS
 * GET /api/products/stats/top-rated
 */
async function getTopRatedProducts(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        // Paramètres avancés
        const {
            minPrice = 500,
            maxPrice,
            minRating = 4,
            category,
            brand,
            limit = 5,
            sortBy = 'rating',
            includeDetails = false
        } = req.query;

        console.log('🎯 Recherche de produits top-rated avec filtres avancés');

        // Construction du filtre $match
        const matchFilter = {
            rating: { $gte: parseFloat(minRating) }
        };

        if (minPrice) matchFilter.price = { $gt: parseFloat(minPrice) };
        if (maxPrice) {
            matchFilter.price = matchFilter.price || {};
            matchFilter.price.$lt = parseFloat(maxPrice);
        }
        if (category) matchFilter.category = category;
        if (brand) matchFilter.brand = brand;

        // Pipeline pour les produits premium
        const premiumPipeline = [
            { $match: matchFilter },
            { $sort: { [sortBy]: -1 } },
            { $limit: parseInt(limit) },
            {
                $project: {
                    _id: 0,
                    title: 1,
                    price: 1,
                    rating: 1,
                    ...(includeDetails === 'true' && {
                        description: 1,
                        category: 1,
                        brand: 1,
                        stock: 1,
                        thumbnail: 1,
                        valueRatio: { $divide: ["$rating", "$price"] }
                    })
                }
            }
        ];

        const topProducts = await productsCollection.aggregate(premiumPipeline).toArray();

        // Pipeline pour les statistiques
        const statsPipeline = [
            { $match: matchFilter },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    avgPrice: { $avg: "$price" },
                    avgRating: { $avg: "$rating" },
                    maxRating: { $max: "$rating" }
                }
            }
        ];

        const statsResult = await productsCollection.aggregate(statsPipeline).toArray();
        const stats = statsResult[0] || { count: 0, avgPrice: 0, avgRating: 0 };

        res.json({
            success: true,
            data: {
                products: topProducts,
                filtersApplied: matchFilter,
                statistics: {
                    totalMatchingProducts: stats.count,
                    averagePrice: parseFloat(stats.avgPrice).toFixed(2),
                    averageRating: parseFloat(stats.avgRating).toFixed(2),
                    maxRating: stats.maxRating
                }
            }
        });

    } catch (error) {
        console.error('❌ Erreur dans getTopRatedProducts:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}


// Ajouter cette fonction dans src/controllers/statsController.js

/**
 * 🏭 EXERCICE 6.3 : ANALYSE PAR MARQUE - STOCK ET VALEUR TOTALE
 * GET /api/products/stats/brand-analysis
 * 
 * Objectif : Pour chaque marque, calculer :
 * - Le stock total (somme des stocks)
 * - La valeur totale du stock (somme de price * stock)
 * - Le nombre de produits
 * - Le prix moyen
 */
async function getBrandAnalysis(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        console.log('🏭 Analyse des marques - Exercice 6.3');

        // ========== PIPELINE EXERCICE 6.3 - VERSION BASE ==========
        const basicPipeline = [
            // Étape 1: Filtrer les produits avec une marque définie
            {
                $match: {
                    brand: { $exists: true, $ne: "" },
                    stock: { $exists: true },
                    price: { $exists: true }
                }
            },
            
            // Étape 2: Regrouper par marque (brand)
            {
                $group: {
                    _id: "$brand",  // Regroupement par marque
                    
                    // Accumulateur 1: Somme du stock
                    totalStock: { $sum: "$stock" },
                    
                    // Accumulateur 2: Valeur totale (price * stock)
                    totalValue: { 
                        $sum: { 
                            $multiply: ["$price", "$stock"] 
                        } 
                    },
                    
                    // Statistiques supplémentaires
                    productCount: { $sum: 1 },               // Nombre de produits
                    averagePrice: { $avg: "$price" },        // Prix moyen
                    averageRating: { $avg: "$rating" },      // Rating moyen
                    maxPrice: { $max: "$price" },           // Prix max
                    minPrice: { $min: "$price" }            // Prix min
                }
            },
            
            // Étape 3: Trier par valeur totale décroissante
            {
                $sort: { totalValue: -1 }
            },
            
            // Étape 4: Formater la réponse
            {
                $project: {
                    _id: 0,
                    brand: "$_id",                         // Renommer _id en brand
                    
                    // Métriques principales
                    totalStock: 1,
                    totalValue: { $round: ["$totalValue", 2] },
                    productCount: 1,
                    
                    // Statistiques de prix
                    averagePrice: { $round: ["$averagePrice", 2] },
                    averageRating: { $round: ["$averageRating", 2] },
                    priceRange: {
                        min: { $round: ["$minPrice", 2] },
                        max: { $round: ["$maxPrice", 2] }
                    },
                    
                    // Métriques dérivées
                    averageStockPerProduct: {
                        $round: [
                            { $divide: ["$totalStock", "$productCount"] },
                            2
                        ]
                    },
                    averageValuePerProduct: {
                        $round: [
                            { $divide: ["$totalValue", "$productCount"] },
                            2
                        ]
                    }
                }
            }
        ];

        // ========== PIPELINE AVANCÉ - AVEC $UNWIND (SIMULATION) ==========
        // Pour démontrer $unwind, on simule avec des tags
        const advancedPipeline = [
            // Étape 1: Filtrer les produits avec tags
            {
                $match: {
                    tags: { $exists: true, $ne: [] },
                    brand: { $exists: true, $ne: "" }
                }
            },
            
            // Étape 2: $unwind - Décomposer le tableau tags
            {
                $unwind: "$tags"
            },
            
            // Étape 3: Regrouper par marque ET tag
            {
                $group: {
                    _id: {
                        brand: "$brand",
                        tag: "$tags"
                    },
                    productCount: { $sum: 1 },
                    totalStock: { $sum: "$stock" },
                    totalValue: { 
                        $sum: { $multiply: ["$price", "$stock"] }
                    }
                }
            },
            
            // Étape 4: Trier
            {
                $sort: { "_id.brand": 1, totalValue: -1 }
            },
            
            // Étape 5: Projection finale
            {
                $project: {
                    _id: 0,
                    brand: "$_id.brand",
                    tag: "$_id.tag",
                    productCount: 1,
                    totalStock: 1,
                    totalValue: { $round: ["$totalValue", 2] }
                }
            },
            { $limit: 20 }
        ];

        // ========== PIPELINE POUR LE MARKET SHARE ==========
        const marketSharePipeline = [
            {
                $match: {
                    brand: { $exists: true, $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$brand",
                    totalValue: { $sum: { $multiply: ["$price", "$stock"] } }
                }
            },
            {
                $group: {
                    _id: null,
                    totalMarketValue: { $sum: "$totalValue" },
                    brands: { $push: { brand: "$_id", brandValue: "$totalValue" } }
                }
            },
            {
                $unwind: "$brands"
            },
            {
                $project: {
                    _id: 0,
                    brand: "$brands.brand",
                    brandValue: { $round: ["$brands.brandValue", 2] },
                    marketShare: {
                        $round: [
                            { 
                                $multiply: [
                                    { $divide: ["$brands.brandValue", "$totalMarketValue"] },
                                    100
                                ]
                            },
                            2
                        ]
                    },
                    totalMarketValue: { $round: ["$totalMarketValue", 2] }
                }
            },
            { $sort: { marketShare: -1 } },
            { $limit: 10 }
        ];

        // ========== EXÉCUTION DES PIPELINES ==========
        console.log('⚡ Exécution des pipelines d\'analyse par marque...');
        
        const [brandStats, tagAnalysis, marketShare] = await Promise.all([
            productsCollection.aggregate(basicPipeline).toArray(),
            productsCollection.aggregate(advancedPipeline).toArray(),
            productsCollection.aggregate(marketSharePipeline).toArray()
        ]);

        // ========== CALCUL DES STATISTIQUES GLOBALES ==========
        const globalStats = {
            totalBrands: brandStats.length,
            totalStockAllBrands: brandStats.reduce((sum, brand) => sum + brand.totalStock, 0),
            totalValueAllBrands: brandStats.reduce((sum, brand) => sum + brand.totalValue, 0),
            topBrandByValue: brandStats[0] || null,
            topBrandByStock: [...brandStats].sort((a, b) => b.totalStock - a.totalStock)[0] || null,
            averageProductsPerBrand: brandStats.length > 0 
                ? (brandStats.reduce((sum, brand) => sum + brand.productCount, 0) / brandStats.length).toFixed(2)
                : 0
        };

        // ========== ANALYSE DE PERFORMANCE ==========
        const performanceAnalysis = brandStats.map(brand => ({
            brand: brand.brand,
            productCount: brand.productCount,
            totalValue: brand.totalValue,
            efficiency: brand.totalStock > 0 
                ? (brand.totalValue / brand.totalStock).toFixed(2)  // Valeur par unité de stock
                : 0,
            inventoryTurnover: brand.averageStockPerProduct > 0 
                ? (brand.totalValue / (brand.averageStockPerProduct * brand.productCount)).toFixed(2)
                : 0
        })).sort((a, b) => b.efficiency - a.efficiency);

        // ========== PRÉPARATION DE LA RÉPONSE ==========
        const response = {
            success: true,
            message: `Analyse de ${brandStats.length} marques effectuée avec succès`,
            
            exercise: '6.3 - Décomposition par Marque et Prix Total',
            description: 'Analyse des marques avec calcul du stock total et de la valeur totale du stock',
            
            pipelineExplanation: {
                basicPipeline: [
                    {
                        stage: 1,
                        operator: '$match',
                        description: 'Filtrer les produits avec marque, stock et prix définis'
                    },
                    {
                        stage: 2,
                        operator: '$group',
                        description: 'Regrouper par marque et calculer les accumulateurs',
                        accumulators: [
                            'totalStock: { $sum: "$stock" }',
                            'totalValue: { $sum: { $multiply: ["$price", "$stock"] } }',
                            'productCount: { $sum: 1 }',
                            'averagePrice: { $avg: "$price" }'
                        ]
                    },
                    {
                        stage: 3,
                        operator: '$sort',
                        description: 'Trier par valeur totale décroissante'
                    },
                    {
                        stage: 4,
                        operator: '$project',
                        description: 'Formater et renommer les champs'
                    }
                ],
                advancedPipeline: [
                    {
                        stage: 1,
                        operator: '$match',
                        description: 'Filtrer les produits avec tags'
                    },
                    {
                        stage: 2,
                        operator: '$unwind',
                        description: 'Décomposer le tableau tags (démonstration)'
                    },
                    {
                        stage: 3,
                        operator: '$group',
                        description: 'Regrouper par marque et tag'
                    }
                ]
            },
            
            data: {
                // Résultats de l'exercice 6.3
                brandAnalysis: brandStats,
                
                // Statistiques globales
                globalStatistics: globalStats,
                
                // Analyse avancée (avec $unwind)
                tagDistribution: tagAnalysis.length > 0 ? {
                    description: 'Analyse par marque et tag (avec $unwind)',
                    data: tagAnalysis,
                    totalTagsAnalyzed: new Set(tagAnalysis.map(item => item.tag)).size
                } : null,
                
                // Market share
                marketShare: marketShare.length > 0 ? {
                    topBrands: marketShare,
                    marketLeader: marketShare[0] || null
                } : null,
                
                // Performance analysis
                performance: {
                    mostEfficientBrands: performanceAnalysis.slice(0, 5),
                    leastEfficientBrands: performanceAnalysis.slice(-5).reverse()
                }
            },
            
            insights: brandStats.length > 0 ? {
                totalInventoryValue: globalStats.totalValueAllBrands.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR'
                }),
                averageBrandValue: (globalStats.totalValueAllBrands / globalStats.totalBrands).toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR'
                }),
                brandConcentration: `${marketShare.length > 0 ? marketShare[0].marketShare : 0}% du marché détenu par la marque leader`,
                inventoryEfficiency: `Valeur moyenne par unité de stock: ${(globalStats.totalValueAllBrands / globalStats.totalStockAllBrands).toFixed(2)}€`
            } : null,
            
            metadata: {
                timestamp: new Date().toISOString(),
                collection: 'products',
                totalProductsAnalyzed: brandStats.reduce((sum, brand) => sum + brand.productCount, 0),
                executionTime: Date.now()
            },
            
            // Pour MongoDB Compass
            mongoDBCompassQuery: {
                basic: JSON.stringify(basicPipeline, null, 2),
                advanced: JSON.stringify(advancedPipeline, null, 2)
            }
        };

        console.log(`✅ ${brandStats.length} marques analysées`);
        console.log(`💰 Valeur totale du stock: ${globalStats.totalValueAllBrands.toFixed(2)}€`);
        console.log(`🏆 Marque leader: ${globalStats.topBrandByValue?.brand || 'Aucune'}`);

        res.json(response);

    } catch (error) {
        console.error('❌ Erreur dans getBrandAnalysis:', error);
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'analyse des marques',
            error: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                operation: 'aggregation',
                stack: error.stack
            } : undefined,
            exercise: '6.3',
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 🎯 VERSION SPÉCIFIQUE POUR L'EXERCICE 6.3 EXACT
 * GET /api/products/stats/brands/simple
 */
async function getBrandSimpleAnalysis(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        console.log('🎯 Exercice 6.3 exact - Analyse simple par marque');

        // Pipeline exact de l'exercice 6.3
        const pipeline = [
            // Filtrer les produits avec marque
            {
                $match: {
                    brand: { $exists: true, $ne: "" }
                }
            },
            
            // Regrouper par marque
            {
                $group: {
                    _id: "$brand",
                    
                    // Accumulateur 1: Stock total
                    totalStock: { 
                        $sum: "$stock" 
                    },
                    
                    // Accumulateur 2: Valeur totale (price * stock)
                    totalValue: { 
                        $sum: { 
                            $multiply: ["$price", "$stock"] 
                        } 
                    }
                }
            },
            
            // Trier par valeur totale
            {
                $sort: { 
                    totalValue: -1 
                }
            },
            
            // Formater la réponse
            {
                $project: {
                    _id: 0,
                    brand: "$_id",
                    totalStock: 1,
                    totalValue: { 
                        $round: ["$totalValue", 2] 
                    }
                }
            }
        ];

        const results = await productsCollection.aggregate(pipeline).toArray();

        // Calculer les totaux
        const totals = results.reduce((acc, brand) => ({
            totalStock: acc.totalStock + brand.totalStock,
            totalValue: acc.totalValue + brand.totalValue
        }), { totalStock: 0, totalValue: 0 });

        res.json({
            success: true,
            exercise: '6.3 - Décomposition par Marque et Prix Total',
            description: 'Pour chaque marque: stock total et valeur totale du stock (price * stock)',
            
            pipeline: [
                '$group: Regrouper par brand',
                '  - totalStock: { $sum: "$stock" }',
                '  - totalValue: { $sum: { $multiply: ["$price", "$stock"] } }',
                '$sort: Trier par totalValue décroissant',
                '$project: Formater la réponse'
            ],
            
            data: {
                brands: results,
                summary: {
                    totalBrands: results.length,
                    totalStockAllBrands: totals.totalStock,
                    totalValueAllBrands: parseFloat(totals.totalValue.toFixed(2)),
                    averageStockPerBrand: parseFloat((totals.totalStock / results.length).toFixed(2)),
                    averageValuePerBrand: parseFloat((totals.totalValue / results.length).toFixed(2))
                }
            },
            
            // Exemple pour MongoDB Compass
            mongoDBCompassExample: {
                stages: [
                    {
                        stage: 'Match',
                        query: '{ brand: { $exists: true, $ne: "" } }'
                    },
                    {
                        stage: 'Group',
                        query: JSON.stringify({
                            _id: "$brand",
                            totalStock: { $sum: "$stock" },
                            totalValue: { $sum: { $multiply: ["$price", "$stock"] } }
                        }, null, 2)
                    }
                ]
            }
        });

    } catch (error) {
        console.error('❌ Erreur dans getBrandSimpleAnalysis:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de l\'analyse simple des marques' 
        });
    }
}
// Exporter les fonctions
module.exports = {
    getProductStats,
    getCategoryStats,
    getBestRatedProducts,   
    getTopRatedProducts,     
    getBrandAnalysis,
    getBrandSimpleAnalysis,
    testAggregationPipeline
};