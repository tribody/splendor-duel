/* ============================================================
   璀璨宝石：对决 (Splendor Duel) — 纯前端单页实现
   规则来源：Space Cowboys 官方规则
   ============================================================ */
"use strict";

/* ---------- 常量 ---------- */
const GEMS = ["white","blue","green","red","black"];
const TOKENS = [...GEMS, "pearl", "gold"];
const COLOR_NAME = {
  white:"钻石", blue:"蓝宝石", green:"祖母绿", red:"红宝石", black:"黑曜石",
  pearl:"珍珠", gold:"黄金"
};
const COLOR_HEX = {
  white:"#dfe6ef", blue:"#2f6df0", green:"#1faa59", red:"#e23b3b", black:"#20232c",
  pearl:"#f3c9d4", gold:"#f2c84b"
};
const ABIL_NAME = { extra:"再回合", associate:"附同色", pluck:"取同色" };
const ABIL_ICON = { extra:"↻", associate:"✦", pluck:"✋" };

// 哆啦A梦角色图片映射：宝石颜色 → 角色（按卡牌ID哈希选择，避免每次刷新都一样）
const CHAR_IMGS = {
  white: ["assets/nobita.jpg", "assets/dorami.jpg"],
  blue:  ["assets/doraemon.jpg"],
  green: ["assets/suneo.jpg"],
  red:   ["assets/gian.jpg"],
  black: ["assets/dekisugi.jpg"],
  pearl: ["assets/shizuka.jpg"],
  gold:  ["assets/doraemon.jpg", "assets/dorami.jpg"]
};
function charImgFor(color, cardId){
  const arr = CHAR_IMGS[color] || CHAR_IMGS.gold;
  return arr[(cardId||0) % arr.length];
}

// 5x5 螺旋顺序（从中心向外），用于补货
const SPIRAL = [
  [2,2],[2,3],[1,3],[1,2],[1,1],[2,1],[3,1],[3,2],[3,3],[3,4],
  [2,4],[1,4],[0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],
  [4,0],[4,1],[4,2],[4,3],[4,4]
];

let S = null;       // 主状态
let cardIdSeq = 0;
const _dealtCards = new Set(); // 已发牌ID集合，用于避免重渲染时重复播放发牌动画
let _initialDealDone = false;  // 当前对局是否已完成初始发牌动画

/* ============================================================
   卡牌生成（L1:30 / L2:24 / L3:13，分布近似原版）
   ============================================================ */
function mkCard(level, cost, bonusColor, bonusCount, points, crowns, ability){
  return {
    id: ++cardIdSeq, level, cost: {...cost},
    bonus: { color: bonusColor, count: bonusCount },
    points: points||0, crowns: crowns||0, ability: ability||null,
    attached: null
  };
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function buildDecks(){
  const L1=[], L2=[], L3=[]; const C=GEMS;
  let rot=0; const c1=()=>C[rot%C.length], c2=()=>C[(rot+1)%C.length], c3=()=>C[(rot+3)%C.length];

  // Level 1 (30)
  for(let i=0;i<8;i++){ rot=i; L1.push(mkCard(1,{[c1()]:2}, c1(),1,0,0)); }
  for(let i=0;i<8;i++){ rot=i; L1.push(mkCard(1,{[c1()]:2,[c2()]:1}, c1(),1,0,0)); }
  for(let i=0;i<6;i++){ rot=i; L1.push(mkCard(1,{[c1()]:3}, c1(),1,1,0)); }
  for(let i=0;i<4;i++){ rot=i; L1.push(mkCard(1,{[c1()]:1,[c2()]:1,[c3()]:1}, c2(),1,0,0)); }
  for(let i=0;i<2;i++){ rot=i; L1.push(mkCard(1,{[c1()]:2,[c2()]:2}, c1(),1,0,1)); }
  for(let i=0;i<2;i++){ rot=i; L1.push(mkCard(1,{[c1()]:2}, c1(),1,0,0,"pluck")); }
  // Level 2 (24)
  for(let i=0;i<6;i++){ rot=i; L2.push(mkCard(2,{[c1()]:3,[c2()]:2}, c1(),1,1,0)); }
  for(let i=0;i<4;i++){ rot=i; L2.push(mkCard(2,{[c1()]:2,[c2()]:2,[c3()]:1}, c1(),1,1,0)); }
  for(let i=0;i<3;i++){ rot=i; L2.push(mkCard(2,{[c1()]:4}, c1(),2,1,0)); }
  for(let i=0;i<3;i++){ rot=i; L2.push(mkCard(2,{[c1()]:3,pearl:1}, c1(),1,2,0)); }
  for(let i=0;i<3;i++){ rot=i; L2.push(mkCard(2,{[c1()]:2,[c2()]:2}, c1(),1,1,1)); }
  for(let i=0;i<2;i++){ rot=i; L2.push(mkCard(2,{[c1()]:3,[c2()]:1}, c1(),1,1,0,"pluck")); }
  for(let i=0;i<2;i++){ rot=i; L2.push(mkCard(2,{[c1()]:2,[c2()]:2,pearl:1}, c1(),1,2,0,"extra")); }
  L2.push(mkCard(2,{[C[0]]:3}, C[0],2,0,0,"associate"));
  // Level 3 (13)
  for(let i=0;i<3;i++){ rot=i; L3.push(mkCard(3,{[c1()]:5,[c2()]:3}, c1(),1,4,0)); }
  for(let i=0;i<3;i++){ rot=i; L3.push(mkCard(3,{[c1()]:4,[c2()]:2,pearl:1}, c1(),1,4,1)); }
  for(let i=0;i<2;i++){ rot=i; L3.push(mkCard(3,{[c1()]:5,pearl:1}, c1(),2,5,0)); }
  for(let i=0;i<2;i++){ rot=i; L3.push(mkCard(3,{[c1()]:3,[c2()]:3,[c3()]:2}, c1(),1,3,1)); }
  L3.push(mkCard(3,{[C[0]]:4,[C[1]]:2,pearl:2}, C[0],1,5,2));
  L3.push(mkCard(3,{[C[2]]:5}, C[2],1,4,0,"extra"));
  L3.push(mkCard(3,{[C[3]]:4,[C[4]]:2}, C[3],2,3,0,"associate"));

  shuffle(L1); shuffle(L2); shuffle(L3);

  const royal = [
    { id:"R1", name:"王室恩赐", points:2, crowns:0, effect:"privilege", taken:false },
    { id:"R2", name:"王冠传承", points:1, crowns:1, effect:null,        taken:false },
    { id:"R3", name:"帝王荣光", points:4, crowns:0, effect:null,        taken:false },
    { id:"R4", name:"至高权杖", points:3, crowns:1, effect:"privilege", taken:false }
  ];
  return { 1:L1, 2:L2, 3:L3, royal };
}

/* ============================================================
   新对局
   ============================================================ */
function newGame(mode, aiDiff){
  const decks = buildDecks();
  _dealtCards.clear(); // 重置发牌记录
  _initialDealDone = false;
  const bag = { white:0,blue:0,green:0,red:0,black:0,pearl:0,gold:0 };
  const pool = [];
  GEMS.forEach(g=>{ for(let i=0;i<4;i++) pool.push(g); });
  for(let i=0;i<2;i++) pool.push("pearl");
  for(let i=0;i<3;i++) pool.push("gold");
  shuffle(pool);
  const board = Array.from({length:5},()=>Array(5).fill(null));
  SPIRAL.forEach(([r,c],i)=>{ board[r][c]=pool[i]; });

  const pyramid = { 1:[], 2:[], 3:[] };
  for(const lvl of [1,2,3]){
    const need = lvl===1?5:lvl===2?4:3;
    for(let i=0;i<need;i++) pyramid[lvl].push(decks[lvl].pop());
  }

  const firstIsP0 = Math.random()<0.5;
  const players = [
    mkPlayer(mode==="ai"?"你":"玩家一"),
    mkPlayer(mode==="ai"?"AI":"玩家二")
  ];
  players[firstIsP0?1:0].privileges = 1; // 后手拿1卷轴

  S = {
    mode, ai:{ on: mode==="ai", diff: aiDiff||"normal", idx:1 },
    bag, board, decks, pyramid, royal: decks.royal,
    players, privilegesPool: 2,
    current: firstIsP0?0:1,
    phase:"opt", log:[], winner:null,
    turn:{ replenished:false, extraLeft:0 },
    ui:{ mode:null, selected:[], purchaseTarget:null, pluckCard:null, associateCard:null, discard:false }
  };
  log("新对局 — "+(mode==="ai"?"人机("+ (aiDiff||"normal") +")":"本地热座")+"。先手："+S.players[S.current].name, "sys");
  // 触发开局揭幕动画，动画进行中先渲染好棋盘（被黑幕遮挡）
  render();
  triggerCurtain();
  _initialDealDone = true; // 揭幕后标记发牌完成，避免后续重渲染重复发牌动画
  if(isAITurn()) setTimeout(aiTurn, 2400); // 等揭幕完成后再开始 AI 回合
}
// 开局揭幕：黑幕合上→显示标题→左右拉开
function triggerCurtain(){
  const c = $("#curtain");
  if(!c) return;
  c.classList.remove("open");
  // 强制 reflow 确保初始状态
  void c.offsetWidth;
  // 短暂停留展示标题，然后拉开
  setTimeout(()=> c.classList.add("open"), 900);
  // 揭幕后隐藏（避免遮挡点击）
  setTimeout(()=> { c.style.display="none"; }, 2200);
}
function mkPlayer(name){
  return { name, tokens:{white:0,blue:0,green:0,red:0,black:0,pearl:0,gold:0},
    reserved:[], purchased:[], royal:[], privileges:0, royalClaimed:0 };
}

/* ============================================================
   派生属性
   ============================================================ */
function bonusesOf(p){
  const m={}; GEMS.forEach(g=>m[g]=0);
  p.purchased.forEach(c=>{
    if(c.bonus.color==="wild"){ if(c.attached) m[c.attached]+=(c.bonus.count||1); }
    else m[c.bonus.color]+=(c.bonus.count||1);
  });
  return m;
}
function cardColor(c){ return c.bonus.color==="wild" ? (c.attached||null) : c.bonus.color; }
function crownsOf(p){ return p.purchased.reduce((s,c)=>s+(c.crowns||0),0) + p.royal.reduce((s,r)=>s+(r.crowns||0),0); }
function prestigeOf(p){ return p.purchased.reduce((s,c)=>s+(c.points||0),0) + p.royal.reduce((s,r)=>s+(r.points||0),0); }
function colorPrestigeOf(p){
  const m={}; GEMS.forEach(g=>m[g]=0);
  p.purchased.forEach(c=>{ const col=cardColor(c); if(col && m[col]!==undefined) m[col]+=(c.points||0); });
  return m;
}
function tokenTotal(p){ return TOKENS.reduce((s,t)=>s+(p.tokens[t]||0),0); }
function effectiveCost(p, card){
  const b = bonusesOf(p); const need={};
  for(const k in card.cost){
    if(GEMS.includes(k)) need[k]=Math.max(0, card.cost[k]-(b[k]||0));
    else need.pearl = card.cost.pearl;
  }
  return need;
}
function planPayment(p, card){
  const need = effectiveCost(p, card);
  const pay={}; let gold=0;
  for(const k in need){
    const have = p.tokens[k]||0;
    const use = Math.min(have, need[k]);
    if(use>0) pay[k]=use;
    gold += need[k]-use;
  }
  if(gold > (p.tokens.gold||0)) return null;
  return { pay, gold };
}
function canAfford(p, card){
  if(card.ability==="associate"){
    const b=bonusesOf(p);
    if(!GEMS.some(g=>b[g]>0)) return false;
  }
  return planPayment(p,card)!==null;
}

/* ============================================================
   取石选择校验
   ============================================================ */
function isSelectableToken(t){ return t && t!=="gold"; }
function cellAt(r,c){ return S.board[r][c]; }
function unitDir(cells){
  const [r0,c0]=cells[0];
  if(cells.every(([r,c])=> r===r0)) return [0,1];
  if(cells.every(([r,c])=> c===c0)) return [1,0];
  if(cells.every(([r,c])=> r-c === r0-c0)) return [1,1];
  if(cells.every(([r,c])=> r+c === r0+c0)) return [1,-1];
  return null;
}
function isValidSelection(cells){
  if(cells.length<1||cells.length>3) return false;
  if(!cells.every(([r,c])=> isSelectableToken(cellAt(r,c)))) return false;
  if(cells.length===1) return true;
  const d = unitDir(cells);
  if(!d) return false;
  for(const start of cells){
    const path=[];
    for(let s=0;s<cells.length;s++) path.push([start[0]+d[0]*s, start[1]+d[1]*s]);
    if(path.every(([r,c])=> r>=0&&r<5&&c>=0&&c<5 && isSelectableToken(cellAt(r,c)))){
      if(path.every(p=> cells.some(c=> c[0]===p[0]&&c[1]===p[1]))) return true;
    }
  }
  return false;
}

/* ============================================================
   行动：取石
   ============================================================ */
function doTakeTokens(cells){
  const p=cur();
  const actingArea = actingPlayerArea(); // 在endTurn前捕获，避免回合切换后定位错误
  const taken = cells.map(([r,c])=> S.board[r][c]);
  // 触发粒子爆发 + 宝石飞行 + 格子腾空涟漪（在清空前取到格子位置，FX元素挂body上不受render影响）
  cells.forEach(([r,c])=>{
    const cellEl = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    const targetEl = FX.playerTokenPile(S.board[r][c]);
    FX.tokenBurst(r, c, S.board[r][c]);
    FX.cellVacate(r, c);
    if(cellEl && targetEl) FX.flyToken(cellEl, targetEl, S.board[r][c]);
  });
  // 同步状态变更（FX动画在document.body上存活，不受render影响）
  cells.forEach(([r,c])=> S.board[r][c]=null);
  taken.forEach(t=> p.tokens[t]=(p.tokens[t]||0)+1);
  const sameColor = taken.length===3 && taken.every(t=>t===taken[0]);
  const twoPearl = taken.length===2 && taken.every(t=>t==="pearl");
  if(sameColor || twoPearl){ gainPrivilege(opp(), cur()); FX.pulseScreen("rgba(231,181,74,.12)"); }
  log(p.name+" 拿取 "+taken.map(t=>COLOR_NAME[t]).join("+")+(sameColor||twoPearl?"（对手+卷轴）":""), cls(cur()));
  endTurn();
  // render后触发token pile弹跳 + 数值高亮（使用捕获的actingArea）
  requestAnimationFrame(()=>{
    const uniqueColors = [...new Set(taken)];
    uniqueColors.forEach(c=> FX.pilePop(c, actingArea));
    if(actingArea) FX.statBump(actingArea, "手持");
  });
}

/* ============================================================
   行动：预留（取1金+1卡）
   ============================================================ */
function doReserve(target){
  const p=cur();
  if(p.reserved.length>=3){ $("#message").textContent="预留已满（最多3张）"; return; }
  const actingArea = actingPlayerArea(); // 在endTurn前捕获
  // 预先获取黄金格子元素和卡槽元素（在状态变更前）
  const goldCellEl = findGoldCellEl();
  let cardSlotEl = null;
  if(target.kind==="pyramid"){
    const c = S.pyramid[target.level][target.idx];
    if(c) cardSlotEl = document.querySelector(`.card-slot[data-cid="${c.id}"]`);
  } else {
    cardSlotEl = document.querySelector(`.deck-slot.lvl${target.level}`);
  }
  // 先触发动画（使用变更前的元素位置，FX元素挂body上不受render影响）
  if(goldCellEl){
    FX.cellVacate(+goldCellEl.dataset.r, +goldCellEl.dataset.c);
    const goldTarget = FX.playerTokenPile("gold");
    if(goldTarget) FX.flyToken(goldCellEl, goldTarget, "gold");
  }
  if(cardSlotEl){
    const reservedBox = actingArea ? actingArea.querySelectorAll(".p-cards")[1] : null;
    if(reservedBox) FX.flyCard(cardSlotEl, reservedBox);
  }
  // 同步状态变更
  const gotGold = takeGoldFromBoard(p);
  const lvlName = "Lv"+target.level;
  if(target.kind==="deck"){
    const c = S.decks[target.level].pop();
    if(c) p.reserved.push(c);
    log(p.name+" 暗抽"+lvlName+"并预留"+(gotGold?"（+黄金）":"（棋盘无黄金，没有拿到黄金）"), cls(cur()));
  } else {
    const c = S.pyramid[target.level][target.idx];
    if(!c) return;
    S.pyramid[target.level][target.idx] = S.decks[target.level].pop() || null;
    p.reserved.push(c);
    log(p.name+" 预留一张"+lvlName+"卡"+(gotGold?"（+黄金）":"（棋盘无黄金，没有拿到黄金）"), cls(cur()));
  }
  if(!gotGold) $("#message").textContent="提示：当前棋盘无黄金，预留未获得黄金代币";
  endTurn();
  requestAnimationFrame(()=>{
    if(gotGold) FX.pilePop("gold", actingArea);
    if(actingArea) FX.statBump(actingArea, "预留");
  });
}
function takeGoldFromBoard(p){
  for(let r=0;r<5;r++) for(let c=0;c<5;c++) if(S.board[r][c]==="gold"){ S.board[r][c]=null; p.tokens.gold=(p.tokens.gold||0)+1; return true; }
  return false;
}
// 查找棋盘上第一个黄金格子的DOM元素
function findGoldCellEl(){
  for(let r=0;r<5;r++) for(let c=0;c<5;c++){
    if(S.board[r][c]==="gold"){
      return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    }
  }
  return null;
}

/* ============================================================
   行动：购买
   ============================================================ */
function doPurchase(card){
  const p=cur();
  const plan = planPayment(p, card);
  if(!plan) return;
  const actingArea = actingPlayerArea(); // 在endTurn前捕获
  // 购买前在卡槽位置触发金色闪光 + 卡牌飞行动画
  const slot = document.querySelector(`.card-slot[data-cid="${card.id}"]`);
  if(slot){
    FX.cardFlash(slot, "purchase");
    const cardBox = actingArea ? actingArea.querySelector(".p-cards") : null;
    if(cardBox) FX.flyCard(slot, cardBox);
  }
  // 高分卡触发屏幕脉冲
  if((card.points||0)>=4 || (card.crowns||0)>=1) FX.pulseScreen("rgba(231,181,74,.10)");
  // 同步状态变更
  for(const k in plan.pay){ p.tokens[k]-=plan.pay[k]; }
  p.tokens.gold -= plan.gold;
  for(const k in plan.pay){ S.bag[k]=(S.bag[k]||0)+plan.pay[k]; }
  if(plan.gold>0) S.bag.gold=(S.bag.gold||0)+plan.gold;
  if(card._from==="reserved") p.reserved = p.reserved.filter(c=>c.id!==card.id);
  else {
    const lvl=card.level;
    const idx = S.pyramid[lvl].findIndex(c=>c&&c.id===card.id);
    if(idx>=0) S.pyramid[lvl][idx] = S.decks[lvl].pop() || null;
  }
  p.purchased.push(card);
  log(p.name+" 购买 "+cardSummary(card)+"（花费 "+payStr(plan)+"）", cls(cur()));

  if(card.ability==="associate"){
    const b=bonusesOf(p);
    const have=GEMS.filter(g=>b[g]>0);
    if(have.length===0){ log("附同色：无已有奖励卡，忽略","sys"); afterPurchase(card); return; }
    if(have.length===1){ attachAssociate(card,have[0]); return; }
    if(isAITurn()){ attachAssociate(card, aiPickAssociateColor(have)); return; }
    S.ui.associateCard=card; promptAssociate(have); return;
  }
  afterPurchase(card);
  // render后高亮声望/皇冠数值（使用捕获的actingArea）
  requestAnimationFrame(()=>{
    if(actingArea){
      if(card.points) FX.statBump(actingArea, "声望");
      if(card.crowns) FX.statBump(actingArea, "皇冠");
    }
  });
}
function attachAssociate(card,color){
  card.attached=color;
  log("附同色卡 → "+COLOR_NAME[color], "sys");
  S.ui.associateCard=null;
  afterPurchase(card);
}
function afterPurchase(card){
  const p=cur();
  const cr=crownsOf(p);
  let owed=0;
  if(cr>=3 && p.royalClaimed<1) owed++;
  if(cr>=6 && p.royalClaimed<2) owed++;
  if(owed>0){ claimRoyalSequence(owed, ()=> afterRoyal(card)); return; }
  afterRoyal(card);
}
function afterRoyal(card){
  if(card.ability==="pluck"){
    S.ui.pluckCard=card;
    if(isAITurn()) aiPluck(card); else promptPluck(card);
    return;
  }
  if(card.ability==="extra"){ S.turn.extraLeft++; log("↻ 获得额外一回合","sys"); }
  endTurn();
}
function claimRoyalSequence(n, done){
  if(n<=0){ done(); return; }
  const avail=S.royal.filter(r=>!r.taken);
  if(avail.length===0){ done(); return; }
  if(isAITurn()){ applyRoyalSimple(cur(), aiPickRoyal(avail)); claimRoyalSequence(n-1, done); }
  else { promptRoyalChoice(avail, r=>{ applyRoyalSimple(cur(),r); claimRoyalSequence(n-1, done); }); }
}
function applyRoyalSimple(p,r){
  r.taken=true; p.royal.push(r); p.royalClaimed++;
  log(p.name+" 达成皇冠阈值，获王室卡「"+r.name+"」(+"+r.points+"分"+(r.crowns?"/+"+r.crowns+"👑":"")+")", cls(cur()));
  FX.pulseScreen("rgba(180,120,255,.14)");
  if(r.effect==="privilege") gainPrivilege(p, opp());
  render();
}

/* ============================================================
   卷轴 & 补货
   ============================================================ */
function gainPrivilege(beneficiary, giver){
  if(beneficiary.privileges>=3) return;
  if(S.privilegesPool>0){
    S.privilegesPool--; beneficiary.privileges++;
    // 卷轴从补给池飞向受益玩家区
    const supplyEl = $("#supplyPrivilege");
    const benIdx = S.players.indexOf(beneficiary);
    const benArea = S.ai.on ? (benIdx===S.ai.idx ? $("#opponent") : $("#player")) : (benIdx===0 ? $("#player") : $("#opponent"));
    if(supplyEl && benArea) FX.flyPrivilege(supplyEl, benArea);
  }
  else if(giver && giver.privileges>0){
    giver.privileges--; beneficiary.privileges++;
    // 卷轴从给予者飞向受益者
    const gIdx = S.players.indexOf(giver);
    const bIdx = S.players.indexOf(beneficiary);
    const gArea = S.ai.on ? (gIdx===S.ai.idx ? $("#opponent") : $("#player")) : (gIdx===0 ? $("#player") : $("#opponent"));
    const bArea = S.ai.on ? (bIdx===S.ai.idx ? $("#opponent") : $("#player")) : (bIdx===0 ? $("#player") : $("#opponent"));
    if(gArea && bArea) FX.flyPrivilege(gArea, bArea);
  }
}
function doPrivilegeTake(r,c){
  const p=cur();
  if(p.privileges<=0) return false;
  const t = S.board[r][c];
  if(!isSelectableToken(t)) return false;
  const actingArea = actingPlayerArea();
  const cellEl = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  const targetEl = FX.playerTokenPile(t);
  // 卷轴归还飞行：从玩家区飞回补给池
  const supplyEl = $("#supplyPrivilege");
  if(actingArea && supplyEl) FX.flyPrivilege(actingArea, supplyEl);
  FX.tokenBurst(r, c, t);
  FX.cellVacate(r, c);
  if(cellEl && targetEl) FX.flyToken(cellEl, targetEl, t);
  // 同步状态变更
  S.board[r][c]=null;
  p.tokens[t]++;
  p.privileges--;
  S.privilegesPool++;
  log(p.name+" 使用卷轴拿取 "+COLOR_NAME[t], cls(cur()));
  if(p.privileges===0) S.ui.mode=null;
  render();
  requestAnimationFrame(()=>{
    FX.pilePop(t, actingArea);
    if(actingArea) FX.statBump(actingArea, "卷轴");
    const sp = $("#supplyPrivilege"); if(sp){ sp.classList.remove("pop"); void sp.offsetWidth; sp.classList.add("pop"); setTimeout(()=>sp.classList.remove("pop"),400); }
  });
  return true;
}
function doReplenish(){
  const p=cur();
  if(S.turn.replenished || !bagHasTokens()) return;
  // 记录补货前的空格位置
  const filledCells = [];
  let placed=0;
  for(const [r,c] of SPIRAL){
    if(S.board[r][c]===null){
      const t=drawFromBag();
      if(!t) break;
      S.board[r][c]=t;
      filledCells.push([r,c]);
      placed++;
    }
  }
  S.turn.replenished=true;
  log(p.name+" 补充棋盘（"+placed+"个），对手+卷轴", cls(cur()));
  gainPrivilege(opp(), cur());
  render();
  // 为新补货的宝石添加交错落下动画
  filledCells.forEach(([r,c], i)=>{
    setTimeout(()=>{
      const cellEl = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
      if(cellEl){
        const tk = cellEl.querySelector(".token");
        if(tk){ tk.classList.add("drop-in"); setTimeout(()=>tk.classList.remove("drop-in"), 500); }
      }
    }, i*70);
  });
  // 卷轴池脉冲
  const sp = $("#supplyPrivilege"); if(sp){ sp.classList.remove("pop"); void sp.offsetWidth; sp.classList.add("pop"); setTimeout(()=>sp.classList.remove("pop"),400); }
}
function drawFromBag(){
  const arr=[];
  for(const t of TOKENS){ for(let i=0;i<(S.bag[t]||0);i++) arr.push(t); }
  if(arr.length===0) return null;
  const t = arr[Math.floor(Math.random()*arr.length)];
  S.bag[t]--;
  return t;
}
function bagHasTokens(){ let x=0; for(const t of TOKENS) x+=(S.bag[t]||0); return x>0; }
function hasGoldOnBoard(){ for(let r=0;r<5;r++)for(let c=0;c<5;c++) if(S.board[r][c]==="gold") return true; return false; }

/* ============================================================
   回合结束
   ============================================================ */
function endTurn(){
  const p=cur();
  if(tokenTotal(p)>10){
    if(isAITurn()){ aiDiscard(p); finalizeTurn(); }
    else { S.ui.discard=true; render(); return; }
  } else finalizeTurn();
}
function finalizeTurn(){
  const p=cur();
  const w = checkWin(p);
  if(w){ S.winner={ idx:S.current, reason:w }; log(p.name+" 胜利："+w,"sys"); render(); showWin(); return; }
  if(S.turn.extraLeft>0){
    S.turn.extraLeft--; S.turn.replenished=false; S.phase="opt";
    resetUI(); log(p.name+" ↻ 额外回合","sys"); render();
    FX.turnBanner(p.name+" · 额外回合", isAITurn());
    triggerTurnEnter();
    if(isAITurn()) setTimeout(aiTurn, 500);
    return;
  }
  S.current = 1-S.current;
  S.turn={replenished:false, extraLeft:0}; S.phase="opt";
  resetUI(); render();
  // 回合切换横幅
  const np = cur();
  FX.turnBanner(np.name, isAITurn());
  triggerTurnEnter();
  if(isAITurn()) setTimeout(aiTurn, 700);
}
// 触发当前玩家区的回合进入动画
function triggerTurnEnter(){
  const playerArea = actingPlayerArea();
  if(playerArea){
    playerArea.classList.remove("turn-enter");
    void playerArea.offsetWidth;
    playerArea.classList.add("turn-enter");
    setTimeout(()=> playerArea.classList.remove("turn-enter"), 500);
  }
}
function resetUI(){ S.ui={mode:null,selected:[],purchaseTarget:null,pluckCard:null,associateCard:null,discard:false}; }
function checkWin(p){
  if(prestigeOf(p)>=20) return "声望达到20";
  if(crownsOf(p)>=10) return "集齐10皇冠";
  const cp = colorPrestigeOf(p);
  for(const g of GEMS) if(cp[g]>=10) return "同色"+COLOR_NAME[g]+"达到10分";
  return null;
}

/* ---------- 辅助 ---------- */
function cur(){ return S.players[S.current]; }
function opp(){ return S.players[1-S.current]; }
function cls(idx){ return idx===0?"me":"foe"; }
function isAITurn(){ return S.ai.on && S.current===S.ai.idx; }
// 获取当前行动玩家的DOM区域（在endTurn前调用，避免回合切换后定位错误）
function actingPlayerArea(idx){
  const i = idx!==undefined ? idx : S.current;
  return S.ai.on ? (i===S.ai.idx ? $("#opponent") : $("#player")) : (i===0 ? $("#player") : $("#opponent"));
}
function cardSummary(c){
  return (c.points?c.points+"分 ":"")+(c.crowns?"👑×"+c.crowns+" ":"")+(c.bonus.count>1?"双":"")+COLOR_NAME[c.bonus.color==="wild"?"white":c.bonus.color]+"奖励"+(c.ability?(" ["+ABIL_NAME[c.ability]+"]"):"");
}
function payStr(plan){ const a=[]; for(const k in plan.pay) a.push(plan.pay[k]+COLOR_NAME[k]); if(plan.gold) a.push(plan.gold+"金"); return a.join("+")||"0"; }

/* ============================================================
   视觉特效（FX）— 粒子 / 浮字 / 卡牌闪光 / 回合切换
   ============================================================ */
const FX = {
  // 从棋盘格位置爆发宝石色粒子
  tokenBurst(r, c, color){
    const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    if(!cell) return;
    const rect = cell.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    const hex = COLOR_HEX[color] || "#fff";
    const n = 10;
    for(let i=0;i<n;i++){
      const p = document.createElement("div");
      p.className = "fx-particle";
      p.style.background = hex;
      p.style.left = cx+"px"; p.style.top = cy+"px";
      const ang = (Math.PI*2 * i/n) + Math.random()*0.4;
      const dist = 28 + Math.random()*22;
      const dx = Math.cos(ang)*dist, dy = Math.sin(ang)*dist - 10;
      p.style.setProperty("--dx", dx+"px");
      p.style.setProperty("--dy", dy+"px");
      p.style.boxShadow = `0 0 8px ${hex}`;
      document.body.appendChild(p);
      setTimeout(()=> p.remove(), 700);
    }
  },
  // 浮动数字提示（如 +1 钻石）
  floatText(text, x, y, color){
    const d = document.createElement("div");
    d.className = "fx-float";
    d.textContent = text;
    d.style.left = x+"px"; d.style.top = y+"px";
    if(color) d.style.color = color;
    document.body.appendChild(d);
    setTimeout(()=> d.remove(), 1100);
  },
  // 在元素位置弹出浮字
  floatAt(el, text, color){
    if(!el) return;
    const r = el.getBoundingClientRect();
    FX.floatText(text, r.left + r.width/2, r.top + r.height/2 - 8, color);
  },
  // 卡牌购买/预留闪光（固定定位，避免被 render() 的 innerHTML 重置破坏）
  cardFlash(slot, kind){
    if(!slot) return;
    const rect = slot.getBoundingClientRect();
    const f = document.createElement("div");
    f.className = "fx-cardflash "+(kind||"");
    f.style.position = "fixed";
    f.style.left = rect.left + "px";
    f.style.top = rect.top + "px";
    f.style.width = rect.width + "px";
    f.style.height = rect.height + "px";
    document.body.appendChild(f);
    setTimeout(()=> f.remove(), 700);
  },
  // 整页轻微闪烁（重要事件）
  pulseScreen(color){
    const f = document.createElement("div");
    f.className = "fx-screen-pulse";
    if(color) f.style.background = color;
    document.body.appendChild(f);
    setTimeout(()=> f.remove(), 600);
  },
  // 宝石从棋盘格飞到目标元素（玩家token堆/卷轴池）
  flyToken(fromEl, toEl, color){
    if(!fromEl || !toEl) return;
    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    const hex = COLOR_HEX[color] || "#fff";
    const fly = document.createElement("div");
    fly.className = "fx-fly-token";
    fly.style.background = `radial-gradient(circle at 35% 30%, ${hex}, ${hex})`;
    fly.style.boxShadow = `inset 0 -3px 6px rgba(0,0,0,.35), inset 0 3px 5px rgba(255,255,255,.4), 0 4px 12px ${hex}80`;
    fly.style.left = (fr.left + fr.width/2) + "px";
    fly.style.top = (fr.top + fr.height/2) + "px";
    const dx = (tr.left + tr.width/2) - (fr.left + fr.width/2);
    const dy = (tr.top + tr.height/2) - (fr.top + fr.height/2);
    fly.style.setProperty("--dx", dx + "px");
    fly.style.setProperty("--dy", dy + "px");
    document.body.appendChild(fly);
    setTimeout(()=> fly.remove(), 650);
  },
  // 卡牌从金字塔飞到玩家区（购买/预留）
  flyCard(fromEl, toEl){
    if(!fromEl || !toEl) return;
    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    const fly = document.createElement("div");
    fly.className = "fx-fly-card";
    fly.style.left = fr.left + "px";
    fly.style.top = fr.top + "px";
    fly.style.width = fr.width + "px";
    fly.style.height = fr.height + "px";
    const dx = (tr.left + tr.width/2) - (fr.left + fr.width/2);
    const dy = (tr.top + tr.height/2) - (fr.top + fr.height/2);
    fly.style.setProperty("--dx", dx + "px");
    fly.style.setProperty("--dy", dy + "px");
    document.body.appendChild(fly);
    setTimeout(()=> fly.remove(), 750);
  },
  // 回合切换横幅
  turnBanner(playerName, isAI){
    const b = document.createElement("div");
    b.className = "fx-turn-banner" + (isAI ? " ai" : "");
    b.innerHTML = '<span class="fx-turn-icon">◆</span><span class="fx-turn-text">'+playerName+' 的回合</span>';
    document.body.appendChild(b);
    setTimeout(()=> b.remove(), 1600);
  },
  // 找到玩家token堆元素（当前玩家区）
  playerTokenPile(color){
    const playerArea = S && S.ai.on ? $("#player") : (S ? (S.current===0 ? $("#player") : $("#opponent")) : null);
    if(!playerArea) return null;
    const piles = playerArea.querySelectorAll(".token-pile");
    for(const p of piles){
      if(p.dataset.tk === color) return p;
    }
    return piles[0] || null;
  },
  // 格子腾空涟漪（宝石被取走时）
  cellVacate(r, c){
    const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    if(!cell) return;
    const rect = cell.getBoundingClientRect();
    const ring = document.createElement("div");
    ring.className = "fx-cell-vacate";
    ring.style.left = (rect.left + rect.width/2 - rect.width/2) + "px";
    ring.style.top = (rect.top + rect.height/2 - rect.height/2) + "px";
    ring.style.width = rect.width + "px";
    ring.style.height = rect.height + "px";
    document.body.appendChild(ring);
    setTimeout(()=> ring.remove(), 500);
  },
  // 触发玩家token pile的弹跳（render后调用，可指定playerArea避免回合切换后定位错误）
  pilePop(color, playerArea){
    const area = playerArea || FX.playerTokenPile(color)?.closest(".player-area");
    if(!area) return;
    const pile = area.querySelector(`.token-pile[data-tk="${color}"]`);
    if(!pile) return;
    pile.classList.remove("pop");
    void pile.offsetWidth; // 强制reflow以重启动画
    pile.classList.add("pop");
    setTimeout(()=> pile.classList.remove("pop"), 500);
  },
  // 卷轴从补给池飞到玩家区
  flyPrivilege(fromEl, toEl){
    if(!fromEl || !toEl) return;
    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    const fly = document.createElement("div");
    fly.className = "fx-fly-privilege";
    fly.style.left = (fr.left + fr.width/2) + "px";
    fly.style.top = (fr.top + fr.height/2) + "px";
    const dx = (tr.left + tr.width/2) - (fr.left + fr.width/2);
    const dy = (tr.top + tr.height/2) - (fr.top + fr.height/2);
    fly.style.setProperty("--dx", dx + "px");
    fly.style.setProperty("--dy", dy + "px");
    document.body.appendChild(fly);
    setTimeout(()=> fly.remove(), 700);
  },
  // 玩家区数值变化高亮（render后调用）
  statBump(playerArea, label){
    if(!playerArea) return;
    const stats = playerArea.querySelectorAll(".p-stat");
    for(const s of stats){
      if(s.textContent.includes(label)){
        const b = s.querySelector("b");
        if(b){ b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); setTimeout(()=>b.classList.remove("bump"),500); }
        break;
      }
    }
  }
};

/* ============================================================
   渲染
   ============================================================ */
const $ = sel => document.querySelector(sel);
function render(){
  if(!S) return;
  renderBoard(); renderPyramid(); renderRoyal(); renderSupplies(); renderPlayers(); renderActions(); renderLog();
}
function tokenEl(t, extra){
  const d=document.createElement("div"); d.className="token "+t+(extra?" "+extra:""); return d;
}
function renderBoard(){
  const b=$("#board"); b.innerHTML="";
  for(let r=0;r<5;r++) for(let c=0;c<5;c++){
    const cell=document.createElement("div"); cell.className="cell";
    cell.dataset.r=r; cell.dataset.c=c;
    const t=S.board[r][c];
    if(t){ cell.appendChild(tokenEl(t)); cell.classList.add("has"); }
    if(S.ui.selected.some(s=>s[0]===r&&s[1]===c)) cell.classList.add("selected");
    if(boardClickable()){ cell.classList.add("selectable"); }
    b.appendChild(cell);
  }
}
function onCellClick(r,c){
  if(!S||S.winner||isAITurn()||S.ui.discard) return;
  if(S.ui.mode==="take"){
    const t=cellAt(r,c);
    if(!isSelectableToken(t)) return;
    const i=S.ui.selected.findIndex(s=>s[0]===r&&s[1]===c);
    if(i>=0) S.ui.selected.splice(i,1);
    else if(S.ui.selected.length<3){
      const trial=[...S.ui.selected,[r,c]];
      if(isValidSelection(trial)) S.ui.selected=trial;
      else S.ui.selected=[[r,c]];
    }
    render();
  } else if(S.ui.mode==="privilege"){ doPrivilegeTake(r,c); }
  else if(S.ui.mode==="pluck-board"){
    const col=cardColor(S.ui.pluckCard);
    if(cellAt(r,c)===col){
      const actingArea = actingPlayerArea();
      const cellEl = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
      const targetEl = FX.playerTokenPile(col);
      FX.tokenBurst(r, c, col);
      FX.cellVacate(r, c);
      if(cellEl && targetEl) FX.flyToken(cellEl, targetEl, col);
      const takenCol = col;
      S.board[r][c]=null; cur().tokens[col]++;
      log(cur().name+" 取同色：拿 "+COLOR_NAME[col],"sys");
      S.ui.pluckCard=null; endTurn();
      requestAnimationFrame(()=> FX.pilePop(takenCol, actingArea));
    }
    else $("#message").textContent="需选择 "+COLOR_NAME[col];
  }
}
function boardClickable(){
  if(isAITurn()||S.winner||S.ui.discard) return false;
  return S.ui.mode==="take"||S.ui.mode==="privilege"||S.ui.mode==="pluck-board";
}
function renderPyramid(){
  for(const lvl of [1,2,3]){
    const row=$("#row"+lvl); row.innerHTML="";
    S.pyramid[lvl].forEach((c,i)=> row.appendChild(cardSlotEl(c,lvl,i)) );
    const deck=document.createElement("div"); deck.className="card-slot deck-slot lvl"+lvl;
    if(S.decks[lvl].length>0){
      const back=document.createElement("div"); back.className="deck-back";
      back.innerHTML='<div class="deck-level">'+lvl+'</div><div class="deck-count">×'+S.decks[lvl].length+'</div>';
      deck.appendChild(back); deck.dataset.deck=lvl;
      // 仅初始发牌时应用交错延迟，后续重渲染禁用动画避免闪烁
      if(_initialDealDone){
        deck.style.animation = "none";
      } else {
        deck.style.animationDelay = ((lvl-1)*0.08 + 0.18) + "s";
      }
      if(pyramidClickable() && S.ui.mode==="reserve") deck.classList.add("selectable");
    } else deck.classList.add("empty");
    row.appendChild(deck);
  }
  _initialDealDone = true;
}
function onDeckClick(lvl){
  if(!S||S.winner||isAITurn()||S.ui.discard) return;
  if(S.ui.mode==="reserve") doReserve({kind:"deck", level:lvl});
}
function cardSlotEl(c,lvl,i){
  const slot=document.createElement("div"); slot.className="card-slot";
  slot.dataset.lvl=lvl; slot.dataset.idx=i;
  const isNew = c && !_dealtCards.has(c.id);
  if(c) _dealtCards.add(c.id);
  if(isNew){ slot.style.animationDelay = ((lvl-1)*0.08 + i*0.04) + "s"; }
  else { slot.style.animation = "none"; }
  if(!c){ slot.classList.add("empty"); return slot; }
  slot.dataset.cid=c.id;
  slot.classList.add("lvl"+lvl);
  if(pyramidClickable()){
    if(S.ui.mode==="purchase" && canAfford(cur(),c)) slot.classList.add("affordable");
    slot.classList.add("selectable");
  }
  if(S.ui.purchaseTarget && S.ui.purchaseTarget.id===c.id) slot.classList.add("selected");

  const bColor = c.bonus.color==="wild" ? "pearl" : c.bonus.color;
  slot.style.setProperty("--card-color", COLOR_HEX[bColor]);

  // 1. 顶部色带：points + crowns + 中央小宝石
  const head=document.createElement("div"); head.className="card-head";
  head.style.background = `linear-gradient(180deg, ${COLOR_HEX[bColor]}, ${shadeColor(COLOR_HEX[bColor], -28)})`;
  if(c.points){
    const p=document.createElement("div"); p.className="card-points"; p.textContent=c.points;
    head.appendChild(p);
  }
  if(c.crowns){
    const k=document.createElement("div"); k.className="card-crowns";
    for(let ci=0;ci<c.crowns;ci++){ const cr=document.createElement("span"); cr.textContent="👑"; k.appendChild(cr); }
    head.appendChild(k);
  }
  // 色带中央小宝石标记
  const centerGem=document.createElement("div"); centerGem.className="card-bonus-gems";
  const hg=document.createElement("div"); hg.className="card-gem-icon "+bColor;
  centerGem.appendChild(hg); head.appendChild(centerGem);
  slot.appendChild(head);

  // 2. 中央艺术区：大型立体刻面宝石 + ×2徽章（如需要）
  const art=document.createElement("div"); art.className="card-art";
  const bonusCount = c.bonus.count || 1;
  // 双宝石堆叠（×2时，底层放一个略偏移的小号宝石）
  for(let gi=bonusCount; gi>=1; gi--){
    const gemWrap=document.createElement("div");
    gemWrap.className="big-gem "+bColor+" gem-"+gi;
    const gemInner=document.createElement("div");
    gemInner.className="big-gem-inner";
    gemWrap.appendChild(gemInner);
    // 若 bonus.count>1 且只放一个宝石，额外加 x2 徽章在 art 右下角
    art.appendChild(gemWrap);
  }
  if(bonusCount>1){
    const x2=document.createElement("div"); x2.className="x2-badge"; x2.textContent="×"+bonusCount;
    art.appendChild(x2);
  }
  slot.appendChild(art);

  // 3. 能力丝带横幅
  if(c.ability){
    const ab=document.createElement("div"); ab.className="card-ability-banner";
    ab.innerHTML='<span class="abil-icon">'+ABIL_ICON[c.ability]+'</span><span class="abil-text">'+ABIL_NAME[c.ability]+'</span>';
    slot.appendChild(ab);
  }

  // 4. 底部费用栏
  const cost=document.createElement("div"); cost.className="card-cost";
  for(const k in c.cost){
    for(let j=0;j<c.cost[k];j++){
      const ct=document.createElement("div"); ct.className="cost-gem "+k;
      cost.appendChild(ct);
    }
  }
  slot.appendChild(cost);
  return slot;
}
function shadeColor(hex, percent){
  const f=parseInt(hex.slice(1),16), t=percent<0?0:255, p=percent<0?percent*-1:percent,
    R=f>>16, G=f>>8&0x00FF, B=f&0x0000FF;
  return "#"+(0x1000000+(Math.round((t-R)*p/100)+R)*0x10000+(Math.round((t-G)*p/100)+G)*0x100+(Math.round((t-B)*p/100)+B)).toString(16).slice(1);
}
function onCardSlotClick(c){
  if(!S||S.winner||isAITurn()||S.ui.discard) return;
  if(S.ui.mode==="reserve") doReserve({kind:"pyramid", level:c.level, idx:S.pyramid[c.level].findIndex(x=>x&&x.id===c.id)});
  else if(S.ui.mode==="purchase"){
    if(canAfford(cur(),c)){ S.ui.purchaseTarget={...c,_from:"pyramid"}; render(); }
    else $("#message").textContent="无法支付该卡";
  }
}
function pyramidClickable(){ return !isAITurn() && !S.winner && !S.ui.discard && (S.ui.mode==="purchase"||S.ui.mode==="reserve"); }
function renderRoyal(){
  const row=$("#royalRow"); row.innerHTML="";
  S.royal.forEach((r,i)=>{
    row.appendChild(royalCardEl(r,i));
  });
}
// 王室卡渲染：紫色贵宾卡 + 中央王冠图腾
function royalCardEl(r, idx){
  const slot=document.createElement("div");
  slot.className="card-slot royal-card"+(r.taken?" taken":"");
  slot.dataset.royal=idx;
  if(_initialDealDone){ slot.style.animation = "none"; }
  else { slot.style.animationDelay = (0.26 + idx*0.05) + "s"; }
  slot.style.setProperty("--card-color", "#b48ae0");

  // 顶部色带（紫金色）：points + crowns + 王冠徽记
  const head=document.createElement("div"); head.className="card-head royal-head";
  if(r.points){
    const p=document.createElement("div"); p.className="card-points"; p.textContent=r.points;
    head.appendChild(p);
  }
  if(r.crowns){
    const k=document.createElement("div"); k.className="card-crowns";
    for(let ci=0;ci<r.crowns;ci++){ const cr=document.createElement("span"); cr.textContent="👑"; k.appendChild(cr); }
    head.appendChild(k);
  }
  const crest=document.createElement("div"); crest.className="card-bonus-gems royal-gem";
  crest.innerHTML='<div class="royal-crest">♛</div>';
  head.appendChild(crest);
  slot.appendChild(head);

  // 中央艺术区：王冠图腾 + 菱形底纹
  const art=document.createElement("div"); art.className="card-art royal-art";
  // 中央大型金色王冠图腾（纯CSS雕刻）
  const medallion=document.createElement("div");
  medallion.style.cssText="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:72px;height:72px;";
  medallion.innerHTML=`
    <div style="position:absolute;inset:0;border-radius:50%;
      background:
        radial-gradient(circle at 50% 35%, rgba(255,250,210,.95), rgba(255,210,100,.6) 35%, rgba(200,140,40,.95) 65%, rgba(130,80,10,.98) 100%);
      box-shadow:
        inset 0 0 0 2px rgba(80,50,5,.85),
        inset 0 0 0 5px rgba(255,220,120,.85),
        inset 0 0 0 7px rgba(80,50,5,.7),
        inset 0 4px 10px rgba(255,255,255,.5),
        inset 0 -6px 14px rgba(0,0,0,.3),
        0 4px 10px rgba(0,0,0,.55),
        0 0 16px rgba(255,200,80,.35);">
    </div>
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-54%);font-size:34px;line-height:1;color:#fff3c7;
      text-shadow:0 0 4px rgba(255,180,60,.8),0 2px 0 #5a3a0a,0 3px 6px rgba(0,0,0,.55);z-index:2;">♛</div>
    <div style="position:absolute;inset:0;border-radius:50%;pointer-events:none;z-index:3;
      background:radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.45), transparent 40%);"></div>`;
  art.appendChild(medallion);
  slot.appendChild(art);

  // 能力丝带横幅（显示王室名+特权）
  const ab=document.createElement("div"); ab.className="card-ability-banner royal-banner";
  ab.innerHTML='<span class="abil-icon">♔</span><span class="abil-text">'+r.name+(r.effect==="privilege"?" · +卷轴":"")+'</span>';
  slot.appendChild(ab);

  // 底部：说明tag
  const foot=document.createElement("div"); foot.className="card-cost royal-cost";
  foot.innerHTML='<span class="royal-tag">'+(r.effect==="privilege"?"特权卡 · +1卷轴 · 领取即送":"王室荣耀卡")+'</span>';
  slot.appendChild(foot);
  return slot;
}
function renderSupplies(){
  const pp=$("#privilegePool"); if(!pp) return;
  pp.innerHTML="";
  for(let i=0;i<S.privilegesPool;i++){ const s=document.createElement("div"); s.className="token gold mini"; pp.appendChild(s); }
  const sp1=$("#supplyPrivilege .supply-label");
  if(sp1) sp1.textContent="卷轴池 "+S.privilegesPool;
  let bc=0; for(const t of TOKENS) bc+=(S.bag[t]||0);
  const sp2=$("#supplyBag .supply-label");
  if(sp2) sp2.textContent="布袋 ("+bc+")";
}
function renderPlayers(){
  if(S.ai.on){
    // 人机模式：人类始终在底部，AI始终在顶部
    renderPlayerArea($("#opponent"), S.players[S.ai.idx], S.ai.idx);
    renderPlayerArea($("#player"), S.players[1-S.ai.idx], 1-S.ai.idx);
  } else {
    // 热座模式：当前玩家在底部
    renderPlayerArea($("#opponent"), opp(), 1-S.current);
    renderPlayerArea($("#player"), cur(), S.current);
  }
}
function renderPlayerArea(host,p,idx){
  const active = idx===S.current && !S.winner;
  host.classList.toggle("active", active);
  const cp=colorPrestigeOf(p), cr=crownsOf(p), pr=prestigeOf(p);
  const maxColor=Math.max(0,...GEMS.map(g=>cp[g]));
  const b=bonusesOf(p);
  host.innerHTML="";
  const info=document.createElement("div"); info.className="p-info";
  info.innerHTML=
    '<div class="p-name">'+p.name+(active&&isAITurn()?' <span class="priv-badge">AI思考中</span>':'')+'</div>'+
    '<div class="p-stats">'+
      '<div class="p-stat"><span>声望</span><b>'+pr+' / 20</b></div>'+
      '<div class="p-stat"><span>皇冠</span><b>'+cr+' / 10</b></div>'+
      '<div class="p-stat"><span>卷轴</span><b>'+p.privileges+'</b></div>'+
      '<div class="p-stat"><span>预留</span><b>'+p.reserved.length+' / 3</b></div>'+
      '<div class="p-stat"><span>手持</span><b>'+tokenTotal(p)+' / 10</b></div>'+
    '</div>'+
    '<div class="win-prog">'+progBar("声望",pr,20)+progBar("同色最高",maxColor,10)+progBar("皇冠",cr,10)+'</div>'+
    '<div class="p-stats" style="margin-top:4px">'+GEMS.map(g=>'<span style="margin-right:6px">'+colorDot(g)+'×'+b[g]+'</span>').join("")+'</div>';
  host.appendChild(info);

  // 手持宝石区
  const mid=document.createElement("div"); mid.className="p-tokens";
  const tkLabel=document.createElement("div"); tkLabel.className="p-section-label"; tkLabel.textContent="手持宝石";
  mid.appendChild(tkLabel);
  const tkWrap=document.createElement("div"); tkWrap.style.display="flex"; tkWrap.style.flexWrap="wrap"; tkWrap.style.gap="6px";
  TOKENS.forEach(t=>{
    if(p.tokens[t]>0){
      const pile=document.createElement("div"); pile.className="token-pile"; pile.dataset.tk=t;
      const st=document.createElement("div"); st.className="stack";
      const n=Math.min(p.tokens[t],3);
      for(let i=0;i<n;i++){ const e=tokenEl(t,"mini"); e.style.position="absolute"; e.style.top=(-i*3)+"px"; e.style.left=(3+i*1)+"px"; st.appendChild(e); }
      pile.appendChild(st);
      const lb=document.createElement("div"); lb.innerHTML=colorDot(t)+"×"+p.tokens[t]; pile.appendChild(lb);
      if(idx===S.current && S.ui.discard) pile.classList.add("selectable");
      tkWrap.appendChild(pile);
    }
  });
  mid.appendChild(tkWrap);
  host.appendChild(mid);

  // 持有卡牌区
  const cardBox=document.createElement("div"); cardBox.className="p-cards";
  const cbLabel=document.createElement("div"); cbLabel.className="p-section-label"; cbLabel.textContent="持有卡牌";
  cardBox.appendChild(cbLabel);
  const groups={}; p.purchased.forEach(c=>{ const col=cardColor(c)||"none"; (groups[col]=groups[col]||[]).push(c); });
  for(const col of [...GEMS,"none"]){
    if(!groups[col]) continue;
    const line=document.createElement("div"); line.className="card-line";
    groups[col].forEach(c=>{
      line.appendChild(miniCardEl(c,col));
    });
    cardBox.appendChild(line);
  }
  if(p.royal.length){
    const line=document.createElement("div"); line.className="card-line";
    p.royal.forEach((r,i)=>{
      const m=document.createElement("div"); m.className="mini-card royal-mini";
      // 王室小卡：紫金配色 + 王冠徽章
      let html = '<div class="mc-head mc-royal-head" style="background:linear-gradient(180deg,#7247b8,#3f1f70)">';
      if(r.points) html+='<span class="mc-pts mc-royal-pts">'+r.points+'</span>';
      if(r.crowns) html+='<span class="mc-cr">👑'+r.crowns+'</span>';
      html+='</div>';
      html+='<div class="mc-gem mc-royal-gem"><div class="mc-royal-medal">' +
        '<div class="mc-royal-bg"></div><span class="mc-royal-icon">♛</span>' +
        '</div></div>';
      html+='<div class="mc-foot mc-royal-foot"><span class="mc-royal-name">'+r.name.substr(0,6)+'</span></div>';
      // tooltip
      const tipParts=['<div class="tip-cost">王室卡：'+r.name+'</div>'];
      if(r.points) tipParts.push('<div>声望 +'+r.points+'</div>');
      if(r.crowns) tipParts.push('<div>皇冠 +'+r.crowns+'</div>');
      if(r.effect==="privilege") tipParts.push('<div class="tip-abil">特权：+1卷轴</div>');
      html+='<div class="mc-tip">'+tipParts.join('')+'</div>';
      m.innerHTML=html;
      line.appendChild(m);
    });
    cardBox.appendChild(line);
  }
  host.appendChild(cardBox);

  // 预留卡牌区
  const right=document.createElement("div"); right.className="p-cards";
  const rsLabel=document.createElement("div"); rsLabel.className="p-section-label"; rsLabel.textContent="预留卡牌";
  right.appendChild(rsLabel);
  const showFace = S.ai.on ? (idx!==S.ai.idx) : (idx===S.current);
  if(p.reserved.length===0){ right.innerHTML+='<div class="hint">无预留</div>'; }
  else {
    const rsLine=document.createElement("div"); rsLine.className="card-line";
    p.reserved.forEach(c=>{
      const m=miniCardEl(c, cardColor(c)||"none", true);
      if(!showFace){ m.innerHTML='<div class="mc-band mc-back"></div><div class="mc-body"><div class="mc-points">?</div></div>'; m.classList.remove("reserved-card"); }
      else {
        m.classList.add("reserved-card");
        m.dataset.rid=c.id;
        if(idx===S.current && S.ui.mode==="purchase" && canAfford(cur(),c)) m.classList.add("affordable");
      }
      rsLine.appendChild(m);
    });
    right.appendChild(rsLine);
  }
  host.appendChild(right);
}
function progBar(label,v,max){ const pct=Math.min(100,v/max*100); return '<div class="prog">'+label+' '+v+'/'+max+'<div class="bar"><i style="width:'+pct+'%"></i></div></div>'; }
function colorDot(t){ return '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+COLOR_HEX[t]+';vertical-align:middle;box-shadow:inset 0 -2px 3px rgba(0,0,0,.4)"></span>'; }
function miniCardEl(c, col, isReserved){
  const m=document.createElement("div"); m.className="mini-card" + (isReserved?" reserved":'');
  const hex = col!=="none" ? COLOR_HEX[col] : "#999";
  m.style.setProperty("--mc", hex);

  // 结构：外框(羊皮纸+金边框) → 顶部色带(1/3) → 中央大宝石刻面 → 底部费用(1/4)
  let html = '';
  // 色带
  html += '<div class="mc-head" style="background:linear-gradient(180deg,'+hex+','+shadeColor(hex,-30)+')">';
  if(c.points) html+='<span class="mc-pts">'+c.points+'</span>';
  if(c.crowns) html+='<span class="mc-cr">👑'+c.crowns+'</span>';
  html+='</div>';
  // 中央大宝石刻面
  html += '<div class="mc-gem"><div class="mc-gem-inner '+col+'"></div>';
  if(c.bonus.count>1) html+='<span class="mc-x2">×'+c.bonus.count+'</span>';
  if(c.ability) html+='<span class="mc-abi">'+ABIL_ICON[c.ability]+'</span>';
  html += '</div>';
  // 底部费用小宝石条
  html += '<div class="mc-foot">';
  const costGems = [];
  for(const k in c.cost){ for(let j=0;j<c.cost[k];j++) costGems.push('<span class="mc-cg '+k+'"></span>'); }
  // 费用太多时只取前6个
  html += costGems.slice(0,6).join('');
  html += '</div>';

  // hover 详情提示（仍然保留，方便查看完整信息）
  const tipParts=[];
  const costArr=[]; for(const k in c.cost){ if(c.cost[k]>0) costArr.push(c.cost[k]+COLOR_NAME[k]); }
  if(costArr.length) tipParts.push('<div class="tip-cost">费用：'+costArr.join(' / ')+'</div>');
  if(c.bonus && c.bonus.count) tipParts.push('<div>奖励：'+(c.bonus.count>1?'双':'')+COLOR_NAME[c.bonus.color==="wild"?"white":c.bonus.color]+'</div>');
  if(c.ability) tipParts.push('<div class="tip-abil">能力：'+ABIL_NAME[c.ability]+'</div>');
  if(isReserved) tipParts.push('<div class="tip-abil" style="color:#f5d77a">预留卡（点击可购买）</div>');
  if(tipParts.length) html+='<div class="mc-tip">'+tipParts.join('')+'</div>';

  m.innerHTML=html;
  return m;
}

function renderActions(){
  const box=$("#actions"); box.innerHTML="";
  const msg=$("#message");
  if(S.winner){ msg.innerHTML="<b>"+S.players[S.winner.idx].name+" 胜利</b> — "+S.winner.reason; return; }
  if(isAITurn()){
    msg.innerHTML='<span class="ai-thinking"><span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>'+cur().name+' 思考中</span>';
    return;
  }
  const p=cur();

  if(S.ui.discard){
    msg.innerHTML="手持token超过10，请点击下方自己的token堆弃置（当前 "+tokenTotal(p)+" / 10）";
    const done=btn("完成弃牌", ()=>{ if(tokenTotal(cur())<=10){ S.ui.discard=false; finalizeTurn(); } else { $("#message").textContent="仍超过10，请继续弃置"; } });
    box.appendChild(done);
    return;
  }

  let m="";
  switch(S.ui.mode){
    case "take": m="选择1-3个相邻且成直线的宝石/珍珠（金子与空格会阻断）。已选 "+S.ui.selected.length; break;
    case "reserve": m="选择一张金字塔卡或牌堆顶预留（自动获得1黄金）"; break;
    case "purchase": m=S.ui.purchaseTarget?"确认购买这张卡？":"选择一张可购买的金字塔卡（绿框）或你的预留卡"; break;
    case "privilege": m="点击棋盘上的宝石/珍珠拿取（剩余卷轴 "+p.privileges+"）"; break;
    case "pluck-board": m="取同色效果：点击棋盘上的 "+COLOR_NAME[cardColor(S.ui.pluckCard)]+" 拿取，或选择偷取对手"; break;
    default: m=p.name+" 的回合 — 可先使用卷轴/补充棋盘，再执行一项强制行动";
  }
  msg.innerHTML=m;

  if(!S.ui.mode){
    if(p.privileges>0 && !S.turn.replenished) box.appendChild(btn("使用卷轴", ()=>{S.ui.mode="privilege"; render();}));
    if(bagHasTokens() && !S.turn.replenished) box.appendChild(btn("补充棋盘", doReplenish));
  }
  if(S.ui.mode==="take"){
    const takeBtn=btn("拿取 "+S.ui.selected.length, ()=>{ if(isValidSelection(S.ui.selected)) doTakeTokens(S.ui.selected.slice()); else $("#message").textContent="选择无效"; });
    if(S.ui.selected.length<1) takeBtn.disabled=true;
    box.appendChild(takeBtn);
    box.appendChild(btn("取消", ()=>{S.ui.selected=[];S.ui.mode=null;render();}));
  } else if(S.ui.mode==="privilege"){
    box.appendChild(btn("停止使用", ()=>{S.ui.mode=null;render();}));
  } else if(S.ui.mode==="reserve"){
    box.appendChild(btn("取消", ()=>{S.ui.mode=null;render();}));
  } else if(S.ui.mode==="purchase"){
    if(S.ui.purchaseTarget){
      const plan=planPayment(p,S.ui.purchaseTarget);
      box.appendChild(btn("确认购买 ("+payStr(plan)+")", ()=>doPurchase({...S.ui.purchaseTarget})));
    }
    box.appendChild(btn("取消", ()=>{S.ui.purchaseTarget=null;S.ui.mode=null;render();}));
  } else if(S.ui.mode==="pluck-board"){
    box.appendChild(btn("改为偷取对手", doPluckSteal));
  } else if(!S.ui.mode){
    box.appendChild(btn("拿取宝石", ()=>{S.ui.mode="take";S.ui.selected=[];render();}));
    if(p.reserved.length<3){
      const resBtn = btn(hasGoldOnBoard()?"预留卡牌（含黄金）":"预留卡牌（无黄金）", ()=>{S.ui.mode="reserve";render();});
      if(!hasGoldOnBoard()) resBtn.title="棋盘当前无黄金，预留仅拿卡牌不送黄金";
      box.appendChild(resBtn);
    }
    box.appendChild(btn("购买卡牌", ()=>{S.ui.mode="purchase";render();}));
  }
}
function btn(label,fn){ const b=document.createElement("button"); b.className="btn sm"; b.textContent=label; b.onclick=fn; return b; }

function renderLog(){
  const el=$("#log"); el.innerHTML="";
  S.log.slice(-80).forEach(l=>{ const d=document.createElement("div"); d.className="l "+(l.c||""); d.textContent=l.t; el.appendChild(d); });
  el.scrollTop=el.scrollHeight;
}
function log(t,c){ S.log.push({t,c}); }

/* ============================================================
   交互 — 全局点击委托
   ============================================================ */
function wire(){
  $("#btnNew").onclick=promptNewGame;
  $("#btnHelp").onclick=showHelp;
  // 移动端日志抽屉切换
  const btnLog=$("#btnLog");
  if(btnLog){
    btnLog.onclick=()=>{
      const lp=$("#logPanel");
      if(lp){ lp.classList.toggle("open"); }
    };
  }
  document.addEventListener("click", onGlobalClick);
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&S&&S.ui&&!S.winner){ S.ui.mode=null;S.ui.selected=[];S.ui.purchaseTarget=null;render(); } });
}
function onGlobalClick(e){
  if(!S||S.winner||isAITurn()) return;
  // 棋盘格点击
  const cell=e.target.closest("#board .cell");
  if(cell && cell.dataset.r!==undefined){
    onCellClick(+cell.dataset.r, +cell.dataset.c);
    return;
  }
  // 金字塔卡牌/牌堆点击
  const slot=e.target.closest("#pyramidWrap .card-slot");
  if(slot){
    if(slot.dataset.deck){ onDeckClick(+slot.dataset.deck); return; }
    if(slot.dataset.cid){ const c=findCardById(+slot.dataset.cid); if(c) onCardSlotClick(c); return; }
  }
  // 玩家区 token 弃置
  if(S.ui.discard){
    const pile=e.target.closest("#player .token-pile");
    if(pile && pile.dataset.tk){ onDiscardClick(pile.dataset.tk); return; }
  }
  // 预留卡购买
  const rc=e.target.closest("#player .reserved-card");
  if(rc && rc.dataset.rid && S.ui.mode==="purchase"){
    const c=cur().reserved.find(x=>x.id===+rc.dataset.rid);
    if(c) onReservedCardClick(c);
    return;
  }
}
function onDiscardClick(t){
  if(!S||S.winner||isAITurn()||!S.ui.discard) return;
  const p=cur();
  if((p.tokens[t]||0)>0){ p.tokens[t]--; S.bag[t]=(S.bag[t]||0)+1; log(p.name+" 弃1"+COLOR_NAME[t],"sys"); render(); }
}
function onReservedCardClick(c){
  if(!S||S.winner||isAITurn()||S.ui.discard) return;
  if(S.ui.mode==="purchase" && canAfford(cur(),c)){ S.ui.purchaseTarget={...c,_from:"reserved"}; render(); }
}
function findCardById(id){
  for(const lvl of [1,2,3]) for(const c of S.pyramid[lvl]) if(c&&c.id===id) return c;
  for(const p of S.players) for(const c of p.reserved) if(c.id===id) return c;
  return null;
}

/* ============================================================
   模态
   ============================================================ */
function showModal(html){ $("#modalCard").innerHTML=html; $("#modal").classList.remove("hidden"); }
function hideModal(){ $("#modal").classList.add("hidden"); }
function promptNewGame(){
  showModal('<h2>新对局</h2><p>选择对战模式：</p><div class="opts">'+
    '<button class="btn" data-mode="hotseat">本地热座双人</button>'+
    '<button class="btn" data-mode="ai" data-diff="easy">人机 · 简单</button>'+
    '<button class="btn" data-mode="ai" data-diff="normal">人机 · 普通</button>'+
    '<button class="btn" data-mode="ai" data-diff="hard">人机 · 困难</button>'+
    '</div><button class="btn ghost" style="margin-top:14px;width:100%" id="cancelNew">取消</button>');
  $("#modalCard").querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{ hideModal(); newGame(b.dataset.mode, b.dataset.diff); });
  $("#cancelNew").onclick=hideModal;
}
function promptAssociate(colors){
  showModal('<h2>附同色</h2><p>该卡为百搭奖励，选择附着到哪种已有奖励颜色：</p><div class="choice-row">'+
    colors.map(g=>'<button class="btn" data-c="'+g+'">'+colorDot(g)+" "+COLOR_NAME[g]+'</button>').join("")+'</div>');
  $("#modalCard").querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{ hideModal(); attachAssociate(S.ui.associateCard,b.dataset.c); });
}
function promptPluck(card){
  const col=cardColor(card);
  const onBoard = S.board.flat().some(t=>t===col);
  const oppHas = (opp().tokens[col]||0)>0;
  showModal('<h2>取同色效果</h2><p>卡牌颜色：'+COLOR_NAME[col]+'。选择：</p><div class="choice-row">'+
    (onBoard?'<button class="btn" data-a="board">从棋盘拿1个'+COLOR_NAME[col]+'</button>':'<button class="btn" disabled>棋盘无'+COLOR_NAME[col]+'</button>')+
    (oppHas?'<button class="btn" data-a="steal">偷取对手1个'+COLOR_NAME[col]+'</button>':'<button class="btn" disabled>对手无'+COLOR_NAME[col]+'</button>')+
    '<button class="btn ghost" data-a="skip">忽略</button></div>');
  $("#modalCard").querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{
    hideModal(); const a=b.dataset.a;
    if(a==="board"){ S.ui.mode="pluck-board"; render(); }
    else if(a==="steal"){ doPluckSteal(); }
    else { S.ui.pluckCard=null; endTurn(); }
  });
}
function doPluckSteal(){
  const card=S.ui.pluckCard; if(!card){ endTurn(); return; }
  const col=cardColor(card);
  const actingArea = actingPlayerArea();
  const oppIdx = 1-S.current;
  const oppArea = actingPlayerArea(oppIdx);
  if((opp().tokens[col]||0)>0){
    // 偷取飞行动画：从对手的token pile飞到当前玩家区
    const oppPile = oppArea ? oppArea.querySelector(`.token-pile[data-tk="${col}"]`) : null;
    const fromEl = oppPile || oppArea;
    if(fromEl && actingArea) FX.flyToken(fromEl, actingArea, col);
    opp().tokens[col]--; cur().tokens[col]++;
    log(cur().name+" 取同色：偷1"+COLOR_NAME[col],"sys");
  }
  S.ui.pluckCard=null; hideModal(); endTurn();
  requestAnimationFrame(()=>{
    if(actingArea) FX.pilePop(col, actingArea);
  });
}
function promptRoyalChoice(avail, cb){
  showModal('<h2>王室恩典</h2><p>你达成皇冠阈值，选择一张王室卡：</p><div class="choice-row">'+
    avail.map(r=>'<button class="btn" data-r="'+r.id+'">'+r.name+' · '+r.points+'分'+(r.crowns?'/👑'+r.crowns:'')+(r.effect==="privilege"?"/+卷轴":"")+'</button>').join("")+'</div>');
  $("#modalCard").querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{ hideModal(); const r=S.royal.find(x=>x.id===b.dataset.r); cb(r); });
}
function showWin(){
  const w=S.winner, p=S.players[w.idx];
  showModal('<div class="win-icons">👑</div><h2>'+p.name+' 获胜！</h2>'+
    '<p>胜利条件：<b>'+w.reason+'</b></p>'+
    '<p>声望 '+prestigeOf(p)+' ｜ 皇冠 '+crownsOf(p)+' ｜ 同色最高 '+Math.max(0,...GEMS.map(g=>colorPrestigeOf(p)[g]))+'</p>'+
    '<button class="btn primary" style="margin-top:14px;width:100%" id="again">再来一局</button>');
  $("#again").onclick=()=>{ hideModal(); promptNewGame(); };
}
function showHelp(){
  showModal('<h2>规则速览</h2>'+
    '<p><b>目标</b>：率先达成任一条件 — ①声望≥20；②同色卡牌声望≥10；③皇冠≥10。</p>'+
    '<p><b>回合</b>：可选行动（使用卷轴 / 补充棋盘）后，必须执行一项强制行动：</p>'+
    '<p>· <b>拿取宝石</b>：从5×5盘上拿1-3个相邻且成直线的宝石/珍珠（金子与空格会阻断）。3同色或2珍珠 → 对手得1卷轴。</p>'+
    '<p>· <b>预留卡牌</b>：取1黄金 + 预留1张金字塔卡或牌堆顶（最多3张预留）。</p>'+
    '<p>· <b>购买卡牌</b>：支付token买金字塔卡或预留卡；奖励永久减费；黄金为百搭（可代任意宝石/珍珠）。</p>'+
    '<p><b>皇冠</b>：第3、第6个皇冠时各领1张王室卡。<b>卷轴</b>：消耗1张从盘上拿任意宝石/珍珠；补充棋盘 / 3同色 / 2珍珠 会让对手得卷轴。</p>'+
    '<p><b>能力</b>：↻再回合 / ✦附同色（百搭奖励附到已有色） / ✋取同色（从盘上拿或偷对手1个同色）。</p>'+
    '<p><b>手持上限</b>：回合结束弃至10个token。</p>'+
    '<button class="btn primary" style="margin-top:14px;width:100%" id="helpClose">了解</button>');
  $("#helpClose").onclick=hideModal;
}

/* ============================================================
   AI
   ============================================================ */
function allValidLines(){
  const lines=[]; const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(let r=0;r<5;r++)for(let c=0;c<5;c++){
    if(!isSelectableToken(S.board[r][c])) continue;
    lines.push([[r,c]]);
    for(const [dr,dc] of dirs){
      const seg=[[r,c]];
      for(let s=1;s<3;s++){
        const nr=r+dr*s, nc=c+dc*s;
        if(nr<0||nr>=5||nc<0||nc>=5) break;
        if(!isSelectableToken(S.board[nr][nc])) break;
        seg.push([nr,nc]); lines.push(seg.slice());
      }
    }
  }
  return lines;
}
function aiTurn(){
  if(!S||S.winner) return;
  // 异步链式执行，每步间留出动画时间，让玩家看清 AI 的操作过程
  aiTurnAsync();
}
// AI 回合异步流程：思考 → 卷轴(逐个) → 补充 → 主行动
async function aiTurnAsync(){
  if(!S||S.winner) return;
  const p=cur();
  // 1) 思考停顿（让回合横幅先显示）
  await delay(450);
  if(S.winner) return;

  // 2) 逐个使用卷轴，每次间隔让飞行动画完成
  let guard=0;
  while(p.privileges>0 && guard++<6){
    const need=aiNeedMap(p);
    let best=null,bv=-1;
    for(let r=0;r<5;r++)for(let c=0;c<5;c++){ const t=S.board[r][c]; if(!isSelectableToken(t)) continue; const v=need[t]; if(v>bv){bv=v;best=[r,c];} }
    if(!best || bv<=0.15) break;
    doPrivilegeTake(best[0],best[1]);
    await delay(620); // 等待宝石飞行动画 + 卷轴飞行
    if(S.winner) return;
  }

  // 3) 补充棋盘
  if(!S.turn.replenished && bagHasTokens()){
    let cnt=0; for(let r=0;r<5;r++)for(let c=0;c<5;c++) if(isSelectableToken(S.board[r][c])) cnt++;
    if(cnt<=3){
      doReplenish();
      await delay(520); // 等待补货落下动画
      if(S.winner) return;
    }
  }

  // 4) 主行动前短暂停顿，显示"抉择中"
  await delay(280);
  if(S.winner) return;

  const move = aiChooseMandatory(p);
  if(!move){
    if(bagHasTokens() && !S.turn.replenished){ doReplenish(); await delay(520); }
    else { S.turn.replenished=true; finalizeTurn(); }
    return;
  }
  if(move.type==="purchase") doPurchase(move.card);
  else if(move.type==="reserve") doReserve(move.target);
  else if(move.type==="take") doTakeTokens(move.cells);
}
// 异步延迟工具
function delay(ms){ return new Promise(r=> setTimeout(r, ms)); }
function aiNeedMap(p){
  const need={white:0.2,blue:0.2,green:0.2,red:0.2,black:0.2,pearl:0.5,gold:0};
  const targets=[...S.pyramid[1],...S.pyramid[2],...S.pyramid[3],...p.reserved].filter(Boolean);
  for(const c of targets){
    const ec=effectiveCost(p,c);
    const attract=(c.points||0)+(c.crowns||0)*0.8+(c.bonus.count||0)*0.5+0.5;
    for(const k in ec){ if(ec[k]>0) need[k]+= 0.3*attract*(1/(ec[k]+1)); }
  }
  GEMS.forEach(g=>{ if((p.tokens[g]||0)>=4) need[g]*=0.5; });
  return need;
}
function aiChooseMandatory(p){
  let best=null, bestScore=-1e9;
  const candidates=[];
  for(const lvl of [1,2,3]) S.pyramid[lvl].forEach((c,i)=>{ if(c) candidates.push({card:{...c,_from:"pyramid"}, ref:c}); });
  p.reserved.forEach(c=>candidates.push({card:{...c,_from:"reserved"}, ref:c}));
  for(const {card,ref} of candidates){
    if(!planPayment(p,card)) continue;
    let s=scorePurchase(p,ref);
    if(s>bestScore){ bestScore=s; best={type:"purchase",card}; }
  }
  if(p.reserved.length<3){
    for(const lvl of [1,2,3]) S.pyramid[lvl].forEach((c,i)=>{
      if(!c) return;
      let s=scoreReserve(p,c);
      if(!hasGoldOnBoard()) s*=0.4; // 无黄金时空手预留优先级降低
      if(s>bestScore){ bestScore=s; best={type:"reserve",target:{kind:"pyramid",level:lvl,idx:i}}; }
    });
    const deckBase = hasGoldOnBoard() ? 0.2 : 0.05;
    if(deckBase>bestScore){ best={type:"reserve",target:{kind:"deck",level:1}}; bestScore=deckBase; }
  }
  for(const cells of allValidLines()){
    const s=scoreTake(p,cells);
    if(s>bestScore){ bestScore=s; best={type:"take",cells}; }
  }
  return best;
}
function scorePurchase(p,c){
  let s=(c.points||0)*1.3 + (c.crowns||0)*1.0 + (c.bonus.count||0)*0.7;
  const cp=colorPrestigeOf(p);
  const mainColor=GEMS.reduce((a,b)=>cp[a]>=cp[b]?a:b);
  if(c.bonus.color===mainColor) s+=0.6;
  if(c.bonus.color==="wild") s+=0.3;
  const simPrestige=prestigeOf(p)+(c.points||0);
  const simCrown=crownsOf(p)+(c.crowns||0);
  const simCP={...cp}; const col=cardColor(c); if(col) simCP[col]=(simCP[col]||0)+(c.points||0);
  if(simPrestige>=20||simCrown>=10||(col&&simCP[col]>=10)) s+=1000;
  if(c.crowns){ const before=crownsOf(p); if(before<3&&before+c.crowns>=3) s+=1.5; if(before<6&&before+c.crowns>=6) s+=2.0; }
  if(canAfford(opp(),c)) s+=(c.points||0)*0.4+(c.crowns||0)*0.3;
  const ec=effectiveCost(p,c); let costSum=0; for(const k in ec) costSum+=ec[k];
  s -= costSum*0.04;
  return s;
}
function scoreReserve(p,c){
  let s=(c.points||0)*0.4+(c.crowns||0)*0.5;
  if(!canAfford(p,c) && (c.points>=3||c.crowns>=1)) s+=0.8;
  if(canAfford(opp(),c)) s+=(c.points||0)*0.5+(c.crowns||0)*0.4;
  s-=0.5;
  return s;
}
function scoreTake(p,cells){
  const need=aiNeedMap(p);
  const toks=cells.map(([r,c])=>S.board[r][c]);
  let s=0; toks.forEach(t=> s+= need[t]);
  if(toks.length===3 && toks.every(t=>t===toks[0])) s-=0.6;
  if(toks.length===2 && toks.every(t=>t==="pearl")) s-=0.6;
  if(tokenTotal(p)+toks.length>10) s-=1.0*(tokenTotal(p)+toks.length-10);
  if(S.ai.diff==="easy") s+=Math.random()*1.5;
  if(S.ai.diff==="hard") s+=toks.length*0.05; // 困难略偏向多拿
  return s;
}
function aiPickAssociateColor(colors){
  const cp=colorPrestigeOf(cur());
  return colors.reduce((a,b)=>cp[a]>=cp[b]?a:b);
}
function aiPickRoyal(avail){ return avail.reduce((a,b)=> (b.points+b.crowns*2)>(a.points+a.crowns*2)?b:a ); }
function aiPluck(card){
  const col=cardColor(card);
  const onBoard=S.board.flat().some(t=>t===col);
  const oppHas=(opp().tokens[col]||0)>0;
  if(onBoard){
    for(let r=0;r<5;r++)for(let c=0;c<5;c++) if(S.board[r][c]===col){ S.board[r][c]=null; cur().tokens[col]++; log(cur().name+" 取同色：拿 "+COLOR_NAME[col],"sys"); S.ui.pluckCard=null; endTurn(); return; }
  } else if(oppHas){ opp().tokens[col]--; cur().tokens[col]++; log(cur().name+" 取同色：偷 "+COLOR_NAME[col],"sys"); S.ui.pluckCard=null; endTurn(); return; }
  S.ui.pluckCard=null; endTurn();
}
function aiDiscard(p){
  while(tokenTotal(p)>10){
    let best=null,bv=-1;
    for(const t of TOKENS){
      if(t==="gold"||t==="pearl") continue;
      if((p.tokens[t]||0)<=0) continue;
      const v=(p.tokens[t]||0);
      if(v>bv){bv=v;best=t;}
    }
    if(!best){ if((p.tokens.gold||0)>0) best="gold"; else if((p.tokens.pearl||0)>0) best="pearl"; else break; }
    p.tokens[best]--; S.bag[best]=(S.bag[best]||0)+1;
  }
}

/* ============================================================
   启动
   ============================================================ */
function boot(){
  wire();
  // Expose for debugging/testing
  window.__game = { get S(){return S;}, onCellClick, doTakeTokens, doReserve, doPurchase, render, isValidSelection, newGame, isAITurn, cur, opp, canAfford, planPayment, bonusesOf, prestigeOf, crownsOf, checkWin };
  promptNewGame();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
