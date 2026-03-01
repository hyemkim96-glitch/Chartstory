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

        if (!symbol || !date) {
            return res.status(400).json({ error: "symbol, date 파라미터가 필요합니다." });
        }

        const query = encodeURIComponent(symbol);
        const apiUrl = `${NEWSAPI_BASE}/everything?q=${query}&from=${date}&to=${date}&sortBy=relevancy&language=en&pageSize=5&apiKey=${NEWSAPI_KEY}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.message ?? "NewsAPI 오류" });
        }

        return res.status(200).json(data);
    } catch (err) {
        console.error("NewsAPI proxy 오류:", err);
        return res.status(500).json({ error: String(err) });
    }
}
