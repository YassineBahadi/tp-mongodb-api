
const { getDB } = require('../config/database');


async function getProductStats(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        console.log('📊 Démarrage des calculs de statistiques avancées...');

        const categoryStatsPipeline = [
            {
                $match: {
                    category: { $exists: true, $ne: "" }
                }
            },
            
            {
                $group: {
                    _id: "$category", 
                    
                
                    totalProducts: { $sum: 1 }, 
                    totalStock: { $sum: "$stock" }, 
                    totalValue: { 
                        $sum: { 
                            $multiply: ["$price", "$stock"] 
                        } 
                    },
                    
                  
                    averagePrice: { $avg: "$price" }, 
                    maxPrice: { $max: "$price" }, 
                    minPrice: { $min: "$price" }, 
                    
                  
                    averageRating: { $avg: "$rating" },
                    maxRating: { $max: "$rating" },
                    minRating: { $min: "$rating" },
                    
                    totalDiscountProducts: {
                        $sum: { 
                            $cond: [{ $gt: ["$discountPercentage", 0] }, 1, 0]
                        }
                    },
                    averageDiscount: { $avg: "$discountPercentage" }
                }
            },
            
            {
                $addFields: {
                    priceRange: { 
                        $subtract: ["$maxPrice", "$minPrice"] 
                    },
                    
                    discountRate: {
                        $multiply: [
                            { $divide: ["$totalDiscountProducts", "$totalProducts"] },
                            100
                        ]
                    },
                    
                    averageValuePerProduct: {
                        $divide: ["$totalValue", "$totalProducts"]
                    }
                }
            },
            
            {
                $sort: { 
                    averagePrice: -1 
                }
            },
            
            {
                $project: {
                    _id: 0, 
                    
                    categoryName: "$_id", 
                    
                    totalProducts: 1,
                    totalStock: 1,
                    totalValue: { $round: ["$totalValue", 2] },
                    
                    averagePrice: { $round: ["$averagePrice", 2] },
                    maxPrice: { $round: ["$maxPrice", 2] },
                    minPrice: { $round: ["$minPrice", 2] },
                    priceRange: { $round: ["$priceRange", 2] },
                    
                    averageRating: { $round: ["$averageRating", 1] },
                    maxRating: { $round: ["$maxRating", 1] },
                    minRating: { $round: ["$minRating", 1] },
                    
                    totalDiscountProducts: 1,
                    discountRate: { $round: ["$discountRate", 2] },
                    averageDiscount: { $round: ["$averageDiscount", 2] },
                    
                    averageValuePerProduct: { $round: ["$averageValuePerProduct", 2] },
                    
                    performanceScore: {
                        $multiply: [
                            { $divide: ["$averageRating", 5] }, 
                            { $log10: { $add: ["$totalProducts", 1] } } 
                        ]
                    }
                }
            },
            
            {
                $limit: 50
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


        const priceDistributionPipeline = [
            {
                $bucket: {
                    groupBy: "$price",
                    boundaries: [0, 100, 500, 1000, 2000, 5000, 10000], 
                    default: "10000+", 
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
                    percentage: { $multiply: [{ $divide: ["$count", { $literal: 1 }] }, 100] },
                    averageRating: { $round: ["$averageRating", 2] },
                    totalStock: 1,
                    categoryCount: { $size: "$categories" }
                }
            },
            { $sort: { _id: 1 } }
        ];

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
                    marketShare: { $sum: 1 } 
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

const bestRatedPipeline = [
    {
        $match: {
            price: { $gt: 500 },
            rating: { $exists: true, $ne: null }
        }
    },
    
    {
        $sort: { rating: -1 }
    },
    
    {
        $limit: 5
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

        const totalProducts = overallStats[0]?.totalProducts || 1;
        
        priceDistribution.forEach(item => {
            item.percentage = ((item.count / totalProducts) * 100).toFixed(2);
        });

        topBrands.forEach(brand => {
            brand.marketShare = ((brand.productCount / totalProducts) * 100).toFixed(2);
        });

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

                topBrands: {
                    description: "🏭 Top 10 des marques par nombre de produits",
                    brands: topBrands,
                    marketLeader: topBrands[0] || null
                },

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

                priceTrends: {
                    description: "📈 Segmentation des prix par catégorie",
                    trends: priceTrends
                },

                overall: overallStats[0] || {
                    totalProducts: 0,
                    totalCategories: 0,
                    totalBrands: 0,
                    avgPrice: 0,
                    avgRating: 0,
                    totalStockValue: 0
                },

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


async function getCategoryStats(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        const pipeline = [
            {
                $match: {
                    category: { $exists: true, $ne: "" }
                }
            },
            
            {
                $group: {
                    _id: "$category",
                    
                    totalProducts: { $sum: 1 },           
                    averagePrice: { $avg: "$price" },     
                    maxPrice: { $max: "$price" },         
                    minPrice: { $min: "$price" },         
                    
                    totalStock: { $sum: "$stock" }
                }
            },
            
            {
                $sort: { 
                    averagePrice: -1 
                }
            },
            
            {
                $project: {
                    _id: 0,
                    categoryName: "$_id",                 
                    totalProducts: 1,
                    averagePrice: { $round: ["$averagePrice", 2] },  
                    maxPrice: { $round: ["$maxPrice", 2] },
                    minPrice: { $round: ["$minPrice", 2] },
                    totalStock: 1,
                    
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


async function testAggregationPipeline(req, res) {
    try {
        const { pipeline } = req.query;
        const db = getDB();
        const productsCollection = db.collection('products');

        let selectedPipeline = [];
        let description = '';

        switch (pipeline) {
            case 'category':
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

        const minPrice = parseFloat(req.query.minPrice) || 500;
        const limit = parseInt(req.query.limit) || 5;
        const sortOrder = req.query.order === 'asc' ? 1 : -1; // desc par défaut

        console.log(`🔍 Recherche des meilleurs produits: prix > ${minPrice}€, limit: ${limit}`);

        const pipeline = [
            {
                $match: {
                    price: { $gt: minPrice },           
                    rating: { $exists: true, $ne: null } 
                }
            },
            
            {
                $sort: { 
                    rating: sortOrder                   
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
                    brand: 1,
                    stock: 1,
                    thumbnail: 1,
                    
                    valueScore: {
                        $round: [
                            { $divide: ["$rating", "$price"] },
                            4
                        ]
                    }
                }
            }
        ];

        const bestProducts = await productsCollection.aggregate(pipeline).toArray();

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
                        rating: 1  
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

        console.log(` ${bestProducts.length} meilleurs produits trouvés (prix > ${minPrice}€)`);
        
        if (bestProducts.length > 0) {
            console.log(`🏆 Meilleur produit: ${bestProducts[0].title} (${bestProducts[0].rating}⭐)`);
        }

        res.json(response);

    } catch (error) {
        console.error(' Erreur dans getBestRatedProducts:', error);
        
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

async function getTopRatedProducts(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

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



async function getBrandAnalysis(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        console.log('🏭 Analyse des marques - Exercice 6.3');

        const basicPipeline = [
            {
                $match: {
                    brand: { $exists: true, $ne: "" },
                    stock: { $exists: true },
                    price: { $exists: true }
                }
            },
            
            {
                $group: {
                    _id: "$brand",  
                    
                    totalStock: { $sum: "$stock" },
                    
                    totalValue: { 
                        $sum: { 
                            $multiply: ["$price", "$stock"] 
                        } 
                    },
                    
                    productCount: { $sum: 1 },               
                    averagePrice: { $avg: "$price" },        
                    averageRating: { $avg: "$rating" },      
                    maxPrice: { $max: "$price" },           
                    minPrice: { $min: "$price" }            
                }
            },
            
            {
                $sort: { totalValue: -1 }
            },
            
            {
                $project: {
                    _id: 0,
                    brand: "$_id",                         
                    
                    totalStock: 1,
                    totalValue: { $round: ["$totalValue", 2] },
                    productCount: 1,
                    
                    averagePrice: { $round: ["$averagePrice", 2] },
                    averageRating: { $round: ["$averageRating", 2] },
                    priceRange: {
                        min: { $round: ["$minPrice", 2] },
                        max: { $round: ["$maxPrice", 2] }
                    },
                    
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

        const advancedPipeline = [
            {
                $match: {
                    tags: { $exists: true, $ne: [] },
                    brand: { $exists: true, $ne: "" }
                }
            },
            
            {
                $unwind: "$tags"
            },
            
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
            
            {
                $sort: { "_id.brand": 1, totalValue: -1 }
            },
            
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

        console.log(' Exécution des pipelines d\'analyse par marque...');
        
        const [brandStats, tagAnalysis, marketShare] = await Promise.all([
            productsCollection.aggregate(basicPipeline).toArray(),
            productsCollection.aggregate(advancedPipeline).toArray(),
            productsCollection.aggregate(marketSharePipeline).toArray()
        ]);

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

        const performanceAnalysis = brandStats.map(brand => ({
            brand: brand.brand,
            productCount: brand.productCount,
            totalValue: brand.totalValue,
            efficiency: brand.totalStock > 0 
                ? (brand.totalValue / brand.totalStock).toFixed(2)  
                : 0,
            inventoryTurnover: brand.averageStockPerProduct > 0 
                ? (brand.totalValue / (brand.averageStockPerProduct * brand.productCount)).toFixed(2)
                : 0
        })).sort((a, b) => b.efficiency - a.efficiency);

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
                brandAnalysis: brandStats,
                
                globalStatistics: globalStats,
                
                tagDistribution: tagAnalysis.length > 0 ? {
                    description: 'Analyse par marque et tag (avec $unwind)',
                    data: tagAnalysis,
                    totalTagsAnalyzed: new Set(tagAnalysis.map(item => item.tag)).size
                } : null,
                
                marketShare: marketShare.length > 0 ? {
                    topBrands: marketShare,
                    marketLeader: marketShare[0] || null
                } : null,
                
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
            
            mongoDBCompassQuery: {
                basic: JSON.stringify(basicPipeline, null, 2),
                advanced: JSON.stringify(advancedPipeline, null, 2)
            }
        };

        console.log(` ${brandStats.length} marques analysées`);
        console.log(` Valeur totale du stock: ${globalStats.totalValueAllBrands.toFixed(2)}€`);
        console.log(` Marque leader: ${globalStats.topBrandByValue?.brand || 'Aucune'}`);

        res.json(response);

    } catch (error) {
        console.error(' Erreur dans getBrandAnalysis:', error);
        
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


async function getBrandSimpleAnalysis(req, res) {
    try {
        const db = getDB();
        const productsCollection = db.collection('products');

        console.log(' Exercice 6.3 exact - Analyse simple par marque');

        const pipeline = [
            {
                $match: {
                    brand: { $exists: true, $ne: "" }
                }
            },
            
            {
                $group: {
                    _id: "$brand",
                    
                    totalStock: { 
                        $sum: "$stock" 
                    },
                    
                    totalValue: { 
                        $sum: { 
                            $multiply: ["$price", "$stock"] 
                        } 
                    }
                }
            },
            
            {
                $sort: { 
                    totalValue: -1 
                }
            },
            
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
        console.error(' Erreur dans getBrandSimpleAnalysis:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de l\'analyse simple des marques' 
        });
    }
}

module.exports = {
    getProductStats,
    getCategoryStats,
    getBestRatedProducts,   
    getTopRatedProducts,     
    getBrandAnalysis,
    getBrandSimpleAnalysis,
    testAggregationPipeline
};