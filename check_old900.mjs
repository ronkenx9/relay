import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { execSync } from "child_process";
const pk = execSync("security find-generic-password -s RELAY_SHANNON_TESTNET_KEY -w", {encoding:"utf8"}).trim();
const key = pk.startsWith("0x")?pk:"0x"+pk;
const ex = new SomniaMarkets({indexerUrl:"https://dev.smk.somnia.host/v1/graphql", chain:somniaShannon, addresses:SOMNIA_TESTNET_ADDRESSES, privateKey:key});
const pool="0x2acc476b71be2b180db670927bce1fe22e490940";
const orderId="202914184810805090238";
try{
  const ord = await ex.client.getOrderOnchain(pool, orderId);
  console.log("order onchain", JSON.stringify({orderId:String(ord?.orderId||orderId), status: ord?.status, remaining: ord?String(ord.remaining):"n/a", price: ord?String(ord.price):"n/a"}, null, 2));
  console.log("full", JSON.stringify(ord, (k,v)=>typeof v==="bigint"?String(v):v).slice(0,1200));
}catch(e){ console.log("err", e.message.slice(0,300)); }
try{
  const canc = await ex.trader.cancelOrder({pool, orderId});
  console.log("cancel attempt", canc.hash);
}catch(e){ console.log("cancel err", e.errorName||e.message.slice(0,200)); }
