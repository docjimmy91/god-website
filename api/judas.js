// /api/judas.js - Diagnostic + Real Data Version
export default async function handler(req, res) {
    const TOKEN_MINT = "23esBnMRpkf1taAv84MoLZrX6cw2Q2DYbVmpFjqAKqjk";
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

    // Check if key exists
    if (!HELIUS_API_KEY) {
        return res.status(200).json({
            connected: false,
            message: "Helius API key NOT found",
            judas: [],
            recentSells: [],
            stats: { totalJudas: "0", totalSold: "Key missing", biggestSell: "-" }
        });
    }

    try {
        // Test connection to Helius
        const url = `https://api.helius.xyz/v0/addresses/${TOKEN_MINT}/transactions?api-key=${HELIUS_API_KEY}&limit=20`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Helius API error: ${response.status}`);
        }

        const transactions = await response.json();

        // Simple processing
        const walletMap = {};
        const recentSellsList = [];

        if (Array.isArray(transactions)) {
            transactions.forEach(tx => {
                const amount = tx.amount || (tx.events?.swap?.nativeInput?.amount) || 0;

                if (amount > 20000) {
                    const wallet = tx.feePayer || tx.fromUserAccount || "Unknown";
                    const shortWallet = wallet.slice(0, 6) + "..." + wallet.slice(-4);

                    if (!walletMap[shortWallet]) {
                        walletMap[shortWallet] = { total: 0, count: 0 };
                    }
                    walletMap[shortWallet].total += parseFloat(amount);
                    walletMap[shortWallet].count += 1;

                    recentSellsList.push({
                        wallet: shortWallet,
                        usd: Math.round(parseFloat(amount) * 0.000002),
                        time: new Date(tx.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

        return res.status(200).json({
            connected: true,
            message: "Helius connected successfully",
            judas: leaderboard.length > 0 ? leaderboard : [
                { rank: 1, wallet: "No large sells found yet", totalSold: 0, sells: 0, lastSell: "-" }
            ],
            recentSells: recentSellsList.length > 0 ? recentSellsList.slice(0, 6) : [
                { wallet: "Monitoring live...", usd: 0, time: "now" }
            ],
            stats: {
                totalJudas: leaderboard.length || "0",
                totalSold: "Live data",
                biggestSell: leaderboard.length > 0 ? `$${(leaderboard[0].totalSold / 1000).toFixed(0)}K` : "$--"
            }
        });

    } catch (error) {
        return res.status(200).json({
            connected: false,
            message: "Error: " + error.message,
            judas: [],
            recentSells: [],
            stats: { totalJudas: "Error", totalSold: "Check Vercel logs", biggestSell: "-" }
        });
    }
}
