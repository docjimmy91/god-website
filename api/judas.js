// /api/judas.js - Improved Real-time Judas Tracker
export default async function handler(req, res) {
    const TOKEN_MINT = "23esBnMRpkf1taAv84MoLZrX6cw2Q2DYbVmpFjqAKqjk";
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

    if (!HELIUS_API_KEY) {
        return res.status(200).json({
            judas: [
                { rank: 1, wallet: "JUDAS...xK9p", totalSold: 124800, sells: 7, lastSell: "2h ago" },
                { rank: 2, wallet: "BETRAY...mN3q", totalSold: 87200, sells: 4, lastSell: "5h ago" },
            ],
            recentSells: [
                { wallet: "JUDAS...xK9p", usd: 31200, time: "14m ago" },
                { wallet: "BETRAY...mN3q", usd: 20500, time: "47m ago" },
            ],
            stats: {
                totalJudas: "47",
                totalSold: "128.4M",
                biggestSell: "$142K"
            },
            note: "Waiting for HELIUS_API_KEY"
        });
    }

    try {
        const url = `https://api.helius.xyz/v0/addresses/${TOKEN_MINT}/transactions?api-key=${HELIUS_API_KEY}&limit=40`;
        const response = await fetch(url);
        const transactions = await response.json();

        const walletMap = {};
        const recentSellsList = [];

        if (Array.isArray(transactions)) {
            transactions.forEach(tx => {
                // Look for sell activity
                const isSell = tx.type === 'SWAP' || 
                              tx.type === 'TOKEN_TRANSFER' || 
                              (tx.events && tx.events.swap);

                if (isSell && tx.feePayer) {
                    const wallet = tx.feePayer;
                    const shortWallet = wallet.slice(0, 6) + '...' + wallet.slice(-4);

                    // Try to get a reasonable amount
                    let amount = 0;
                    if (tx.events?.swap?.nativeInput?.amount) {
                        amount = parseFloat(tx.events.swap.nativeInput.amount);
                    } else if (tx.amount) {
                        amount = parseFloat(tx.amount);
                    }

                    if (amount > 25000) {
                        if (!walletMap[shortWallet]) {
                            walletMap[shortWallet] = { total: 0, count: 0 };
                        }
                        walletMap[shortWallet].total += amount;
                        walletMap[shortWallet].count += 1;

                        recentSellsList.push({
                            wallet: shortWallet,
                            usd: Math.round(amount * 0.000002),
                            time: new Date(tx.timestamp * 1000).toLocaleTimeString([], { 
                                hour: '2-digit', minute: '2-digit' 
                            })
                        });
                    }
                }
            });
        }

        // Create leaderboard
        const leaderboard = Object.entries(walletMap)
            .map(([wallet, data]) => ({
                rank: 0,
                wallet,
                totalSold: Math.round(data.total),
                sells: data.count,
                lastSell: "recent"
            }))
            .sort((a, b) => b.totalSold - a.totalSold)
            .slice(0, 8)
            .map((item, i) => ({ ...item, rank: i + 1 }));

        res.setHeader('Cache-Control', 's-maxage=15');
        res.status(200).json({
            judas: leaderboard.length > 0 ? leaderboard : [
                { rank: 1, wallet: "No large sells yet", totalSold: 0, sells: 0, lastSell: "-" }
            ],
            recentSells: recentSellsList.length > 0 ? recentSellsList.slice(0, 6) : [
                { wallet: "Monitoring...", usd: 0, time: "live" }
            ],
            stats: {
                totalJudas: leaderboard.length || "0",
                totalSold: leaderboard.length > 0 ? "Real data" : "Waiting for sells",
                biggestSell: "$--"
            }
        });

    } catch (error) {
        console.error("Helius error:", error);
        res.status(200).json({
            judas: [{ rank: 1, wallet: "Error fetching data", totalSold: 0, sells: 0, lastSell: "-" }],
            recentSells: [],
            stats: { totalJudas: "Error", totalSold: "Check logs", biggestSell: "-" }
        });
    }
}
