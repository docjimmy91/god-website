// /api/judas.js - Track sells by SOL received (recommended for pump.fun)
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

                // Look for SOL being sent to the seller (most reliable for pump.fun sells)
                if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
                    tx.nativeTransfers.forEach(transfer => {
                        // SOL received by the seller
                        if (transfer.toUserAccount && transfer.amount) {
                            solReceived += parseFloat(transfer.amount) / 1e9; // Convert lamports to SOL
                        }
                    });
                }

                // Also check nativeTransfers in a different structure
                if (tx.nativeTransfers) {
                    tx.nativeTransfers.forEach(transfer => {
                        if (transfer.amount) {
                            solReceived = Math.max(solReceived, parseFloat(transfer.amount) / 1e9);
                        }
                    });
                }

                // Filter: Sells where seller received more than 0.15 SOL (~$25–$40 depending on price)
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
                        usd: Math.round(solReceived * 160), // Rough conversion (adjust if needed)
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
                totalSold: data.total.toFixed(2) + " SOL",
                sells: data.count,
                lastSell: "recent"
            }))
            .sort((a, b) => parseFloat(b.totalSold) - parseFloat(a.totalSold))
            .slice(0, 8);

        res.status(200).json({
            connected: true,
            judas: leaderboard.length > 0 ? leaderboard : [
                { rank: 1, wallet: "No sells above ~0.15 SOL yet", totalSold: "0 SOL", sells: 0, lastSell: "-" }
            ],
            recentSells: recentSellsList.length > 0 ? recentSellsList.slice(0, 6) : [],
            stats: {
                totalJudas: leaderboard.length || "0",
                totalSold: "Live data",
                biggestSell: leaderboard.length > 0 ? `${parseFloat(leaderboard[0].totalSold).toFixed(2)} SOL` : "$--"
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
