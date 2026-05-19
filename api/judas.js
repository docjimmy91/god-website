// /api/judas.js - Last 50 transactions + $25+ filter
export default async function handler(req, res) {
    const TOKEN_MINT = "23esBnMRpkf1taAv84MoLZrX6cw2Q2DYbVmpFjqAKqjk";
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

    if (!HELIUS_API_KEY) {
        return res.status(200).json({
            connected: false,
            judas: [],
            recentSells: [],
            stats: { totalJudas: "0", totalSold: "Key missing", biggestSell: "-" }
        });
    }

    try {
        // Changed to last 50 transactions
        const url = `https://api.helius.xyz/v0/addresses/${TOKEN_MINT}/transactions?api-key=${HELIUS_API_KEY}&limit=50`;
        const response = await fetch(url);
        const transactions = await response.json();

        const walletMap = {};
        const recentSellsList = [];

        if (Array.isArray(transactions)) {
            transactions.forEach(tx => {
                let amount = 0;

                // Try multiple ways to read the token amount
                if (tx.events?.swap?.tokenInput?.amount) {
                    amount = parseFloat(tx.events.swap.tokenInput.amount);
                } else if (tx.events?.swap?.tokenOutput?.amount) {
                    amount = parseFloat(tx.events.swap.tokenOutput.amount);
                } else if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
                    const transfer = tx.tokenTransfers.find(t => t.mint === TOKEN_MINT);
                    if (transfer) amount = parseFloat(transfer.amount);
                } else if (tx.amount) {
                    amount = parseFloat(tx.amount);
                }

                // Changed filter to ~$25+ sells
                if (amount > 500) {
                    const wallet = tx.feePayer || tx.fromUserAccount || "Unknown";
                    const shortWallet = wallet.slice(0, 6) + "..." + wallet.slice(-4);

                    if (!walletMap[shortWallet]) {
                        walletMap[shortWallet] = { total: 0, count: 0 };
                    }
                    walletMap[shortWallet].total += amount;
                    walletMap[shortWallet].count += 1;

                    recentSellsList.push({
                        wallet: shortWallet,
                        usd: Math.round(amount * 0.0000015),
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
                { rank: 1, wallet: "No sells above $25 yet", totalSold: 0, sells: 0, lastSell: "-" }
            ],
            recentSells: recentSellsList.length > 0 ? recentSellsList.slice(0, 6) : [],
            stats: {
                totalJudas: leaderboard.length || "0",
                totalSold: "Live data",
                biggestSell: leaderboard.length > 0 ? `$${(leaderboard[0].totalSold / 1000).toFixed(0)}K` : "$--"
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
