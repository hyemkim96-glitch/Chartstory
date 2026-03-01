// Vercel Serverless Function — NewsAPI proxy
// API key stays server-side; browser never sees NEWSAPI_KEY

const NEWSAPI_KEY = process.env.NEWSAPI_KEY ?? "";
const NEWSAPI_BASE = "https://newsapi.org/v2";

export default async function handler(req: any, res: any) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    if (!NEWSAPI_KEY) {
        return res.status(500).json({ error: "NEWSAPI_KEY가 설정되지 않았습니다." });
    }

    try {
        const url = new URL(req.url, "http://localhost");
        const symbol = url.searchParams.get("symbol") ?? "";
        const date = url.searchParams.get("date") ?? "";
        const name = url.searchParams.get("name") ?? "";
        const region = url.searchParams.get("region") ?? "US";

        if (!symbol || !date) {
            return res.status(400).json({ error: "symbol, date 파라미터가 필요합니다." });
        }

        // Broaden search query: (symbol OR name)
        // For KR stocks, Name is often better for news search
        const query = name ? `${symbol} OR "${name}"` : symbol;

        // Language support: Korean for KR, otherwise English
        const language = region === "KR" ? "ko" : "en";

        // Date range: from (date - 1) to (date) to catch related news
        const d = new Date(date);
        const prev = new Date(d);
        prev.setDate(prev.getDate() - 1);
        const fromDate = prev.toISOString().split("T")[0];

        // Check if date is older than 30 days
        const diffDays = (new Date().getTime() - d.getTime()) / (1000 * 3600 * 24);

        if (diffDays > 28) {
            console.log(`[api/news] Date ${date} is old (${Math.floor(diffDays)} days ago). Using Google News RSS fallback.`);

            // Google News RSS fallback
            const googleQuery = name ? `${name} ${symbol}` : symbol;
            const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(googleQuery)}+after:${fromDate}+before:${date}&hl=${language === "ko" ? "ko" : "en"}&gl=${region === "KR" ? "KR" : "US"}&ceid=${region === "KR" ? "KR:ko" : "US:en"}`;

            console.log(`[api/news] RSS URL: ${googleUrl}`);
            const rssRes = await fetch(googleUrl);
            const rssText = await rssRes.text();

            // Simple regex extraction for RSS items (title, link, pubDate, source)
            const items: any[] = [];
            const itemMatches = rssText.matchAll(/<item>([\s\S]*?)<\/item>/g);

            for (const match of itemMatches) {
                const content = match[1];
                // More robust regex for title, link, source
                const title = content.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
                const link = content.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "";
                const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
                const source = content.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "";

                // Clean up XML entities or CDATA if present
                const clean = (str: string) => str.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();

                if (title && link) {
                    items.push({
                        title: clean(title).replace(/ - .*$/, ""),
                        url: clean(link),
                        publishedAt: new Date(pubDate).toISOString(),
                        source: { name: clean(source) }
                    });
                }
                if (items.length >= 10) break;
            }

            return res.status(200).json({ articles: items });
        }

        const apiUrl = `${NEWSAPI_BASE}/everything?q=${encodeURIComponent(query)}&from=${fromDate}&to=${date}&sortBy=relevancy&language=${language}&pageSize=10&apiKey=${NEWSAPI_KEY}`;

        console.log(`[api/news] Proxying to: ${apiUrl}`);

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.message ?? "NewsAPI 오류" });
        }

        return res.status(200).json(data);
    } catch (err) {
        console.error("NewsAPI/RSS proxy 오류:", err);
        return res.status(500).json({ error: String(err) });
    }
}
