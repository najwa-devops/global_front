// Use built-in fetch

async function test() {
    try {
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:8089';
        const url = `${baseUrl.replace(/\/$/, '')}/api/dynamic-invoices?limit=1`;
        console.log(`Fetching ${url}...`);
        const response = await fetch(url);
        console.log(`Status: ${response.status} ${response.statusText}`);
        if (response.ok) {
            const data = await response.json();
            console.log('Success!', JSON.stringify(data).substring(0, 100));
        } else {
            const text = await response.text();
            console.log('Error payload:', text);
        }
    } catch (err) {
        console.error('Fetch failed:', err.message);
    }
}

test();
