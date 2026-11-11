/* Data is deliberately separate: add buildings and monsters here, then give them a sprite. */
window.ZCD = window.ZCD || {};
(function (Z) {
  'use strict';
  Z.COLS = 15; Z.ROWS = 10; Z.TILE = 60;
  Z.CASTLE = { x: 6, y: 4, w: 3, h: 2, maxHp: 100 };
  Z.BUILDINGS = {
    wood:   { name: 'Wooden wall', short: 'Wood wall', cost: 15, hp: 100, block: true, color: '#bd804b', description: 'A sturdy little barricade. Keeps zombies busy!', detail: '100 health · blocks zombies' },
    stone:  { name: 'Stone wall', short: 'Stone wall', cost: 35, hp: 280, block: true, color: '#9baebb', description: 'Extra tough stone for a very safe kingdom.', detail: '280 health · blocks zombies' },
    archer: { name: 'Archer tower', short: 'Archer tower', cost: 65, hp: 140, block: true, range: 3.5, damage: 17, rate: .72, color: '#c69b65', description: 'Pew! Quick arrows pick off one zombie at a time.', detail: '17 damage · 3.5 tile range' },
    fire:   { name: 'Fire tower', short: 'Fire tower', cost: 110, hp: 130, block: true, range: 3.0, damage: 23, rate: 1.35, splash: .95, color: '#ee8b48', description: 'Toasty fireballs splash a whole group of zombies.', detail: '23 splash damage · 3 tile range' },
    ice:    { name: 'Ice tower', short: 'Ice tower', cost: 90, hp: 130, block: true, range: 3.3, damage: 8, rate: .95, slow: 2.4, color: '#72cde7', description: 'Brrr! Frosty magic slows zombies for your archers.', detail: '8 damage · slows for 2.4 seconds' },
    mine:   { name: 'Gold mine', short: 'Gold mine', cost: 80, hp: 90, block: true, income: 30, color: '#efc44e', description: 'Little miners earn 30 coins after every wave.', detail: '+30 coins after each wave' },
    moat:   { name: 'Water moat', short: 'Water moat', cost: 20, hp: 0, block: false, color: '#63c9db', description: 'Splish splash! Zombies wade at 35% speed.', detail: 'Slows zombies · cannot be broken' },
    bridge: { name: 'Drawbridge', short: 'Drawbridge', cost: 40, hp: 180, block: false, color: '#ad8455', description: 'Lower for a crossing. Raise to block the zombies!', detail: '180 health · raise or lower anytime' }
  };
  Z.MONSTERS = {
    silly: { name: 'Shuffler', hp: 43, speed: .64, damage: 7, reward: 9, color: '#91bb62' },
    speedy: { name: 'Buckethead', hp: 32, speed: 1.05, damage: 6, reward: 11, color: '#b5d06c' },
    big: { name: 'Big Bob', hp: 125, speed: .43, damage: 14, reward: 20, color: '#759b5c' }
  };
  Z.isCastle = (x, y) => x >= 6 && x <= 8 && y >= 4 && y <= 5;
  Z.inside = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < 15 && y >= 0 && y < 10;
})(window.ZCD);
