import React, { useState, useEffect, useRef } from 'react';
import { GameState, Player, Car, Pedestrian, Building, GameMission, WeaponType } from './types';
import { GameCanvas } from './components/GameCanvas';
import { GameUI } from './components/GameUI';
import { MobileControls } from './components/MobileControls';
import { sound } from './audio';
import { HelpCircle, ShieldAlert, Navigation, Trophy, Sparkles } from 'lucide-react';

// Spawns/Generates static building grids programmatically
const generateBuildings = (): Building[] => {
  const list: Building[] = [];
  const mapSize = 4000;
  
  // Roads are at x = 500, 1500, 2500, 3500 and y = 500, 1500, 2500, 3500
  // Put buildings inside the grid blocks
  const blocks = [
    { startX: 100, endX: 400, startY: 100, endY: 400, type: 'residential' },
    { startX: 600, endX: 1400, startY: 100, endY: 400, type: 'commercial' }, // Burger Shot at 1000, 100
    { startX: 1600, endX: 2400, startY: 100, endY: 400, type: 'commercial' },
    { startX: 2600, endX: 3400, startY: 100, endY: 400, type: 'skyscrapers' }, // Ammu-Nation at 3000, 100
    
    { startX: 100, endX: 400, startY: 600, endY: 1400, type: 'skyscrapers' },
    { startX: 1600, endX: 2400, startY: 600, endY: 1400, type: 'residential' },
    { startX: 2600, endX: 3400, startY: 600, endY: 1400, type: 'skyscrapers' },

    { startX: 100, endX: 400, startY: 1600, endY: 2400, type: 'industrial' },
    { startX: 600, endX: 1400, startY: 1600, endY: 2400, type: 'residential' },
    { startX: 2600, endX: 3400, startY: 1600, endY: 2400, type: 'skyscrapers' },

    { startX: 100, endX: 400, startY: 2600, endY: 3400, type: 'industrial' },
    { startX: 600, endX: 1400, startY: 2600, endY: 3400, type: 'commercial' }, // Spray shop at 1200, 3000
    { startX: 1600, endX: 2400, startY: 2600, endY: 3400, type: 'skyscrapers' },
    { startX: 2600, endX: 3400, startY: 2600, endY: 3400, type: 'commercial' }, // Bank at 3000, 3000
  ];

  // Specific key shops coordinates
  const keyShops = [
    { x: 1000, y: 1000, width: 120, height: 100, type: 'shop', name: '🍔 Burger Shot', roof: '#EF4444', facade: '#991B1B' },
    { x: 3000, y: 1000, width: 130, height: 110, type: 'shop', name: '🔫 Ammu-Nation', roof: '#06B6D4', facade: '#0891B2' },
    { x: 1200, y: 3000, width: 140, height: 110, type: 'shop', name: '🔧 Spray Shop', roof: '#10B981', facade: '#065F46' },
    { x: 3000, y: 3000, width: 150, height: 130, type: 'shop', name: '🏦 Maze Bank', roof: '#8B5CF6', facade: '#6D28D9' },
    { x: 2000, y: 2000, width: 160, height: 120, type: 'shop', name: '⭐ 보스 안가 (Safehouse)', roof: '#F59E0B', facade: '#D97706' }
  ];

  // Add key shops first
  keyShops.forEach((shop, index) => {
    list.push({
      id: `shop-${index}`,
      x: shop.x - shop.width / 2,
      y: shop.y - shop.height / 2,
      width: shop.width,
      height: shop.height,
      color: shop.facade,
      roofColor: shop.roof,
      type: 'shop',
      name: shop.name
    });
  });

  // Generate generic decorative buildings inside blocks, skipping overlap with key shops
  blocks.forEach((block, bIdx) => {
    // Spawn 2 to 3 buildings per block
    const numBuildings = 3;
    const blockW = block.endX - block.startX;
    const blockH = block.endY - block.startY;
    
    for (let i = 0; i < numBuildings; i++) {
      const bW = 100 + Math.random() * 80;
      const bH = 100 + Math.random() * 80;
      const bX = block.startX + (i * (blockW / numBuildings)) + Math.random() * 15;
      const bY = block.startY + Math.random() * (blockH - bH);

      // Check if overlapping any key shops
      let overlaps = false;
      keyShops.forEach(shop => {
        const buffer = 150;
        if (
          bX + bW > shop.x - buffer &&
          bX < shop.x + shop.width + buffer &&
          bY + bH > shop.y - buffer &&
          bY < shop.y + shop.height + buffer
        ) {
          overlaps = true;
        }
      });

      if (!overlaps) {
        let color = '#334155'; // Slate wall
        let roofColor = '#1E293B'; // Dark Slate top
        
        if (block.type === 'skyscrapers') {
          color = '#475569';
          roofColor = '#334155';
        } else if (block.type === 'industrial') {
          color = '#78350F';
          roofColor = '#451A03';
        } else if (block.type === 'residential') {
          color = '#15803D';
          roofColor = '#14532D';
        }

        list.push({
          id: `bld-${bIdx}-${i}`,
          x: bX,
          y: bY,
          width: bW,
          height: bH,
          color,
          roofColor,
          type: block.type as any
        });
      }
    }
  });

  return list;
};

// Initial state creator
const createInitialState = (): GameState => {
  // Generate programmatic city
  const generatedBuildings = generateBuildings();

  // Create initial available missions
  const initialMissions: GameMission[] = [
    {
      id: 'intro_m',
      title: '로스 산토스 데뷔 (Meet Boss)',
      description: '도시의 거물 마피아 보스를 만나 첫 신뢰를 얻으세요.',
      reward: 350,
      status: 'available',
      steps: [
        {
          description: '지도에 표시된 "보스 안가"로 도보 혹은 차를 타고 가십시오 (미니맵 노란 별)',
          type: 'goto',
          targetX: 2000,
          targetY: 2000
        }
      ],
      currentStepIndex: 0
    },
    {
      id: 'car_thief',
      title: '베테랑 차도둑 (Car Thief)',
      description: '아뮤네이션 주차장의 고성능 스포츠카를 탈취하여 무사히 도색 차고에 전송하십시오.',
      reward: 1500,
      status: 'locked',
      steps: [
        {
          description: '아뮤네이션 무기 상점 앞 공터로 가십시오 (미니맵 빨간 원)',
          type: 'goto',
          targetX: 3000,
          targetY: 1000
        },
        {
          description: '전시되어 있는 붉은색 스포츠카를 훔쳐 타십시오 (F 키)',
          type: 'steal_car',
          targetVehicleType: 'sports'
        },
        {
          description: '경찰의 추격을 피하고 차량을 안전하게 도색 차고로 전송하십시오',
          type: 'goto',
          targetX: 1200,
          targetY: 3000
        }
      ],
      currentStepIndex: 0
    },
    {
      id: 'mob_hit',
      title: '라이벌 갱단 소탕 (Mob Hit)',
      description: '로스 산토스 지하 구역을 침범하려는 적대조직 무장 세력을 암살하십시오.',
      reward: 2500,
      status: 'locked',
      steps: [
        {
          description: '메이즈 은행 주차장에 위치한 라이벌 보스의 모임 장소로 이동하십시오',
          type: 'goto',
          targetX: 3000,
          targetY: 3000
        },
        {
          description: '현장의 삼엄한 경비원(보디가드)들을 먼저 무력화 하십시오',
          type: 'kill_target',
          targetPedType: 'bodyguard'
        },
        {
          description: '갱스터 두목을 사살하여 도시의 위엄을 과시하십시오',
          type: 'kill_target',
          targetPedType: 'gang'
        }
      ],
      currentStepIndex: 0
    },
    {
      id: 'bank_robbery',
      title: '메이즈 은행 대강탈 (The Big Bank Heist)',
      description: '메이즈 은행 지하 금고를 털고 로스 산토스 전역의 3성 추격을 따돌려 최고의 승리를 차지하십시오!',
      reward: 5000,
      status: 'locked',
      steps: [
        {
          description: '메이즈 은행 입구 안쪽 안전지대 표식을 향해 접근하여 돈가방을 탈취하십시오',
          type: 'goto',
          targetX: 3000,
          targetY: 3000
        },
        {
          description: '3성급 경찰 추격대(Wanted Level)를 완벽하게 은닉 혹은 떼어 내어 따돌리십시오',
          type: 'escape_wanted'
        },
        {
          description: '보스의 안전 가옥(Safehouse)으로 신속히 복귀하십시오!',
          type: 'goto',
          targetX: 2000,
          targetY: 2000
        }
      ],
      currentStepIndex: 0
    }
  ];

  return {
    player: {
      x: 1000, // Spawn player near Burger Shot
      y: 1100,
      angle: 0,
      health: 100,
      maxHealth: 100,
      armor: 50,
      maxArmor: 100,
      cash: 500, // Starter wallet
      currentWeapon: 'fist',
      weaponsOwned: ['fist'],
      ammo: { fist: 0, pistol: 0, smg: 0, shotgun: 0, rocket: 0 },
      stamina: 100,
      maxStamina: 100,
      insideVehicleId: null,
      wantedLevel: 0,
      wantedPoints: 0,
      lastCrimeTime: 0,
      isDead: false
    },
    cars: [
      // Spawn some starter civilian cars in key locations
      { id: 'car-init-1', type: 'sedan', x: 1000, y: 920, angle: 0, speed: 0, maxSpeed: 140, accel: 65, friction: 0.98, color: '#3B82F6', health: 100, maxHealth: 100, width: 48, height: 20, isPlayerDriving: false, aiActive: true, targetX: 1500, targetY: 1000, roadNodeIndex: 0, stopTimer: 0, sirenOn: false },
      { id: 'car-init-2', type: 'sports', x: 3000, y: 910, angle: Math.PI, speed: 0, maxSpeed: 210, accel: 120, friction: 0.98, color: '#EF4444', health: 100, maxHealth: 100, width: 48, height: 20, isPlayerDriving: false, aiActive: false, targetX: 0, targetY: 0, roadNodeIndex: 0, stopTimer: 0, sirenOn: false },
      { id: 'car-init-3', type: 'truck', x: 2000, y: 2500, angle: Math.PI/2, speed: 0, maxSpeed: 110, accel: 45, friction: 0.98, color: '#16A34A', health: 100, maxHealth: 100, width: 56, height: 24, isPlayerDriving: false, aiActive: true, targetX: 2000, targetY: 3500, roadNodeIndex: 0, stopTimer: 0, sirenOn: false }
    ],
    pedestrians: [
      // Spawn rival boss bodyguards near bank coordinates (3000, 3000) for late mission compatibility
      { id: 'guard-1', type: 'bodyguard', state: 'patrolling', x: 2950, y: 2950, angle: 0, speed: 40, maxSpeed: 85, health: 100, maxHealth: 100, color: '#1E293B', targetX: 2950, targetY: 3050, shootCooldown: 0, isInsideVehicle: false, dropCash: 60, alertedByWeapon: false },
      { id: 'guard-2', type: 'bodyguard', state: 'patrolling', x: 3050, y: 2950, angle: Math.PI, speed: 45, maxSpeed: 85, health: 100, maxHealth: 100, color: '#1E293B', targetX: 3050, targetY: 3050, shootCooldown: 0, isInsideVehicle: false, dropCash: 60, alertedByWeapon: false },
      { id: 'rival-boss', type: 'gang', state: 'patrolling', x: 3000, y: 3020, angle: Math.PI/2, speed: 30, maxSpeed: 75, health: 150, maxHealth: 150, color: '#7C2D12', targetX: 2980, targetY: 3040, shootCooldown: 0, isInsideVehicle: false, dropCash: 500, alertedByWeapon: false }
    ],
    bullets: [],
    particles: [],
    buildings: generatedBuildings,
    missions: initialMissions,
    activeMissionId: null,
    shopOpen: null,
    score: 0,
    timeOfDay: 1000, // 10:00 AM
    gameStatus: 'intro',
    killNotification: null
  };
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [isMuted, setIsMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [weaponChangeTrigger, setWeaponChangeTrigger] = useState(false);

  // Mobile viewport detection
  useEffect(() => {
    const handleCheckMobile = () => {
      const mobile = window.innerWidth < 1024 || 'ontouchstart' in window;
      setIsMobile(mobile);
    };
    
    handleCheckMobile();
    window.addEventListener('resize', handleCheckMobile);
    return () => window.removeEventListener('resize', handleCheckMobile);
  }, []);

  // Sync touch controller state indicators
  const [mobileControllerState, setMobileControllerState] = useState({
    joystickX: 0,
    joystickY: 0,
    isJoystickActive: false,
    accelerate: false,
    reverse: false,
    drift: false,
    shoot: false,
    enterVehicle: false
  });

  const handleMobileControlChange = (controls: any) => {
    setMobileControllerState(controls);
  };

  const handleWeaponChangeTrigger = () => {
    setWeaponChangeTrigger(prev => !prev);
  };

  // --- ACTIONS TRIPPED FROM THE UI HUD/SHOP SYSTEMS ---

  const handleStartGame = () => {
    setGameState(prev => ({ ...prev, gameStatus: 'playing' }));
    sound.resume();
  };

  const handleRestartGame = () => {
    setGameState(createInitialState());
    sound.resume();
  };

  const handleBuyWeapon = (weapon: WeaponType, cost: number) => {
    setGameState(prev => {
      if (prev.player.cash < cost) return prev;
      
      const updatedWeapons = prev.player.weaponsOwned.includes(weapon)
        ? prev.player.weaponsOwned
        : [...prev.player.weaponsOwned, weapon];

      const maxAmmo = { fist: 0, pistol: 250, smg: 500, shotgun: 80, rocket: 10 }[weapon];

      return {
        ...prev,
        player: {
          ...prev.player,
          cash: prev.player.cash - cost,
          weaponsOwned: updatedWeapons,
          currentWeapon: weapon,
          ammo: {
            ...prev.player.ammo,
            [weapon]: maxAmmo
          }
        }
      };
    });
    sound.playMoney();
  };

  const handleBuyArmor = (cost: number) => {
    setGameState(prev => {
      if (prev.player.cash < cost) return prev;
      return {
        ...prev,
        player: {
          ...prev.player,
          cash: prev.player.cash - cost,
          armor: prev.player.maxArmor
        }
      };
    });
    sound.playMoney();
  };

  const handleBuyHealth = (cost: number) => {
    setGameState(prev => {
      if (prev.player.cash < cost) return prev;
      return {
        ...prev,
        player: {
          ...prev.player,
          cash: prev.player.cash - cost,
          health: prev.player.maxHealth,
          stamina: prev.player.maxStamina
        }
      };
    });
    sound.playMoney();
  };

  const handleSprayCar = (cost: number) => {
    setGameState(prev => {
      if (prev.player.cash < cost || !prev.player.insideVehicleId) return prev;
      
      // Paint car random shiny new color
      const newColor = ['#DC2626', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'][Math.floor(Math.random() * 6)];
      
      const updatedCars = prev.cars.map(c => 
        c.id === prev.player.insideVehicleId 
          ? { ...c, color: newColor, health: 100 } 
          : c
      );

      // Successfully sprayed car fully resets active wanted stars!
      return {
        ...prev,
        player: {
          ...prev.player,
          cash: prev.player.cash - cost,
          wantedPoints: 0,
          wantedLevel: 0
        },
        cars: updatedCars
      };
    });
    sound.playMoney();
  };

  const handleCloseShop = () => {
    setGameState(prev => ({ ...prev, shopOpen: null }));
  };

  const handleToggleMute = () => {
    const nextMute = sound.toggleMute();
    setIsMuted(nextMute);
  };

  const handleAcceptMission = (missionId: string) => {
    setGameState(prev => {
      const activeId = prev.activeMissionId === missionId ? null : missionId;
      
      // Reset current steps index when accepted
      const updatedMissions = prev.missions.map(m => 
        m.id === missionId ? { ...m, currentStepIndex: 0 } : m
      );

      return {
        ...prev,
        activeMissionId: activeId,
        missions: updatedMissions
      };
    });
    sound.playPunch();
  };

  const handleCompleteActiveMission = () => {
    setGameState(prev => {
      const activeMission = prev.missions.find(m => m.id === prev.activeMissionId);
      if (!activeMission) return prev;

      sound.playMissionComplete();

      const updatedMissions = prev.missions.map(m => {
        if (m.id === activeMission.id) {
          return {
            ...m,
            status: 'completed' as const,
            currentStepIndex: m.steps.length
          };
        }
        
        // Lock-Step unlock next missions!
        if (activeMission.id === 'intro_m' && m.id === 'car_thief') {
          return { ...m, status: 'available' as const };
        }
        if (activeMission.id === 'car_thief' && m.id === 'mob_hit') {
          return { ...m, status: 'available' as const };
        }
        if (activeMission.id === 'mob_hit' && m.id === 'bank_robbery') {
          return { ...m, status: 'available' as const };
        }
        return m;
      });

      let nextGameStatus = prev.gameStatus;
      if (activeMission.id === 'bank_robbery') {
        nextGameStatus = 'completed'; // Trigger Boss Game victory overlay
      }

      return {
        ...prev,
        player: {
          ...prev.player,
          cash: prev.player.cash + activeMission.reward
        },
        activeMissionId: null,
        missions: updatedMissions,
        gameStatus: nextGameStatus
      };
    });
  };

  return (
    <div className="w-screen h-screen bg-[#050505] overflow-hidden flex flex-col md:flex-row font-sans relative select-none">
      
      {/* LEFT SIDEBAR CONTROLS & MISSIONS DASHBOARD (DEKTOP STRETCH ONLY) */}
      <div className="hidden lg:flex w-80 bg-gradient-to-b from-[#0a0a1a] to-[#050505] border-r border-white/10 p-5 flex-col justify-between z-10 select-none text-white overflow-y-auto shadow-2xl">
        
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
            <span className="px-2 py-1 bg-gradient-to-tr from-[#45a049] to-emerald-600 text-white font-black text-[10px] rounded uppercase tracking-wider shadow-md">
              SYS
            </span>
            <div>
              <h2 className="font-black tracking-tight text-base text-white uppercase leading-none">
                GRAND WEB AUTO
              </h2>
              <span className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mt-1 block">LOS SANTOS SYSTEM</span>
            </div>
          </div>

          {/* Missions List */}
          <div className="space-y-4">
            <h3 className="text-[10px] uppercase font-mono tracking-widest text-gray-400 flex items-center gap-1.5 font-bold mb-2">
              <Navigation className="w-3.5 h-3.5 text-yellow-500" />
              DEPLOYMENT MISSIONS
            </h3>

            <div className="flex flex-col gap-2.5">
              {gameState.missions.map(m => {
                const isSelected = gameState.activeMissionId === m.id;
                const isLocked = m.status === 'locked';
                const isCompleted = m.status === 'completed';

                return (
                  <div 
                    key={m.id}
                    className={`p-3.5 rounded-xl border transition-all relative overflow-hidden flex flex-col ${
                      isSelected 
                        ? 'bg-[#050505]/95 border-yellow-500 border-l-4 shadow-lg shadow-black/60' 
                        : isCompleted
                        ? 'bg-white/[0.01] border-green-500/20 opacity-60'
                        : isLocked
                        ? 'bg-black/30 border-white/5 opacity-30'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1 mb-1.5">
                      <h4 className={`font-black text-xs tracking-tight uppercase ${isSelected ? 'text-yellow-500' : 'text-white'}`}>
                        {m.title}
                      </h4>
                      {isCompleted || (!isLocked && m.currentStepIndex >= m.steps.length) ? (
                        <span className="text-[8px] bg-green-500/20 text-green-400 border border-green-500/30 font-extrabold px-1.5 py-0.5 rounded tracking-widest uppercase">성공 (SUCCESS)</span>
                      ) : isLocked ? (
                        <span className="text-[8px] bg-white/5 text-gray-500 border border-white/5 font-extrabold px-1.5 py-0.5 rounded tracking-widest uppercase">LOCK</span>
                      ) : (
                        <span className="text-xs text-[#45a049] font-mono font-bold">${m.reward}</span>
                      )}
                    </div>
                    
                    <p className="text-[11px] text-gray-400 leading-relaxed mb-3.5 font-medium uppercase tracking-wider">
                      {m.description}
                    </p>

                    {!isLocked && !isCompleted && (
                      <div className="flex flex-col gap-1.5 w-full">
                        <button
                          onClick={() => handleAcceptMission(m.id)}
                          className={`w-full py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-red-600 text-white hover:bg-red-500 shadow-md shadow-red-600/10' 
                              : 'bg-white/5 text-white hover:bg-white/10 border border-white/5'
                          }`}
                        >
                          {isSelected ? 'ABORT OBJECTIVE' : 'ACCEPT DEPLOYMENT'}
                        </button>
                        {isSelected && m.currentStepIndex >= m.steps.length && (
                          <button
                            onClick={handleCompleteActiveMission}
                            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-[10px] py-1.5 rounded-lg transition-all shadow-md active:scale-95 cursor-pointer pointer-events-auto flex items-center justify-center gap-1.5 border border-emerald-400/20 animate-pulse"
                          >
                            <Trophy className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
                            <span>보상 수령 (Claim Reward)</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* System & Tips panel */}
        <div className="border-t border-white/10 pt-4 mt-6">
          <div className="flex items-start gap-3 bg-white/[0.02] p-3.5 rounded-xl border border-white/5 text-[10px] text-gray-400 leading-relaxed font-medium uppercase tracking-wider">
            <HelpCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <span>수배 상태 제거 요령: Pay 'N' Spray 도색 차고(미니맵 초록 구슬)에 차량을 탑승한 채로 진입하여 도색 수리를 진행하면 즉각 수배가 해제됩니다.</span>
          </div>
          <div className="text-[9px] text-gray-600 text-center font-mono mt-4 uppercase tracking-widest">
            Grand Web Auto // Venture Engine 4.02
          </div>
        </div>

      </div>

      {/* RIGHT SIDEBAR: PRIMARY CANVAS STAGE */}
      <div className="flex-1 h-full relative overflow-hidden flex flex-col">
        
        {/* Mobile top strip for instructions drawer toggle */}
        <div className="lg:hidden w-full bg-black border-b border-white/10 px-4 py-2.5 flex justify-between items-center z-15">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 bg-amber-500 text-black font-black text-[10px] rounded-sm uppercase tracking-wider">GTA</span>
            <span className="text-xs font-bold text-white uppercase tracking-tighter">Grand Web Auto</span>
          </div>
          <button 
            onClick={() => setShowInstructions(p => !p)}
            className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
            {showInstructions ? '조작법 숨기기' : '미션/조작법 보기'}
          </button>
        </div>

        {/* Mobile overlay sidebar panels */}
        {showInstructions && isMobile && (
          <div className="absolute inset-x-0 top-[45px] bg-black/95 border-b border-white/10 p-4 z-30 max-h-[50%] overflow-y-auto text-white flex flex-col gap-4 shadow-2xl">
            {/* Quick Tutorial */}
            <div className="text-xs space-y-1.5 text-gray-300 border-b border-white/10 pb-3">
              <h4 className="font-bold text-amber-400 flex items-center gap-1">🎮 스마트폰 조작법</h4>
              <p>• 좌측 하단의 <b>가상 원형 조이스틱</b>을 스와이프하여 방향을 조정하고 이동하세요.</p>
              <p>• 우측 하단의 <b>주황색 불꽃 원형 버튼</b>으로 주먹 및 총을 사격할 수 있습니다.</p>
              <p>• 차량에 타려면 차량 옆에서 <b>차량 열쇠 아이콘</b>을 누르세요. 내릴 때는 <b>사람 아이콘</b>을 누릅니다.</p>
            </div>

            {/* Missions lists */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-500">스토리 미션 (Story Missions)</h4>
              <div className="grid grid-cols-2 gap-2">
                {gameState.missions.map(m => {
                  const isSelected = gameState.activeMissionId === m.id;
                  const isLocked = m.status === 'locked';
                  const isCompleted = m.status === 'completed';

                  return (
                    <button
                      key={m.id}
                      disabled={isLocked}
                      onClick={() => {
                        handleAcceptMission(m.id);
                        setShowInstructions(false); // close to reveal canvas
                      }}
                      className={`p-2 rounded-lg border text-left text-xs transition-all ${
                        isSelected 
                          ? 'bg-amber-500/20 border-amber-500 text-white' 
                          : isCompleted
                          ? 'bg-green-950/20 border-green-500/30 opacity-70 text-gray-300'
                          : isLocked
                          ? 'bg-gray-900/40 border-gray-800 opacity-40 text-gray-500 cursor-not-allowed'
                          : 'bg-white/5 border-white/10 text-white'
                      }`}
                    >
                      <div className="font-bold flex justify-between items-center">
                        <span className="truncate">{m.title}</span>
                        <span className="text-[10px] text-green-400 font-bold">${m.reward}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{m.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 1. THE GAME CANVAS VIEWPORT STAGE */}
        <div className="flex-1 w-full h-full relative">
          <GameCanvas
            gameState={gameState}
            setGameState={setGameState}
            mobileControls={mobileControllerState}
            triggerWeaponChange={weaponChangeTrigger}
          />

          {/* 2. THE FLOATING OVERLAY HUD & SHUPS MODALS */}
          <GameUI
            gameState={gameState}
            setGameState={setGameState}
            onStartGame={handleStartGame}
            onRestartGame={handleRestartGame}
            onBuyWeapon={handleBuyWeapon}
            onBuyArmor={handleBuyArmor}
            onBuyHealth={handleBuyHealth}
            onSprayCar={handleSprayCar}
            onCloseShop={handleCloseShop}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onCompleteActiveMission={handleCompleteActiveMission}
          />

          {/* 3. MOBILE GAMEPLAY VIRTUAL CONTROLLER OVERLAY */}
          {isMobile && gameState.gameStatus === 'playing' && !gameState.shopOpen && (
            <MobileControls
              onControlChange={handleMobileControlChange}
              insideVehicle={!!gameState.player.insideVehicleId}
              currentWeapon={gameState.player.currentWeapon}
              onWeaponChangeTrigger={handleWeaponChangeTrigger}
            />
          )}
        </div>

      </div>

    </div>
  );
}
