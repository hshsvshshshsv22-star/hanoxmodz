const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');
initializeApp();
const db = getFirestore();
const REGION = 'asia-southeast1';
function requireAuth(req) { if (!req.auth) throw new HttpsError('unauthenticated', 'Vui lòng đăng nhập.'); return req.auth.uid; }
async function requireAdmin(uid) { const snap = await db.doc(`admins/${uid}`).get(); if (!snap.exists || snap.data().role !== 'admin') throw new HttpsError('permission-denied', 'Tài khoản không có quyền admin.'); }
function makeKey(prefix) { const clean = String(prefix || 'HANOX').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,16) || 'HANOX'; return `${clean}-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`; }
function validDays(v) { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 99999) throw new HttpsError('invalid-argument','Thời hạn phải từ 1 đến 99.999 ngày.'); return n; }
exports.adminCreateKey = onCall({region: REGION, enforceAppCheck: false}, async req => {
 const uid=requireAuth(req); await requireAdmin(uid);
 const days=validDays(req.data.days), qty=Math.max(1,Math.min(100,Number(req.data.qty)||1));
 const maxDevices=Math.max(1,Math.min(20,Number(req.data.maxDevices)||1));
 const prefix=String(req.data.prefix||'HANOX').slice(0,24); const note=String(req.data.note||'').slice(0,160);
 const created=[]; const batch=db.batch();
 for(let i=0;i<qty;i++){ let key; let ref; do { key=makeKey(prefix); ref=db.collection('keys').doc(key); } while((await ref.get()).exists);
  batch.set(ref,{key,days,points:days,maxDevices,devices:[],usedDevices:0,type:days>=19?'VIP':'BASIC',note,status:'unused',locked:false,createdAt:Date.now(),createdBy:uid,redeemedBy:null,redeemedAt:null}); created.push(key); }
 await batch.commit(); return {keys:created};
});
exports.redeemKey = onCall({region: REGION, enforceAppCheck: false}, async req => {
 const uid=requireAuth(req); const key=String(req.data.key||'').trim().toUpperCase();
 if(!/^[A-Z0-9]+-[A-F0-9]{8}-[A-F0-9]{8}$/.test(key)) throw new HttpsError('invalid-argument','Định dạng key không hợp lệ.');
 const keyRef=db.doc(`keys/${key}`), userRef=db.doc(`users/${uid}`);
 return db.runTransaction(async tx=>{
  const [ks,us]=await Promise.all([tx.get(keyRef),tx.get(userRef)]);
  if(!ks.exists) throw new HttpsError('not-found','Key không tồn tại.'); const k=ks.data();
  if(k.locked) throw new HttpsError('failed-precondition','Key đã bị khóa.');
  if(k.status!=='unused') throw new HttpsError('already-exists','Key đã được sử dụng.');
  const points=Number(k.points || k.days || 0); if(!Number.isInteger(points)||points<1) throw new HttpsError('failed-precondition','Key không có điểm hợp lệ.');
  const old=us.exists?Number(us.data().points||0):0;
  if(!us.exists) tx.set(userRef,{uid,email:req.auth.token.email||'',displayName:req.auth.token.name||'',points:points,createdAt:Date.now()});
  else tx.update(userRef,{points:old+points,email:req.auth.token.email||'',displayName:req.auth.token.name||''});
  tx.update(keyRef,{status:'redeemed',redeemedBy:uid,redeemedAt:Date.now(),usedDevices:1,devices:[uid]});
  const tr=db.collection('transactions').doc(); tx.set(tr,{uid,type:'redeem',key,points,createdAt:Date.now(),balanceAfter:old+points});
  return {pointsAdded:points,balance:old+points};
 });
});
exports.chargeExport = onCall({region: REGION, enforceAppCheck: false}, async req => {
 const uid=requireAuth(req); const count=Number(req.data.count||1);
 if(count!==1) throw new HttpsError('invalid-argument','Mỗi lần tạo một bộ đồ chỉ tốn 1 điểm.');
 const userRef=db.doc(`users/${uid}`); const txRef=db.collection('transactions').doc();
 return db.runTransaction(async tx=>{ const us=await tx.get(userRef); if(!us.exists) throw new HttpsError('failed-precondition','Hãy nạp key trước khi tạo file.');
  const points=Number(us.data().points||0); if(points<1) throw new HttpsError('resource-exhausted','Bạn đã hết điểm. Hãy nhập key mới để nạp điểm.');
  tx.update(userRef,{points:points-1}); tx.set(txRef,{uid,type:'export',points:-1,createdAt:Date.now(),balanceAfter:points-1}); return {charged:1,balance:points-1}; });
});
exports.adminSetKeyLock = onCall({region: REGION}, async req=>{const uid=requireAuth(req);await requireAdmin(uid);const key=String(req.data.key||'');const locked=!!req.data.locked;if(!key)throw new HttpsError('invalid-argument','Thiếu key.');await db.doc(`keys/${key}`).update({locked,lockedAt:locked?Date.now():null});return {ok:true};});
exports.adminDeleteKey = onCall({region: REGION}, async req=>{const uid=requireAuth(req);await requireAdmin(uid);const key=String(req.data.key||'');if(!key)throw new HttpsError('invalid-argument','Thiếu key.');await db.doc(`keys/${key}`).delete();return {ok:true};});
exports.adminResetKeyDevices = onCall({region: REGION}, async req=>{const uid=requireAuth(req);await requireAdmin(uid);const key=String(req.data.key||'');if(!key)throw new HttpsError('invalid-argument','Thiếu key.');await db.doc(`keys/${key}`).update({devices:[],usedDevices:0});return {ok:true};});
exports.adminImportKeys = onCall({region: REGION}, async req=>{const uid=requireAuth(req);await requireAdmin(uid);const rows=Array.isArray(req.data.keys)?req.data.keys:[];if(rows.length>100)throw new HttpsError('invalid-argument','Mỗi lần nhập tối đa 100 key.');const batch=db.batch();let count=0;for(const row of rows){const key=String(row.key||'').trim().toUpperCase();if(!/^[A-Z0-9]+-[A-F0-9]{8}-[A-F0-9]{8}$/.test(key))continue;const ref=db.doc(`keys/${key}`);if((await ref.get()).exists)continue;const days=validDays(row.days);batch.create(ref,{key,days,points:days,maxDevices:Math.max(1,Math.min(20,Number(row.maxDevices)||1)),devices:[],usedDevices:0,type:days>=19?'VIP':'BASIC',note:String(row.note||'Imported').slice(0,160),status:'unused',locked:false,createdAt:Date.now(),createdBy:uid,redeemedBy:null,redeemedAt:null});count++;}if(count)await batch.commit();return {count};});
