// ---- WEAPON REGISTRY: stable IDs for save files, bot loadouts and all weapon arrays ----
var WEAPON_PROFILES=[],WEAPON_MODEL_BUILDERS=[],WEAPON_RANGE_MODIFIERS=[];
var WEAPON_STARTER_ID=9;
// CS:GO damage falloff is damage*modifier^(distance/500 CS units).
// For POINT BLOCK, 20 world units are one falloff interval; the two unit systems differ.
var DAMAGE_FALLOFF=Object.freeze({referenceUnits:20,defaultModifiers:Object.freeze({pistol:.91,rifle:.98,smg:.85,dual:.85,shotgun:.70,sniper:.99})});
var WEAPON_CLASS_LABELS=Object.freeze({pistol:"HANDGUN",rifle:"ASSAULT RIFLE",shotgun:"SHOTGUN",rocket:"LAUNCHER",knife:"MELEE",grenade:"THROWABLE",smg:"SUBMACHINE GUN",dual:"SUBMACHINE GUN",sniper:"SNIPER RIFLE"});
