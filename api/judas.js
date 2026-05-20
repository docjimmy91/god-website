// /api/judas.js - With protection against fake large sells + fullWallet for Solscan
export default async function handler(req, res) {
    const BONDING_CURVE = "AQbSZAUH5CWXiUoByWPAu7sCqyVGzrD39isKZTwHywzG";
    const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

    if (!HELIUS_API_KEY) {
        return res.status(200).json({ connected: false, judas: [], recentSells: [] });
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

                // Only accept reasonable single sells (max 30 SOL per transaction)
                if (solReceived > 0.15 && solReceived < 30) {
                    const wallet = tx.feePayer || tx.fromUserAccount || "Unknown";
                    const shortWallet = wallet.slice(0, 6) + "..." + wallet.slice(-4);

                    if (!walletMap[shortWallet]) {
                        walletMap[shortWallet] = { 
                            total: 0, 
                            count: 0, 
                            fullWallet: wallet   // Store full address for Solscan
                        };
                    }
                    walletMap[shortWallet].total += solReceived;
                    walletMap[shortWallet].count += 1;

                    recentSellsList.push({
                        wallet: shortWallet,
                        fullWallet: wallet,           // Full address for Solscan link
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
            wallet: shortWallet,           // Short version for display
            fullWallet: data.fullWallet,   // Full address for Solscan
            totalSold: data.total.toFixed(2) + " SOL",
            sells: data.count,
            lastSell: "recent"
        }));

        // Judas #1 = Biggest legitimate seller
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
