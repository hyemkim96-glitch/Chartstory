
async function testRSS() {
    const symbol = "AAPL";
    const name = "Apple Inc.";
    const fromDate = "2024-01-01";
    const date = "2024-01-05";
    const language = "en";
    const region = "US";

    const googleQuery = name ? `${name} ${symbol}` : symbol;
    const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(googleQuery)}+after:${fromDate}+before:${date}&hl=${language === "ko" ? "ko" : "en"}&gl=${region === "KR" ? "KR" : "US"}&ceid=${region === "KR" ? "KR:ko" : "US:en"}`;

    console.log(`Testing URL: ${googleUrl}`);

    try {
        const res = await fetch(googleUrl);
        const rssText = await res.text();
        console.log(`Response length: ${rssText.length}`);

        if (rssText.includes("<item>")) {
            console.log("Found <item> tags!");
        } else {
            console.log("No <item> tags found in response.");
            console.log("Response snippet:", rssText.slice(0, 500));
            return;
        }

        const items = [];
        const itemMatches = rssText.matchAll(/<item>([\s\S]*?)<\/item>/g);

        for (const match of itemMatches) {
            const content = match[1];
            const title = content.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
            const link = content.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "";
            const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
            const source = content.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "";

            items.push({
                title: title.replace(/ - .*$/, ""),
                url: link,
                publishedAt: new Date(pubDate).toISOString(),
                source: { name: source }
            });
            if (items.length >= 2) break;
        }

        console.log("Extracted items:", JSON.stringify(items, null, 2));
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

testRSS();
