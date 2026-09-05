import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { execSync } from "child_process";

const pk = execSync("security find-generic-password -s RELAY_SHANNON_TESTNET_KEY -w", {encoding:"utf8"}).trim();
const key = pk.startsWith("0x")?pk:"0x"+pk;
const ex = new SomniaMarkets({
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  chain: somniaShannon,
  addresses: SOMNIA_TESTNET_ADDRESSES,
  privateKey: key,
});
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
const nowSec = Math.floor(Date.now()/1000);
console.log("now", nowSec, new Date(nowSec*1000).toISOString());

// fetch BTC 900 op2 current
let res = await fetch("https://dev.smk.somnia.host/v1/graphql", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({query:`query Q($now:numeric!){ Market(where:{marketType:{_eq:"BINARY"},expiry:{_gt:$now}},order_by:{expiry:asc},limit:30){ id poolAddress asset intervalSec expiry tradingStart operatorId venueId clobStatus } }`, variables:{now:String(nowSec)}})});
let j = await res.json();
let cand = j.data.Market.filter(m=> m.asset==="BTC" && m.intervalSec==="900" && m.operatorId===2)[0];
if(!cand) throw new Error("no BTC 900 op2");
console.log("old", cand.id, "pool", cand.poolAddress, "expiry", cand.expiry, "in", parseInt(cand.expiry)-Math.floor(Date.now()/1000), "s");
let old=cand;
let expiry=parseInt(old.expiry);
let onchain = await ex.client.getMarketOnchain(old.id);
console.log("onchain status", onchain?.status, "pool", onchain?.pool);
if(onchain?.status!==1) throw new Error("old not Trading");

const pool=old.poolAddress;
const price=100_000n;
const qty=1_000_000n;
console.log("placing BUY_YES 0.10 x1 on", pool);
let placeRes = await ex.trader.placeOrder({pool, side:"BUY_YES", price, quantity: qty});
console.log("placed", placeRes.hash, "orderId", String(placeRes.orderId));
console.log("explorer https://shannon-explorer.somnia.network/tx/"+placeRes.hash);

let sleepMs = (expiry - Math.floor(Date.now()/1000) + 5)*1000;
console.log("sleeping", Math.round(sleepMs/1000), "s to after expiry", new Date((Math.floor(Date.now()/1000)+Math.round(sleepMs/1000))*1000).toISOString());
await sleep(sleepMs);

console.log("discovering successor", old.operatorId, old.venueId.slice(0,10));
let successor=null;
let start=Date.now();
let delay=400;
while(Date.now()-start<45000){
  let r2 = await fetch("https://dev.smk.somnia.host/v1/graphql", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({query:`query Q($now:numeric!){ Market(where:{marketType:{_eq:"BINARY"},expiry:{_gt:$now}},order_by:{expiry:asc},limit:60){ id poolAddress asset intervalSec expiry operatorId venueId clobStatus } }`, variables:{now:String(Math.floor(Date.now()/1000))}})});
  let j2 = await r2.json();
  let cands = j2.data.Market.filter(m=> m.operatorId===old.operatorId && m.venueId===old.venueId && m.asset===old.asset && m.intervalSec===old.intervalSec);
  cands = cands.filter(m=> m.id.toLowerCase()!==old.id.toLowerCase() && parseInt(m.expiry) > parseInt(old.expiry));
  cands.sort((a,b)=> parseInt(a.expiry)-parseInt(b.expiry) || a.id.localeCompare(b.id));
  if(cands.length>0){
    let smallest=parseInt(cands[0].expiry);
    let same=cands.filter(c=> parseInt(c.expiry)===smallest).length;
    if(same===1){
      let cand2=cands[0];
      console.log("candidate", cand2.id, "exp", cand2.expiry, "pool", cand2.poolAddress);
      try{
        let oc = await ex.client.getMarketOnchain(cand2.id);
        console.log(" onchain", oc?.status, String(oc?.expiry), oc?.pool);
        if(oc?.status===1 && String(oc.expiry)===cand2.expiry && oc.pool.toLowerCase()===cand2.poolAddress.toLowerCase()){
          console.log("SUCCESSOR_VERIFIED", cand2.id);
          successor=cand2; break;
        } else console.log(" not verified yet");
      }catch(e){ console.log(" onchain err", e.message.slice(0,80)); }
    } else console.log("ambiguous", same);
  } else console.log("no candidate yet");
  await sleep(delay); delay=Math.min(2000, Math.floor(delay*1.4));
}
if(!successor) throw new Error("PAUSED_SUCCESSOR_NOT_PROVEN");
console.log("placing remainder on successor", successor.id, successor.poolAddress);
let res2 = await ex.trader.placeOrder({pool: successor.poolAddress, side:"BUY_YES", price, quantity: qty});
console.log("successor place", res2.hash, "orderId", String(res2.orderId));
console.log("explorer https://shannon-explorer.somnia.network/tx/"+res2.hash);
console.log("EVIDENCE", JSON.stringify({
  oldMarketId: old.id, oldPool: old.poolAddress, oldExpiry: old.expiry, oldTx: placeRes.hash, oldOrderId: String(placeRes.orderId),
  newMarketId: successor.id, newPool: successor.poolAddress, newExpiry: successor.expiry, newTx: res2.hash, newOrderId: String(res2.orderId),
  price: price.toString(), quantity: qty.toString(), seriesKey:{operatorId: old.operatorId, venueId: old.venueId, asset: old.asset, intervalSec: old.intervalSec}
}, null, 2));
try{ let c=await ex.trader.cancelOrder({pool: successor.poolAddress, orderId: res2.orderId}); console.log("cancel successor", c.hash);}catch(e){ console.log("cancel err", e.message.slice(0,80)); }
