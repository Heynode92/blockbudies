import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const inventory=read('src/game/89-inventory.js'),navigation=read('src/game/85-navigation-routes.js'),
 bridge=read('src/game/98-online-bridge.js');
test('Inventory opens only after SIWE and official registered player, never renders unowned catalog',()=>{
 assert.match(inventory,/if\(!state\?\.authenticated\|\|!state\.registered\)/);
 assert.match(inventory,/homeAuthGateOpen\('inventory'\)/);
 assert.match(inventory,/var ids=inventoryOwned\(inventoryTab\)/);
 assert.match(inventory,/inventoryServerLoaded=false;\s*lobP\("lbiv"\)/);
 assert.match(inventory,/await Promise\.all\(\[PB_ONLINE\.inventory\(\),PB_ONLINE\.loadout\(\)\]\)/);
});
test('All displayed fixed slots are authenticated backend loadout fields',()=>{
 assert.match(inventory,/equipped\.secondary/);
 assert.match(inventory,/equipped\.mele/);
 assert.match(inventory,/equipped\.explosive/);
 assert.match(inventory,/if\(!owned\.has\(main\)\)throw Error/);
 assert.match(inventory,/INVENTORY_SESSION_CHANGED/);
});
test('Shop and leaderboard remain public; Home START requires genuine SIWE popup',()=>{
 assert.match(navigation,/panel!=='lbshop'/);
 assert.match(bridge,/homeAuthGateOpen\('match'\)/);
 assert.match(bridge,/inventoryLoad\(\)/);
 assert.doesNotMatch(navigation,/if\(panel!=='lbs'&&\(!state\?\.authenticated/);
});
