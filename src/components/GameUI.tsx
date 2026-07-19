import React from 'react';
import { 
  Heart, 
  Shield, 
  Coins, 
  Volume2, 
  VolumeX, 
  Trophy, 
  Skull, 
  ShoppingBag, 
  Play, 
  RefreshCw, 
  Navigation,
  Flame,
  Bomb,
  Target,
  Wrench,
  Sparkles
} from 'lucide-react';
import { WeaponType, WeaponInfo, Player, Car, GameMission, GameState } from '../types';
import { sound } from '../audio';

export const WEAPON_INFOS: Record<WeaponType, WeaponInfo> = {
  fist: {
    type: 'fist',
    name: '주먹 (Fist)',
    damage: 15,
    fireRate: 300,
    ammoCost: 0,
    maxAmmo: 0,
    range: 45,
    color: '#E5C4A7',
    bulletSpeed: 0,
    soundType: 'punch'
  },
  pistol: {
    type: 'pistol',
    name: '피스톨 (Pistol)',
    damage: 25,
    fireRate: 350,
    ammoCost: 1,
    maxAmmo: 250,
    range: 350,
    color: '#FFD700',
    bulletSpeed: 14,
    soundType: 'pistol'
  },
  smg: {
    type: 'smg',
    name: '마이크로 SMG',
    damage: 18,
    fireRate: 100,
    ammoCost: 1,
    maxAmmo: 500,
    range: 400,
    color: '#00FFFF',
    bulletSpeed: 16,
    soundType: 'smg'
  },
  shotgun: {
    type: 'shotgun',
    name: '펌프 액션 샷건',
    damage: 12, // 12 damage per pellet (shoots 6 pellets in a spread)
    fireRate: 850,
    ammoCost: 1,
    maxAmmo: 80,
    range: 220,
    color: '#FFA500',
    bulletSpeed: 12,
    soundType: 'shotgun'
  },
  rocket: {
    type: 'rocket',
    name: 'RPG (로켓 런처)',
    damage: 150,
    fireRate: 1500,
    ammoCost: 1,
    maxAmmo: 10,
    range: 600,
    color: '#FF3333',
    bulletSpeed: 8,
    soundType: 'rocket'
  }
};

interface GameUIProps {
  gameState: GameState;
  setGameState?: React.Dispatch<React.SetStateAction<GameState>>;
  onStartGame: () => void;
  onRestartGame: () => void;
  onBuyWeapon: (weapon: WeaponType, cost: number) => void;
  onBuyArmor: (cost: number) => void;
  onBuyHealth: (cost: number) => void;
  onSprayCar: (cost: number) => void;
  onCloseShop: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onCompleteActiveMission?: () => void;
}

export const GameUI: React.FC<GameUIProps> = ({
  gameState,
  setGameState,
  onStartGame,
  onRestartGame,
  onBuyWeapon,
  onBuyArmor,
  onBuyHealth,
  onSprayCar,
  onCloseShop,
  isMuted,
  onToggleMute,
  onCompleteActiveMission,
}) => {
  const { player, cars, missions, activeMissionId, shopOpen, gameStatus, timeOfDay } = gameState;
  const activeMission = missions.find(m => m.id === activeMissionId);
  
  // Find player's vehicle
  const playerVehicle = player.insideVehicleId 
    ? cars.find(c => c.id === player.insideVehicleId) 
    : null;

  // Convert game timeOfDay (0 - 2400) to HH:MM string
  const formatGameTime = (time: number) => {
    const hours = Math.floor(time / 100);
    const minutes = Math.floor(((time % 100) / 100) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const padMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${padMinutes} ${ampm}`;
  };

  const currentWeaponInfo = WEAPON_INFOS[player.currentWeapon];

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-sans flex flex-col justify-between">
      
      {/* 1. TOP BAR HUD (Health, Armor, Money, Time, Sound) */}
      <div className="w-full flex justify-between items-start p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-auto">
        {/* Left Stats Side */}
        <div className="flex flex-col gap-2">
          {/* Health & Armor Bars */}
          <div className="flex items-center gap-4 bg-[#050505]/85 px-4 py-2.5 rounded-xl border border-white/10 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" />
              <div className="w-24 bg-gray-950 h-2 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-red-500 h-full transition-all duration-150" 
                  style={{ width: `${Math.max(0, (player.health / player.maxHealth) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-gray-300 font-bold ml-1">{Math.ceil(player.health)}</span>
            </div>

            <div className="h-4 w-[1px] bg-white/10" />

            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400 fill-blue-400" />
              <div className="w-24 bg-gray-950 h-2 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-blue-500 h-full transition-all duration-150" 
                  style={{ width: `${(player.armor / player.maxArmor) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-gray-300 font-bold ml-1">{Math.ceil(player.armor)}</span>
            </div>
          </div>

          {/* Money display - styled in large digital green */}
          <div className="flex flex-col items-start px-4 py-2 bg-[#050505]/85 rounded-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.5)] w-fit backdrop-blur-md">
            <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest leading-none mb-1">Available Funds</div>
            <div className="text-3xl font-black text-[#45a049] tracking-tighter drop-shadow-lg font-mono">
              ${player.cash.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Center: Clock and Sirens */}
        <div className="flex flex-col items-center gap-0.5 bg-[#050505]/80 px-4 py-1.5 rounded-full border border-white/5 shadow-lg backdrop-blur-md">
          <span className="text-sm font-mono text-white tracking-widest font-bold">
            {formatGameTime(timeOfDay)}
          </span>
        </div>

        {/* Right Wanted level, Weapons & Volume */}
        <div className="flex flex-col items-end gap-2">
          {/* Sound & Settings Buttons */}
          <div className="flex gap-2 mb-1">
            <button 
              onClick={onToggleMute}
              className="p-2 bg-[#050505]/80 hover:bg-black/95 rounded-lg border border-white/10 text-white transition-all cursor-pointer pointer-events-auto shadow-md backdrop-blur-sm"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#45a049]" />}
            </button>
          </div>

          {/* Wanted Level Stars (1 to 5) */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1 bg-[#050505]/85 px-3 py-2 rounded-xl border border-white/10 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = player.wantedLevel >= star;
                const isFlashing = player.wantedLevel > 0 && Math.floor(Date.now() / 250) % 2 === 0;
                return (
                  <div key={star} className={`w-5 h-5 transition-all duration-150 ${
                    isActive 
                      ? (isFlashing ? 'text-red-500 fill-current scale-110 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-yellow-500 fill-current') 
                      : 'text-gray-800 fill-current opacity-40'
                  }`}>
                    <svg viewBox="0 0 24 24" className="w-full h-full">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                  </div>
                );
              })}
            </div>
            {player.wantedLevel > 0 && (
              <div className="text-[9px] font-mono text-red-500 bg-[#050505]/80 px-2 py-0.5 border border-red-500/30 uppercase tracking-widest rounded shadow-md animate-pulse">
                WANTED LEVEL ACTIVE
              </div>
            )}
          </div>

          {/* Active Weapon Selector View */}
          <div className="flex items-center gap-3 bg-[#050505]/85 p-2.5 rounded-xl border border-white/10 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.5)] mt-1">
            <div className="flex flex-col items-end justify-center">
              <span className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">Weapon</span>
              <span className="text-xs text-white font-black uppercase tracking-tight mt-0.5">{currentWeaponInfo.name}</span>
              {currentWeaponInfo.maxAmmo > 0 && (
                <span className="text-[10px] font-mono text-yellow-500 font-bold mt-0.5">
                  AMMO: {player.ammo[player.currentWeapon]} / {currentWeaponInfo.maxAmmo}
                </span>
              )}
            </div>
            <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center p-2 text-white shadow-inner">
              {player.currentWeapon === 'fist' && <Skull className="w-6 h-6 text-white/70" />}
              {player.currentWeapon === 'pistol' && <CrosshairsIcon className="w-6 h-6 text-yellow-500" />}
              {player.currentWeapon === 'smg' && <Target className="w-6 h-6 text-cyan-400" />}
              {player.currentWeapon === 'shotgun' && <Bomb className="w-6 h-6 text-orange-400" />}
              {player.currentWeapon === 'rocket' && <Flame className="w-6 h-6 text-red-500 animate-pulse" />}
            </div>
          </div>
        </div>
      </div>

      {/* 2. CENTER SCREEN GAME OVER, SHOP, AND INTRO OVERLAYS */}
      <div className="flex-1 flex items-center justify-center p-4">
        
        {/* SHOP MODAL */}
        {shopOpen && (
          <div className="bg-[#050505]/95 border border-white/10 rounded-2xl p-6 w-full max-w-md pointer-events-auto shadow-[0_10px_50px_rgba(0,0,0,0.8)] backdrop-blur-md text-white animate-fade-in">
            <div className="flex justify-between items-center border-b border-white/10 pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-black uppercase tracking-tight">
                  {shopOpen === 'ammu_nation' && 'AMMU-NATION'}
                  {shopOpen === 'burger_shot' && 'BURGER SHOT'}
                  {shopOpen === 'spray' && 'PAY \'N\' SPRAY'}
                </h3>
              </div>
              <button 
                onClick={onCloseShop}
                className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all cursor-pointer border border-white/5"
              >
                CLOSE (ESC)
              </button>
            </div>

            {/* Shop description */}
            <p className="text-xs text-gray-400 mb-5 font-medium leading-relaxed uppercase tracking-wider">
              {shopOpen === 'ammu_nation' && '// SPECIAL WEAPONRY & COMBAT ARMOR PROVIDER'}
              {shopOpen === 'burger_shot' && '// ENERGY BOOSTER AND REPLENISHMENT ZONE'}
              {shopOpen === 'spray' && '// VEHICLE PAINT RESRAY & INSTANT WANTED RESET'}
            </p>

            {/* Shop Items List */}
            <div className="flex flex-col gap-3">
              {shopOpen === 'ammu_nation' && (
                <>
                  {/* Pistol Purchase */}
                  <div className="flex justify-between items-center bg-white/[0.03] p-3 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                    <div>
                      <h4 className="font-bold text-sm text-white">{WEAPON_INFOS.pistol.name}</h4>
                      <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-0.5">Tactical Pistol + Ammo</p>
                    </div>
                    <button 
                      disabled={player.cash < 200}
                      onClick={() => onBuyWeapon('pistol', 200)}
                      className={`px-4 py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all cursor-pointer ${
                        player.cash >= 200 
                          ? 'bg-[#45a049] hover:bg-[#54b858] text-white shadow-lg shadow-[#45a049]/20' 
                          : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                      }`}
                    >
                      $200 BUY
                    </button>
                  </div>

                  {/* SMG Purchase */}
                  <div className="flex justify-between items-center bg-white/[0.03] p-3 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                    <div>
                      <h4 className="font-bold text-sm text-white">{WEAPON_INFOS.smg.name}</h4>
                      <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-0.5">Rapid Fire Submachine Gun</p>
                    </div>
                    <button 
                      disabled={player.cash < 600}
                      onClick={() => onBuyWeapon('smg', 600)}
                      className={`px-4 py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all cursor-pointer ${
                        player.cash >= 600 
                          ? 'bg-[#45a049] hover:bg-[#54b858] text-white shadow-lg shadow-[#45a049]/20' 
                          : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                      }`}
                    >
                      $600 BUY
                    </button>
                  </div>

                  {/* Shotgun Purchase */}
                  <div className="flex justify-between items-center bg-white/[0.03] p-3 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                    <div>
                      <h4 className="font-bold text-sm text-white">{WEAPON_INFOS.shotgun.name}</h4>
                      <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-0.5">Heavy Pump Action Shotgun</p>
                    </div>
                    <button 
                      disabled={player.cash < 1200}
                      onClick={() => onBuyWeapon('shotgun', 1200)}
                      className={`px-4 py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all cursor-pointer ${
                        player.cash >= 1200 
                          ? 'bg-[#45a049] hover:bg-[#54b858] text-white shadow-lg shadow-[#45a049]/20' 
                          : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                      }`}
                    >
                      $1200 BUY
                    </button>
                  </div>

                  {/* RPG Rocket Purchase */}
                  <div className="flex justify-between items-center bg-white/[0.03] p-3 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                    <div>
                      <h4 className="font-bold text-sm text-white">{WEAPON_INFOS.rocket.name}</h4>
                      <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-0.5">Explosive RPG Launcher</p>
                    </div>
                    <button 
                      disabled={player.cash < 3000}
                      onClick={() => onBuyWeapon('rocket', 3000)}
                      className={`px-4 py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all cursor-pointer ${
                        player.cash >= 3000 
                          ? 'bg-[#45a049] hover:bg-[#54b858] text-white shadow-lg shadow-[#45a049]/20' 
                          : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                      }`}
                    >
                      $3000 BUY
                    </button>
                  </div>

                  {/* Body Armor */}
                  <div className="flex justify-between items-center bg-white/[0.03] p-3 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                    <div>
                      <h4 className="font-bold text-sm text-white">전술 방탄복 (Tactical Armor)</h4>
                      <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-0.5">Reinforced Defense Vest</p>
                    </div>
                    <button 
                      disabled={player.cash < 150}
                      onClick={() => onBuyArmor(150)}
                      className={`px-4 py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all cursor-pointer ${
                        player.cash >= 150 
                          ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20' 
                          : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                      }`}
                    >
                      $150 BUY
                    </button>
                  </div>
                </>
              )}

              {shopOpen === 'burger_shot' && (
                <div className="flex justify-between items-center bg-white/[0.03] p-4 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                  <div>
                    <h4 className="font-bold text-sm text-white">더블 샷 치즈버거 세트</h4>
                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-0.5">Full Health Restoration</p>
                  </div>
                  <button 
                    disabled={player.cash < 30}
                    onClick={() => onBuyHealth(30)}
                    className={`px-4 py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all cursor-pointer ${
                      player.cash >= 30 
                        ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20' 
                        : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                    }`}
                  >
                    $30 PAY
                  </button>
                </div>
              )}

              {shopOpen === 'spray' && (
                <div className="flex justify-between items-center bg-white/[0.03] p-4 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                  <div>
                    <h4 className="font-bold text-sm text-white">신속 도색 (Pay & Spray)</h4>
                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-0.5">Reset Wanted & Repair Car</p>
                  </div>
                  <button 
                    disabled={player.cash < 250 || !playerVehicle}
                    onClick={() => onSprayCar(250)}
                    className={`px-4 py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all cursor-pointer ${
                      (player.cash >= 250 && playerVehicle) 
                        ? 'bg-[#45a049] hover:bg-[#54b858] text-white shadow-lg shadow-[#45a049]/20' 
                        : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                    }`}
                  >
                    {!playerVehicle ? 'NEED CAR' : '$250 SPRAY'}
                  </button>
                </div>
              )}

              {shopOpen === 'safehouse' && (
                <div className="flex flex-col gap-4">
                  <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5 text-center">
                    <Sparkles className="w-8 h-8 text-yellow-400 mx-auto mb-2 animate-pulse" />
                    <h4 className="font-extrabold text-sm text-white">보스의 안전 가옥 (Safehouse Hideout)</h4>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                      "어이 신입, 푹 쉬고 다음 임무를 준비하라고!"
                    </p>
                    <p className="text-xs text-emerald-400 font-extrabold mt-2 bg-emerald-950/40 border border-emerald-500/20 py-1.5 px-3 rounded-lg inline-block">
                      💰 보스 방문 환영금 $2,000 지급 완료!
                    </p>
                    <p className="text-[11px] text-gray-500 mt-2 uppercase font-mono tracking-wider">
                      // REST AND RECOVERY ZONE
                    </p>
                  </div>

                  <div className="flex justify-between items-center bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                    <div>
                      <h5 className="font-bold text-xs text-white">체력 및 스태미나 충전</h5>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">Fully Heal & Recover Stamina</p>
                    </div>
                    <button 
                      onClick={() => {
                        onBuyHealth(0); // Free heal!
                        sound.playMoney();
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-black text-xs rounded-lg uppercase tracking-wider transition-all pointer-events-auto cursor-pointer"
                    >
                      FREE REST
                    </button>
                  </div>

                  {setGameState && (
                    <div className="flex justify-between items-center bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                      <div>
                        <h5 className="font-bold text-xs text-white">보스의 긴급 자금 지원</h5>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">Request Extra Boss Funding</p>
                      </div>
                      <button 
                        onClick={() => {
                          setGameState(prev => ({
                            ...prev,
                            player: {
                              ...prev.player,
                              cash: prev.player.cash + 1000
                            }
                          }));
                          sound.playMoney();
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-xs rounded-lg uppercase tracking-wider transition-all pointer-events-auto cursor-pointer"
                      >
                        +$1,000 GET
                      </button>
                    </div>
                  )}

                  <div className="bg-black/50 p-3.5 rounded-xl border border-white/5 text-[10px] text-gray-400 leading-relaxed font-semibold uppercase tracking-wider space-y-1">
                    <p className="text-yellow-500 font-bold mb-1">📊 현재 에이전트 요약</p>
                    <p>• 소지 자금: ${player.cash.toLocaleString()}</p>
                    <p>• 수배 등급: {player.wantedLevel > 0 ? `${player.wantedLevel} STAR` : '깨끗함 (NONE)'}</p>
                    <p>• 무기 목록: {player.weaponsOwned.join(', ')}</p>
                  </div>
                </div>
              )}

              {shopOpen === 'bank' && (
                <div className="flex flex-col gap-4">
                  <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5 text-center">
                    <Navigation className="w-8 h-8 text-purple-400 mx-auto mb-2 animate-bounce" />
                    <h4 className="font-extrabold text-sm text-white">메이즈 은행 금융 센터 (Maze Bank Center)</h4>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                      로스 산토스 최대의 상업 은행에 오신 것을 환영합니다. 안전한 자산 보관과 금융 서비스를 제공합니다.
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1 uppercase font-mono tracking-wider">
                      // MAZE BANK ASSET SERVICE
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest font-bold">ATM SERVICES</div>
                    
                    {/* Invest/Deposit */}
                    <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
                      <div>
                        <h5 className="font-bold text-xs text-white">채권 투자 (Invest in Stocks)</h5>
                        <p className="text-[10px] text-gray-400 mt-0.5">Investment stock yield simulator</p>
                      </div>
                      <button 
                        disabled={player.cash < 500}
                        onClick={() => {
                          if (!setGameState) return;
                          const win = Math.random() < 0.5;
                          const amount = win ? 800 : -500;
                          setGameState(prev => ({
                            ...prev,
                            player: {
                              ...prev.player,
                              cash: prev.player.cash + amount
                            }
                          }));
                          if (win) {
                            sound.playMoney();
                          } else {
                            sound.playPunch();
                          }
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all cursor-pointer pointer-events-auto ${
                          player.cash >= 500 
                            ? 'bg-purple-600 hover:bg-purple-500 text-white' 
                            : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                        }`}
                      >
                        $500 INVEST
                      </button>
                    </div>

                    {/* Launder cash to clear wanted level */}
                    <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
                      <div>
                        <h5 className="font-bold text-xs text-white">비자금 세탁 (Launder Cash)</h5>
                        <p className="text-[10px] text-gray-400 mt-0.5">Clears Wanted levels with premium fee</p>
                      </div>
                      <button 
                        disabled={player.cash < 1000 || player.wantedLevel === 0}
                        onClick={() => {
                          if (!setGameState) return;
                          setGameState(prev => ({
                            ...prev,
                            player: {
                              ...prev.player,
                              cash: prev.player.cash - 1000,
                              wantedLevel: 0,
                              wantedPoints: 0
                            }
                          }));
                          sound.playMoney();
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all cursor-pointer pointer-events-auto ${
                          (player.cash >= 1000 && player.wantedLevel > 0) 
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg' 
                            : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                        }`}
                      >
                        $1000 CLEAR
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* INTRO/LAUNCH SCREEN */}
        {gameStatus === 'intro' && (
          <div className="bg-gradient-to-b from-[#0a0a1a] via-[#1a1a2e] to-[#050505] border border-white/10 p-8 rounded-2xl w-full max-w-lg pointer-events-auto text-center shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-lg animate-scale-up text-white">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-yellow-500 mb-2 drop-shadow-[0_2px_10px_rgba(234,179,8,0.3)]">
              GRAND WEB AUTO
            </h1>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-6 font-mono">
              Los Santos Top-Down Classic Edition
            </p>

            <div className="text-left bg-black/40 p-4 rounded-xl border border-white/5 mb-6 text-sm leading-relaxed space-y-2 text-gray-300">
              <p className="font-bold text-yellow-500 text-center mb-1">🎮 조작 가이드 (PC 기준)</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono py-1 border-b border-white/5">
                <span><b className="text-white">W, A, S, D:</b> 이동 / 차량 조작</span>
                <span><b className="text-white">마우스 좌클릭:</b> 공격 / 사격</span>
                <span><b className="text-white">F 키:</b> 차량 탑승 / 하차</span>
                <span><b className="text-white">Q / E / 스크롤:</b> 무기 전환</span>
                <span><b className="text-white">SPACEBAR:</b> 수동 핸드브레이크</span>
                <span><b className="text-white">마우스 조준:</b> 공격 방향</span>
              </div>
              <p className="text-xs text-gray-400 pt-1 text-center">
                ※ 모바일 및 태블릿은 화면상의 <b>가상 터치 조이스틱과 버튼</b>으로 완전 조작이 가능합니다!
              </p>
            </div>

            <button 
              onClick={() => {
                sound.resume();
                onStartGame();
              }}
              className="w-full bg-gradient-to-r from-[#45a049] to-[#3a853e] hover:from-[#54b858] hover:to-[#45a049] text-white font-extrabold text-base py-4 px-6 rounded-xl transition-all shadow-xl shadow-green-500/10 active:scale-95 cursor-pointer pointer-events-auto flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <Play className="w-5 h-5 fill-white" />
              Start Game
            </button>
          </div>
        )}

        {/* GAME OVER SCREEN */}
        {gameStatus === 'gameover' && (
          <div className="bg-gradient-to-b from-[#1a0a0a] via-[#2d1111] to-[#050505] border border-red-500/30 p-8 rounded-2xl w-full max-w-md pointer-events-auto text-center shadow-[0_0_50px_rgba(220,38,38,0.2)] backdrop-blur-lg animate-scale-up text-white">
            <h2 className="text-5xl font-black tracking-widest text-red-600 mb-2 drop-shadow-[0_2px_15px_rgba(220,38,38,0.6)] uppercase font-mono italic">
              WASTED
            </h2>
            <p className="text-xs text-gray-400 mb-6 font-mono uppercase tracking-widest">// You failed to escape the search perimeter</p>

            <button 
              onClick={() => {
                sound.resume();
                onRestartGame();
              }}
              className="w-full bg-[#111] hover:bg-black text-red-500 border border-red-500/30 hover:border-red-500/60 font-black text-sm py-3 px-6 rounded-xl transition-all cursor-pointer pointer-events-auto flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <RefreshCw className="w-4 h-4" />
              Respawn Agent
            </button>
          </div>
        )}

        {/* VICTORY/COMPLETED SCREEN */}
        {gameStatus === 'completed' && (
          <div className="bg-gradient-to-b from-[#1a150a] via-[#2d2211] to-[#050505] border border-yellow-500/30 p-8 rounded-2xl w-full max-w-md pointer-events-auto text-center shadow-[0_0_50px_rgba(234,179,8,0.2)] backdrop-blur-lg animate-scale-up text-white">
            <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-3xl font-black tracking-tighter text-yellow-500 mb-2 drop-shadow-[0_2px_15px_rgba(234,179,8,0.4)] uppercase italic">
              MISSIONS COMPLETE
            </h2>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed uppercase tracking-wider">
              // You have successfully established absolute dominance over Los Santos
            </p>

            <button 
              onClick={() => {
                sound.resume();
                onRestartGame();
              }}
              className="w-full bg-[#111] hover:bg-black text-yellow-500 border border-yellow-500/30 hover:border-yellow-500/60 font-black text-sm py-3 px-6 rounded-xl transition-all cursor-pointer pointer-events-auto flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <RefreshCw className="w-4 h-4" />
              Enter Free Mode
            </button>
          </div>
        )}
      </div>

      {/* 3. BOTTOM BAR HUD (Active Missions + Speeder for Vehicle) */}
      <div className="w-full flex justify-between items-end p-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none relative pb-7">
        
        {/* Left Side: Active Mission Instructions */}
        <div className="max-w-md flex flex-col gap-2 pointer-events-auto">
          {activeMission && gameStatus === 'playing' ? (
            <div className="bg-[#050505]/90 border-l-4 border-yellow-500 p-4 rounded-r-xl shadow-2xl flex flex-col gap-1 backdrop-blur-md text-white border border-white/5">
              <div className="flex items-center gap-2 border-b border-white/5 pb-1.5 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <h4 className="font-black text-xs uppercase tracking-widest text-yellow-500">
                  Active Mission
                </h4>
              </div>
              <h2 className="text-sm font-black italic uppercase tracking-tight text-white">{activeMission.title}</h2>
              <p className="text-xs text-gray-300 leading-relaxed font-semibold mt-1">
                {activeMission.steps[activeMission.currentStepIndex]?.description || activeMission.description}
              </p>
              <div className="flex justify-between items-center mt-2.5 text-[10px] text-gray-500 border-t border-white/5 pt-1.5 font-mono uppercase tracking-widest">
                <span>REWARD: <b className="text-green-400 font-bold">${activeMission.reward}</b></span>
                <span>STEP: {activeMission.currentStepIndex + 1} / {activeMission.steps.length}</span>
              </div>
              {onCompleteActiveMission && activeMission.currentStepIndex >= activeMission.steps.length && (
                <button
                  onClick={onCompleteActiveMission}
                  className="mt-3.5 w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-xs py-2.5 px-4 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer pointer-events-auto flex items-center justify-center gap-2 border border-emerald-400/20 animate-pulse"
                >
                  <Trophy className="w-4 h-4 text-yellow-300 animate-bounce" />
                  <span>보상 수령 (Claim Reward)</span>
                </button>
              )}
            </div>
          ) : (
            gameStatus === 'playing' && (
              <div className="bg-[#050505]/90 border-l-4 border-emerald-500 border border-white/5 p-4 rounded-r-xl text-white/90 max-w-xs text-xs backdrop-blur-md shadow-2xl flex items-center gap-2.5">
                <Navigation className="w-4 h-4 text-emerald-400 animate-pulse flex-shrink-0" />
                <span>시내를 배회하며 <b>보스의 안가 (Safehouse)</b>로 가서 첫 미션을 수주하세요! (미니맵 노란 별 표식)</span>
              </div>
            )
          )}
        </div>

        {/* Right Side: Vehicle Speeder */}
        <div className="flex flex-col items-end gap-3 pointer-events-auto">
          {gameState.killNotification && Date.now() - gameState.killNotification.timestamp < 3500 && (
            <div className="bg-black/95 border border-red-500/40 px-4 py-2.5 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.4)] text-red-500 font-extrabold text-xs tracking-wide animate-bounce font-sans flex items-center gap-1.5 border-l-4 border-l-red-500">
              <Skull className="w-3.5 h-3.5 text-red-500 animate-pulse fill-red-500/20" />
              <span>{gameState.killNotification.message}</span>
            </div>
          )}

          {playerVehicle && gameStatus === 'playing' && (
            <div className="bg-[#050505]/90 border border-white/10 p-4 rounded-2xl flex flex-col items-center justify-center min-w-[140px] shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-md text-white animate-fade-in">
              <span className="text-[10px] text-gray-500 uppercase font-mono tracking-widest mb-1 leading-none">Vehicle Telemetry</span>
              <div className="relative flex flex-col items-center">
                {/* Speed display */}
                <span className="text-4xl font-mono font-black tracking-tighter text-white">
                  {Math.round(Math.abs(playerVehicle.speed) * 8)}
                </span>
                <span className="text-[9px] text-gray-400 uppercase font-mono tracking-widest mt-0.5">MPH</span>
              </div>
              
              {/* Vehicle Health meter */}
              <div className="w-full mt-3.5 flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px] text-gray-400 font-mono uppercase tracking-wider">
                  <span>Engine HP</span>
                  <span className={playerVehicle.health < 40 ? 'text-red-500 font-black animate-pulse' : 'text-green-400 font-black'}>
                    {Math.round(playerVehicle.health)}%
                  </span>
                </div>
                <div className="w-28 bg-gray-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className={`h-full transition-all duration-150 ${
                      playerVehicle.health < 40 
                        ? 'bg-red-500' 
                        : 'bg-green-500'
                    }`} 
                    style={{ width: `${playerVehicle.health}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar Info / System Status */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-gray-600 uppercase tracking-[0.25em] font-mono font-bold hidden md:block">
          Venture Engine v4.02 // System Status: Optimal
        </div>

      </div>

    </div>
  );
};

// Simple helper icon for weapon
const CrosshairsIcon: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  );
};
