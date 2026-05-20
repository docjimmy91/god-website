// /api/judas.js - Improved SOL amount detection (only count what the seller actually received)
export default async function handler(req, res) {
    const BONDING_CURVE = "AQbSZAUH5CWXiUoByWPAu7sCqyVGzrD39isKZTwHywzG";
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
    if (!HELIUS_API_KEY) {
        return res.status(200).json({ connected: false, judas: [], recentSells: [] });
    }
    try {
        const url = https://api.helius.xyz/v0/addresses/${BONDING_CURVE}/transactions?api-key=${HELIUS_API_KEY}&limit=50;
        const response = await fetch(url);
        const transactions = await response.json();
        const walletMap = {};
        const recentSellsList = [];
        if (Array.isArray(transactions)) {
            transactions.forEach(tx => {
                let solReceived = 0;
                const seller = tx.feePayer; // The wallet that initiated the sell
                if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
                    tx.nativeTransfers.forEach(transfer => {
                        // Only count SOL that was actually sent TO the seller
                        if (transfer.toUserAccount === seller && transfer.amount) {
                            solReceived += parseFloat(transfer.amount) / 1e9;
                        }
                    });
                }
                // Filter: Only include reasonable sells (between 0.15 SOL and 30 SOL)
                if (solReceived > 0.15 && solReceived < 30) {
                    const shortWallet = seller.slice(0, 6) + "..." + seller.slice(-4);
                    if (!walletMap[shortWallet]) {
                        walletMap[shortWallet] = {
                            total: 0,
                            count: 0,
                            fullWallet: seller
                        };
                    }
                    walletMap[shortWallet].total += solReceived;
                    walletMap[shortWallet].count += 1;
                    recentSellsList.push({
                        wallet: shortWallet,
                        fullWallet: seller,
                        sol: solReceived,
                        time: new Date(tx.timestamp * 1000).toLocaleTimeString([], {
                            hour: '2-digit', minute: '2-digit'
                        })
                    });
                }
            });
        }
        // Sort and create leaderboard
        const sorted = Object.entries(walletMap).sort((a, b) => b[1].total - a[1].total);
        const leaderboard = sorted.slice(0, 8).map(([shortWallet, data], index) => ({
            rank: index + 1,
            wallet: shortWallet,
            fullWallet: data.fullWallet,
            totalSold: data.total.toFixed(2) + " SOL",
            sells: data.count,
            lastSell: "recent"
        }));
        const judasOne = sorted.length > 0 ? {
            wallet: sorted[0][0],
            fullWallet: sorted[0][1].fullWallet,
            totalSold: sorted[0][1].total.toFixed(2) + " SOL",
            sells: sorted[0][1].count
        } : null;
        res.status(200).json({
            connected: true,
            judas: leaderboard,
            recentSells: recentSellsList.slice(0, 8),
            judasOne: judasOne,
            stats: {
                totalJudas: leaderboard.length,
                totalSold: "Live data",
                biggestSell: judasOne ? judasOne.totalSold : "$--"
            }
        });
    } catch (error) {
        res.status(200).json({ connected: false, judas: [], recentSells: [] });
    }
}
