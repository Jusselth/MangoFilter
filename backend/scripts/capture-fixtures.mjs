// Captura respuestas REALES de VTEX para usarlas como fixtures de prueba (no como datos de la app).
import { writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const [store, base, query] = process.argv.slice(2);
const s = await (await fetch(`${base}/api/io/_v/api/intelligent-search/product_search/?query=${encodeURIComponent(query)}&count=4&locale=es-CO&hideUnavailableItems=true`, { headers: { 'user-agent': UA, accept: 'application/json' } })).json();
const products = s.products.slice(0, 4);
const items = products.map((p) => { const it = p.items[0]; const sel = it.sellers.find((x) => x.sellerDefault) ?? it.sellers[0]; return { id: it.itemId, quantity: 1, seller: sel.sellerId }; });
const sim = await (await fetch(`${base}/api/checkout/pub/orderForms/simulation?sc=1`, { method: 'POST', headers: { 'user-agent': UA, 'content-type': 'application/json' }, body: JSON.stringify({ items, country: 'COL', postalCode: '11001' }) })).json();
writeFileSync(`test/fixtures/${store}-search.json`, JSON.stringify({ products, recordsFiltered: s.recordsFiltered }, null, 1));
writeFileSync(`test/fixtures/${store}-simulation.json`, JSON.stringify({ items: sim.items, logisticsInfo: sim.logisticsInfo, messages: sim.messages }, null, 1));
console.log(store, products.length, 'products; sim items', sim.items?.length);
