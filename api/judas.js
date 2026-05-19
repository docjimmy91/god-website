// /api/judas.js - Pump.fun Bonding Curve Version ($50+ filter)
export default async function handler(req, res) {
    const BONDING_CURVE = "AQbSZAUH5CWXiUoByWPAu7sCqyVGzrD39isKZTwHywzG";
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

    if (!HELIUS_API_KEY) {
        return res.status(200).json({
            connected: false,
            judas: [],
            recentSells: [],
            stats: { totalJudas: "0", totalSold: "Helius key missing", biggestSell: "-" }
        });
    }

    try {
        // Query transactions on the bonding curve (more accurate for pump.fun)
        const url = `https://api.helius.xyz/v0/addresses/${BONDING_CURVE}/transactions?api-key=${HELIUS_API_KEY}&limit=50`;
        const response = await fetch(url);
        const transactions = await response.json();

        const walletMap = {};
        const recentSellsList = [];

        if (Array.isArray(transactions)) {
            transactions.forEach(tx => {
                let amount = 0;

                // Try to extract sell amount from pump.fun transactions
                if (tx.amount) {
                    amount = parseFloat(tx.amount);
                } else if (tx.events?.swap?.tokenInput?.amount) {
                    amount = parseFloat(tx.events.swap.tokenInput.amount);
                } else if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
                    // Look for token being sent out (sell)
                    const sellTransfer = tx.tokenTransfers.find(t => 
                        t.mint === "23esBnMRpkf1taAv84MoLZrX6cw2Q2DYbVmpFjqAKqjk" && 
                        t.fromUserAccount === BONDING_CURVE
                    );
                    if (sellTransfer) amount = parseFloat(sellTransfer.amount);
                }

                // Rough USD conversion (adjust if needed)
                const usdValue = amount * 0.000002;

                // Filter: Sells above $50
                if (usdValue > 50) {
                    const wallet = tx.feePayer || tx.fromUserAccount || "Unknown";
                    const shortWallet = wallet.slice(0, 6) + "..." + wallet.slice(-4);

                    if (!walletMap[shortWallet]) {
                        walletMap[shortWallet] = { total: 0, count: 0 };
                    }
                    walletMap[shortWallet].total += usdValue;
                    walletMap[shortWallet].count += 1;

                    recentSellsList.push({
                        wallet: shortWallet,
                        usd: Math.round(usdValue),
                        time: new Date(tx.timestamp * 1000).toLocaleTimeString([], { 
                            hour: '2-digit', minute: '2-digit' 
                        })
                    });
                }
            });
        }

        const leaderboard = Object.entries(walletMap)
            .map(([wallet, data], index) => ({
                rank: index + 1,
                wallet,
                totalSold: Math.round(data.total),
                sells: data.count,
                lastSell: "recent"
            }))
            .sort((a, b) => b.totalSold - a.totalSold)
            .slice(0, 8);

        res.status(200).json({
            connected: true,
            judas: leaderboard.length > 0 ? leaderboard : [
                { rank: 1, wallet: "No sells above $50 yet", totalSold: 0, sells: 0, lastSell: "-" }
            ],
            recentSells: recentSellsList.length > 0 ? recentSellsList.slice(0, 6) : [],
            stats: {
                totalJudas: leaderboard.length || "0",
                totalSold: "Live data",
                biggestSell: leaderboard.length > 0 ? `$${Math.round(leaderboard[0].totalSold)}` : "$--"
            }
        });

    } catch (error) {
        res.status(200).json({
            connected: false,
            judas: [],
            recentSells: [],
            stats: { totalJudas: "Error", totalSold: error.message, biggestSell: "-" }
        });
    }
}
