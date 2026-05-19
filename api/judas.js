// /api/judas.js - Clean version with correct ranking
export default async function handler(req, res) {
    const BONDING_CURVE = "AQbSZAUH5CWXiUoByWPAu7sCqyVGzrD39isKZTwHywzG";
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
        const url = `https://api.helius.xyz/v0/addresses/${BONDING_CURVE}/transactions?api-key=${HELIUS_API_KEY}&limit=50`;
        const response = await fetch(url);
        const transactions = await response.json();

        const walletMap = {};
        const recentSellsList = [];

        if (Array.isArray(transactions)) {
            transactions.forEach(tx => {
                let solReceived = 0;

                if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
                    tx.nativeTransfers.forEach(transfer => {
                        if (transfer.amount) {
                            solReceived += parseFloat(transfer.amount) / 1e9;
                        }
                    });
                }

                // Filter: Sells where seller received more than 0.15 SOL
                if (solReceived > 0.15) {
                    const wallet = tx.feePayer || tx.fromUserAccount || "Unknown";
                    const shortWallet = wallet.slice(0, 6) + "..." + wallet.slice(-4);

                    if (!walletMap[shortWallet]) {
                        walletMap[shortWallet] = { total: 0, count: 0 };
                    }
                    walletMap[shortWallet].total += solReceived;
                    walletMap[shortWallet].count += 1;

                    recentSellsList.push({
                        wallet: shortWallet,
                        usd: Math.round(solReceived * 160),
                        time: new Date(tx.timestamp * 1000).toLocaleTimeString([], { 
                            hour: '2-digit', minute: '2-digit' 
                        })
                    });
                }
            });
        }

        // Create properly ranked leaderboard
        const sortedWallets = Object.entries(walletMap)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 8);

        const leaderboard = sortedWallets.map(([wallet, data], index) => ({
            rank: index + 1,
            wallet,
            totalSold: data.total.toFixed(2) + " SOL",
            sells: data.count,
            lastSell: "recent"
        }));

        res.status(200).json({
            connected: true,
            judas: leaderboard.length > 0 ? leaderboard : [
                { rank: 1, wallet: "No sells above 0.15 SOL yet", totalSold: "0 SOL", sells: 0, lastSell: "-" }
            ],
            recentSells: recentSellsList.length > 0 ? recentSellsList.slice(0, 6) : [],
            stats: {
                totalJudas: leaderboard.length || "0",
                totalSold: "Live data",
                biggestSell: leaderboard.length > 0 ? `${parseFloat(leaderboard[0].totalSold)} SOL` : "$--"
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
