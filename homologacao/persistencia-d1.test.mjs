import assert from "node:assert/strict";
import {reservar,transicionar} from "./persistencia-d1.mjs";
const registros=new Map();
const db={prepare(sql){return {bind(...args){return {
 async run(){
  if(sql.startsWith("INSERT")){
   const [key,fingerprint,unit,local,location]=args;
   if(!registros.has(key))registros.set(key,{idempotency_key:key,fingerprint,unit_code:unit,local_code:local,location_id:location,state:"RESERVADA",ticket_id:null});
   return {meta:{changes:registros.has(key)?1:0}};
  }
  if(sql.startsWith("UPDATE")){
   const [state,ticket,actor,key,expected]=args,r=registros.get(key);
   if(!r||r.state!==expected)return {meta:{changes:0}};
   r.state=state;r.ticket_id=ticket??r.ticket_id;r.actor=actor??r.actor;
   return {meta:{changes:1}};
  }
  throw Error("SQL não simulado");
 },
 async first(){if(!sql.startsWith("SELECT"))throw Error("SQL não simulado");return registros.get(args[0])??null}
}}}}};
const pedido={idempotency_key:"00000000-0000-4000-8000-000000000001",fingerprint:"a".repeat(64),unit_code:"CLI-MCE",local_code:"B.09",location_id:"CLI-MCE:B.09",servicos:["Papel toalha"]};
assert.equal((await reservar(db,pedido)).status,"RESERVADA");
assert.equal(registros.size,1);
assert.equal((await reservar(db,pedido)).status,"RESERVADA");
assert.equal(registros.size,1);
assert.equal((await reservar(db,{...pedido,fingerprint:"b".repeat(64)})).http,409);
assert.equal((await reservar(db,{...pedido,location_id:"ADM-MCE:B.09"})).http,409);
assert.equal(await transicionar(db,pedido.idempotency_key,"RESERVADA","ENVIO_INICIADO"),true);
assert.equal(await transicionar(db,pedido.idempotency_key,"RESERVADA","ENVIO_INICIADO"),false);
assert.equal(await transicionar(db,pedido.idempotency_key,"ENVIO_INICIADO","ENVIO_INCERTO"),true);
assert.equal(await transicionar(db,pedido.idempotency_key,"ENVIO_INCERTO","ABERTA",{ticketId:"TEST-1"}),true);
assert.equal((await reservar(db,pedido)).ticket_id,"TEST-1");
assert.equal(await transicionar(db,pedido.idempotency_key,"ABERTA","CONCLUSAO_INICIADA"),true);
assert.equal(await transicionar(db,pedido.idempotency_key,"CONCLUSAO_INICIADA","CONCLUIDA",{actor:"operadora@cliged.invalid"}),true);
await assert.rejects(()=>transicionar(db,pedido.idempotency_key,"CONCLUIDA","RESERVADA"));
assert.equal(registros.get(pedido.idempotency_key).state,"CONCLUIDA");
console.log("OK: reserva idempotente, conflitos, CAS e transições");
