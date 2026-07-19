import React, { useRef, useEffect, useState } from 'react';
import { GameState, Player, Car, Pedestrian, Bullet, Particle, Building, GameMission, Point, WeaponType, VehicleType, PedestrianType } from '../types';
import { WEAPON_INFOS } from './GameUI';
import { sound } from '../audio';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  mobileControls: {
    joystickX: number;
    joystickY: number;
    isJoystickActive: boolean;
    accelerate: boolean;
    reverse: boolean;
    drift: boolean;
    shoot: boolean;
    enterVehicle: boolean;
  };
  triggerWeaponChange: boolean;
}

// Map Configuration
const MAP_SIZE = 4000;
const ROAD_WIDTH = 120;
const SIDEWALK_WIDTH = 25;

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  setGameState,
  mobileControls,
  triggerWeaponChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const mousePosRef = useRef<Point>({ x: 0, y: 0 });
  const isMouseDownRef = useRef<boolean>(false);
  const gameStateRef = useRef<GameState>(gameState);
  
  const [nearBuilding, setNearBuilding] = useState<Building | null>(null);
  const nearBuildingRef = useRef<Building | null>(null);
  
  // Track viewport dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Synced ref to bypass React state delays in fast game loop
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      setDimensions({ width, height });
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set up Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = true;

      // Disable default browser behaviors for gaming keys (Arrows, Space)
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key)) {
        e.preventDefault();
      }

      // Enter/Exit Car toggle
      if (key === 'f') {
        toggleCarEntrance();
      }

      // Weapon switching
      if (key === 'q') {
        switchWeapon(-1);
      }
      if (key === 'e') {
        const state = gameStateRef.current;
        const activeMission = state.missions.find(m => m.id === state.activeMissionId);
        const inCar = !!state.player.insideVehicleId;
        let completedStep = false;

        if (activeMission && !inCar) {
          const step = activeMission.steps[activeMission.currentStepIndex];
          if (step && step.type === 'goto' && step.targetX && step.targetY) {
            const dist = Math.sqrt((state.player.x - step.targetX) ** 2 + (state.player.y - step.targetY) ** 2);
            if (dist < 120) {
              triggerMissionStepSuccessRef.current(activeMission.id);
              completedStep = true;
            }
          }
        }

        if (!completedStep) {
          const near = nearBuildingRef.current;
          const isSpray = near?.name?.includes('Spray Shop') || near?.name?.includes('Pay \'n\' Spray');
          const canEnter = near && (!inCar || isSpray);

          if (canEnter) {
            enterSpace(near);
          } else if (!inCar) {
            switchWeapon(1);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Listen to weapon change trigger from Mobile controller
  useEffect(() => {
    if (triggerWeaponChange) {
      switchWeapon(1);
    }
  }, [triggerWeaponChange]);

  // Handle Mouse movement/click
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mousePosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) { // Left click
      isMouseDownRef.current = true;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      isMouseDownRef.current = false;
    }
  };

  // --- WEAPON MECHANICS ---
  const switchWeapon = (direction: number) => {
    const state = gameStateRef.current;
    if (state.gameStatus !== 'playing') return;

    const owned = state.player.weaponsOwned;
    const currentIdx = owned.indexOf(state.player.currentWeapon);
    let nextIdx = currentIdx + direction;
    
    if (nextIdx >= owned.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = owned.length - 1;

    const nextWeapon = owned[nextIdx];
    
    setGameState(prev => ({
      ...prev,
      player: {
        ...prev.player,
        currentWeapon: nextWeapon
      }
    }));
    sound.playPunch(); // Feedback clack sound
  };

  // --- MISSION PROGRESS SUCCESS STEP TRIGGERS ---
  const triggerMissionStepSuccess = (missionId: string) => {
    sound.playMoney();
    setGameState(prev => {
      const updatedMissions = prev.missions.map(m => {
        if (m.id === missionId) {
          const nextIdx = m.currentStepIndex + 1;
          const completed = nextIdx >= m.steps.length;
          
          if (completed) {
            sound.playMissionComplete();
            return {
              ...m,
              currentStepIndex: nextIdx,
              status: 'completed' as const
            };
          } else {
            return {
              ...m,
              currentStepIndex: nextIdx
            };
          }
        }
        return m;
      });

      const targetMission = prev.missions.find(m => m.id === missionId);
      const isFullComplete = targetMission && (targetMission.currentStepIndex + 1 >= targetMission.steps.length);
      
      let nextActiveId = prev.activeMissionId;
      let extraCash = 0;
      let nextStatus = prev.gameStatus;

      if (isFullComplete && targetMission) {
        extraCash = targetMission.reward;
        nextActiveId = null;
        if (missionId === 'bank_robbery') {
          nextStatus = 'completed'; // Victory overlay
        }
      }

      // Lock-Step unlock next missions
      const finalMissions = updatedMissions.map(m2 => {
        if (isFullComplete) {
          if (missionId === 'intro_m' && m2.id === 'car_thief') {
            return { ...m2, status: 'available' as const };
          }
          if (missionId === 'car_thief' && m2.id === 'mob_hit') {
            return { ...m2, status: 'available' as const };
          }
          if (missionId === 'mob_hit' && m2.id === 'bank_robbery') {
            return { ...m2, status: 'available' as const };
          }
        }
        return m2;
      });

      return {
        ...prev,
        player: {
          ...prev.player,
          cash: prev.player.cash + extraCash
        },
        activeMissionId: nextActiveId,
        missions: finalMissions,
        gameStatus: nextStatus
      };
    });
  };

  const triggerMissionStepSuccessRef = useRef(triggerMissionStepSuccess);
  useEffect(() => {
    triggerMissionStepSuccessRef.current = triggerMissionStepSuccess;
  });

  // --- ENTER SPACE INTERIOR ---
  const enterSpace = (b: Building) => {
    if (!b.name) return;
    sound.playMoney();

    // Check if entering this building completes the active mission goto step
    const state = gameStateRef.current;
    const activeMission = state.missions.find(m => m.id === state.activeMissionId);
    if (activeMission) {
      const step = activeMission.steps[activeMission.currentStepIndex];
      if (step && step.type === 'goto' && step.targetX && step.targetY) {
        const centerX = b.x + b.width / 2;
        const centerY = b.y + b.height / 2;
        const distToPlayer = Math.sqrt((state.player.x - step.targetX) ** 2 + (state.player.y - step.targetY) ** 2);
        const distToBuilding = Math.sqrt((centerX - step.targetX) ** 2 + (centerY - step.targetY) ** 2);
        if (distToPlayer < 120 || distToBuilding < 150) {
          triggerMissionStepSuccess(activeMission.id);
        }
      }
    }

    setGameState(prev => {
      let shopType: 'ammu_nation' | 'burger_shot' | 'spray' | 'safehouse' | 'bank' | null = null;
      if (b.name.includes('Ammu-Nation')) shopType = 'ammu_nation';
      else if (b.name.includes('Burger Shot')) shopType = 'burger_shot';
      else if (b.name.includes('Spray Shop')) shopType = 'spray';
      else if (b.name.includes('Safehouse') || b.name.includes('보스 안가')) shopType = 'safehouse';
      else if (b.name.includes('Maze Bank') || b.name.includes('메이즈 은행')) shopType = 'bank';
      
      let extraCash = 0;
      let nextActiveMissionId = prev.activeMissionId;
      let updatedMissions = prev.missions;

      if (shopType === 'safehouse') {
        extraCash = 2000; // Give $2,000 when meeting the Boss (entering Safehouse)
      }

      return {
        ...prev,
        player: {
          ...prev.player,
          cash: prev.player.cash + extraCash
        },
        activeMissionId: nextActiveMissionId,
        missions: updatedMissions,
        shopOpen: shopType
      };
    });
  };

  // --- VEHICLE SEAT TOGGLE ---
  const toggleCarEntrance = () => {
    const state = gameStateRef.current;
    if (state.gameStatus !== 'playing') return;

    const { player, cars } = state;

    if (player.insideVehicleId) {
      // Exit vehicle
      const car = cars.find(c => c.id === player.insideVehicleId);
      if (!car) return;

      // Spawn player slightly to the left side of the vehicle
      const exitAngle = car.angle - Math.PI / 2;
      const exitX = car.x + Math.cos(exitAngle) * 35;
      const exitY = car.y + Math.sin(exitAngle) * 35;

      // Ensure exit position isn't outside world borders
      const safeX = Math.max(20, Math.min(MAP_SIZE - 20, exitX));
      const safeY = Math.max(20, Math.min(MAP_SIZE - 20, exitY));

      sound.setEngineSound(false);

      setGameState(prev => {
        const updatedCars = prev.cars.map(c => 
          c.id === car.id ? { ...c, isPlayerDriving: false, speed: 0 } : c
        );
        return {
          ...prev,
          player: {
            ...prev.player,
            insideVehicleId: null,
            x: safeX,
            y: safeY,
            angle: car.angle
          },
          cars: updatedCars
        };
      });
    } else {
      // Enter nearest vehicle within 60 pixels
      let nearestCar: Car | null = null;
      let minDist = 65;

      cars.forEach(car => {
        const dx = car.x - player.x;
        const dy = car.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist && car.health > 1) {
          minDist = dist;
          nearestCar = car;
        }
      });

      if (nearestCar) {
        const targetCar: Car = nearestCar;
        sound.setEngineSound(true, 0);

        // If stealing a car increases crime wanted factor if police nearby
        let addWanted = 0;
        const isPoliceNear = state.pedestrians.some(ped => 
          ped.type === 'police' && ped.state !== 'dead' && Math.sqrt((ped.x - player.x) ** 2 + (ped.y - player.y) ** 2) < 300
        );
        if (isPoliceNear && targetCar.type !== 'police') {
          addWanted = 40; // immediately triggers stars
        }

        // Stealing target vehicle check for active missions
        let triggerStepUpdate = false;
        const activeMission = state.missions.find(m => m.id === state.activeMissionId);
        if (activeMission) {
          const step = activeMission.steps[activeMission.currentStepIndex];
          if (step && step.type === 'steal_car' && (!step.targetVehicleType || step.targetVehicleType === targetCar.type)) {
            triggerStepUpdate = true;
          }
        }

        setGameState(prev => {
          const updatedCars = prev.cars.map(c => 
            c.id === targetCar.id ? { ...c, isPlayerDriving: true, aiActive: false } : c
          );

          let nextMissions = prev.missions;
          if (triggerStepUpdate && activeMission) {
            nextMissions = prev.missions.map(m => {
              if (m.id === activeMission.id) {
                const nextStepIdx = m.currentStepIndex + 1;
                const completed = nextStepIdx >= m.steps.length;
                return {
                  ...m,
                  currentStepIndex: nextStepIdx,
                  status: completed ? 'completed' : m.status
                };
              }
              return m;
            });
          }

          return {
            ...prev,
            player: {
              ...prev.player,
              insideVehicleId: targetCar.id,
              wantedPoints: prev.player.wantedPoints + addWanted,
              lastCrimeTime: addWanted > 0 ? Date.now() : prev.player.lastCrimeTime
            },
            cars: updatedCars,
            missions: nextMissions
          };
        });
      }
    }
  };

  // Listen to mobile seat trigger button
  useEffect(() => {
    if (mobileControls.enterVehicle) {
      toggleCarEntrance();
    }
  }, [mobileControls.enterVehicle]);

  // Main Canvas Setup Loop & Frame Animation
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();
    let shootCooldownTimer = 0;

    const gameLoop = (currentTime: number) => {
      let dt = (currentTime - lastTime) / 1000; // time slice in seconds
      lastTime = currentTime;

      // Clamp dt to avoid physics divergence, division by zero, or wild jumps during lag spikes
      if (isNaN(dt) || dt < 0) dt = 0.016;
      if (dt > 0.1) dt = 0.1;

      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const state = gameStateRef.current;
        const player = state.player;

      if (state.gameStatus === 'playing') {
        // --- 1. PLAYER INPUTS & PHYSICS ---
        let px = state.player.x;
        let py = state.player.y;
        let pAngle = state.player.angle;
        let pHealth = state.player.health;
        let pArmor = state.player.armor;
        let pStamina = state.player.stamina;
        let isMoving = false;

        const currentCar = state.player.insideVehicleId 
          ? state.cars.find(c => c.id === state.player.insideVehicleId) 
          : null;

        if (currentCar) {
          // --- CAR DRIVING PHYSICS ---
          let carSpeed = currentCar.speed;
          let carAngle = currentCar.angle;

          // Keyboard or Joystick driving
          let steer = 0;
          let accelInput = 0;

          if (mobileControls.isJoystickActive) {
            steer = mobileControls.joystickX * 1.5;
            // Map vertical joystick to gas/reverse if driving
            accelInput = -mobileControls.joystickY;
          } else {
            if (keysRef.current['a'] || keysRef.current['arrowleft']) steer = -1.2;
            if (keysRef.current['d'] || keysRef.current['arrowright']) steer = 1.2;
            if (keysRef.current['w'] || keysRef.current['arrowup']) accelInput = 1;
            if (keysRef.current['s'] || keysRef.current['arrowdown']) accelInput = -0.5;
          }

          // Force touch screen separate buttons override
          if (mobileControls.accelerate) accelInput = 1;
          if (mobileControls.reverse) accelInput = -0.4;
          if (mobileControls.drift) steer *= 1.6;

          // Steering rotates the car based on velocity
          const minTurnSpeed = 0.5;
          if (Math.abs(carSpeed) > minTurnSpeed) {
            const speedFactor = Math.min(1, Math.abs(carSpeed) / currentCar.maxSpeed);
            const steerDirection = carSpeed > 0 ? 1 : -1;
            carAngle += steer * 2.8 * speedFactor * steerDirection * dt;
          }

          // Apply Acceleration & Friction
          if (accelInput > 0) {
            carSpeed += currentCar.accel * accelInput * dt;
          } else if (accelInput < 0) {
            carSpeed += currentCar.accel * accelInput * dt; // brake / reverse
          } else {
            carSpeed *= currentCar.friction; // engine deceleration
          }

          // Clamp to boundaries
          if (carSpeed > currentCar.maxSpeed) carSpeed = currentCar.maxSpeed;
          if (carSpeed < -currentCar.maxSpeed * 0.35) carSpeed = -currentCar.maxSpeed * 0.35;

          // Drift tyre tracks spawning
          const isDrifting = mobileControls.drift || keysRef.current[' '];
          if (isDrifting && Math.abs(carSpeed) > 3) {
            carSpeed *= 0.98; // lose a bit of speed during skid
            if (Math.random() < 0.3) {
              sound.playTireScreech();
              // Spawn drift particles at rear tire positions
              spawnTireTrack(currentCar.x, currentCar.y, carAngle);
            }
          }

          // Move Car coordinates
          let nextCarX = currentCar.x + Math.cos(carAngle) * carSpeed * dt * 10;
          let nextCarY = currentCar.y + Math.sin(carAngle) * carSpeed * dt * 10;

          // World Boundaries
          nextCarX = Math.max(30, Math.min(MAP_SIZE - 30, nextCarX));
          nextCarY = Math.max(30, Math.min(MAP_SIZE - 30, nextCarY));

          // Building Collision for Car
          let crashed = false;
          state.buildings.forEach(b => {
            const buffer = 24; // vehicle bounding circle
            if (
              nextCarX > b.x - buffer && 
              nextCarX < b.x + b.width + buffer && 
              nextCarY > b.y - buffer && 
              nextCarY < b.y + b.height + buffer
            ) {
              crashed = true;
              // Bounce car back
              carSpeed = -carSpeed * 0.45;
              sound.playCrash();
              
              // Damage car
              const damageAmount = Math.min(50, Math.abs(carSpeed) * 35);
              currentCar.health = Math.max(0, currentCar.health - damageAmount);

              // Spawn metallic sparks
              for (let i = 0; i < 8; i++) {
                state.particles.push({
                  id: Math.random().toString(),
                  x: currentCar.x,
                  y: currentCar.y,
                  vx: (Math.random() - 0.5) * 8 + Math.cos(carAngle + Math.PI) * 4,
                  vy: (Math.random() - 0.5) * 8 + Math.sin(carAngle + Math.PI) * 4,
                  color: '#FFA500',
                  size: Math.random() * 2 + 1,
                  alpha: 1,
                  decay: 2.2,
                  life: 0.4,
                  maxLife: 0.4,
                  type: 'spark'
                });
              }
            }
          });

          // Apply physics updates to car in state
          if (!crashed) {
            currentCar.x = nextCarX;
            currentCar.y = nextCarY;
          }
          currentCar.speed = carSpeed;
          currentCar.angle = carAngle;

          // Align player inside car coordinates
          px = currentCar.x;
          py = currentCar.y;
          pAngle = carAngle;

          // Continuous engine sound ratio
          sound.setEngineSound(true, Math.abs(carSpeed) / currentCar.maxSpeed);

          // If car is destroyed, trigger explosion
          if (currentCar.health <= 0) {
            triggerCarExplosion(currentCar);
          }
        } else {
          // --- PLAYER FOOT MOVEMENT ---
          let dx = 0;
          let dy = 0;

          if (mobileControls.isJoystickActive) {
            dx = mobileControls.joystickX;
            dy = mobileControls.joystickY;
          } else {
            if (keysRef.current['a'] || keysRef.current['arrowleft']) dx = -1;
            if (keysRef.current['d'] || keysRef.current['arrowright']) dx = 1;
            if (keysRef.current['w'] || keysRef.current['arrowup']) dy = -1;
            if (keysRef.current['s'] || keysRef.current['arrowdown']) dy = 1;
          }

          if (dx !== 0 || dy !== 0) {
            isMoving = true;
            // Angle follows movement directions or mouse cursor direction
            if (mobileControls.isJoystickActive) {
              pAngle = Math.atan2(dy, dx);
            } else {
              // Face direction of keyboard movement by default
              pAngle = Math.atan2(dy, dx);
            }

            // Normalise diagonals
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;

            // Run speed vs walk
            const isSprinting = keysRef.current['shift'] && pStamina > 10;
            const walkSpeed = isSprinting ? 280 : 150;

            if (isSprinting) {
              pStamina = Math.max(0, pStamina - 45 * dt);
            } else {
              pStamina = Math.min(100, pStamina + 15 * dt);
            }

            let nextX = px + dx * walkSpeed * dt;
            let nextY = py + dy * walkSpeed * dt;

            // Collide with world boundaries
            nextX = Math.max(16, Math.min(MAP_SIZE - 16, nextX));
            nextY = Math.max(16, Math.min(MAP_SIZE - 16, nextY));

            // Collide player with Buildings
            let collides = false;
            state.buildings.forEach(b => {
              const buffer = 15;
              if (
                nextX > b.x - buffer && 
                nextX < b.x + b.width + buffer && 
                nextY > b.y - buffer && 
                nextY < b.y + b.height + buffer
              ) {
                collides = true;
              }
            });

            if (!collides) {
              px = nextX;
              py = nextY;
            }
          } else {
            pStamina = Math.min(100, pStamina + 25 * dt);
          }

          // If mouse is clicked, snap player angle towards mouse pointer in screen space
          if (isMouseDownRef.current && !mobileControls.isJoystickActive) {
            const screenCenterX = dimensions.width / 2;
            const screenCenterY = dimensions.height / 2;
            const mouseDx = mousePosRef.current.x - screenCenterX;
            const mouseDy = mousePosRef.current.y - screenCenterY;
            pAngle = Math.atan2(mouseDy, mouseDx);
          }
        }

        // --- PROXIMITY CHECK FOR ENTERABLE BUILDINGS ---
        let currentNearBuilding: Building | null = null;
        if (state.gameStatus === 'playing') {
          let nearestDist = Infinity;
          state.buildings.forEach(b => {
            if (b.type === 'shop' && b.name) {
              const buffer = 75; // Proximity detection radius in pixels
              // Check if player's coordinates (px, py) are near building bounding box
              if (
                px > b.x - buffer &&
                px < b.x + b.width + buffer &&
                py > b.y - buffer &&
                py < b.y + b.height + buffer
              ) {
                // Calculate distance from player to building center
                const centerX = b.x + b.width / 2;
                const centerY = b.y + b.height / 2;
                const dist = Math.sqrt((px - centerX) ** 2 + (py - centerY) ** 2);
                if (dist < nearestDist) {
                  nearestDist = dist;
                  currentNearBuilding = b;
                }
              }
            }
          });
        }

        const prevNearId = nearBuildingRef.current?.id || null;
        const nextNearId = currentNearBuilding?.id || null;
        if (prevNearId !== nextNearId) {
          nearBuildingRef.current = currentNearBuilding;
          setNearBuilding(currentNearBuilding);
        }

        // --- SHOOTING & COMBAT ---
        if (shootCooldownTimer > 0) {
          shootCooldownTimer -= dt * 1000;
        }

        const shouldShoot = (isMouseDownRef.current && !player.insideVehicleId) || mobileControls.shoot;
        if (shouldShoot && shootCooldownTimer <= 0) {
          const info = WEAPON_INFOS[player.currentWeapon];
          const hasAmmo = info.ammoCost === 0 || state.player.ammo[player.currentWeapon] > 0;

          if (hasAmmo) {
            shootCooldownTimer = info.fireRate;
            
            // Deduct ammo
            if (info.ammoCost > 0) {
              state.player.ammo[player.currentWeapon] -= info.ammoCost;
            }

            // Play gun trigger sound
            if (info.soundType === 'pistol') sound.playPistol();
            if (info.soundType === 'smg') sound.playSMG();
            if (info.soundType === 'shotgun') sound.playShotgun();
            if (info.soundType === 'rocket') sound.playRocketLaunch();
            if (info.soundType === 'punch') sound.playPunch();

            // Spawn muzzle flash & bullet casings if using firearm
            if (player.currentWeapon !== 'fist') {
              // Muzzle flash particle
              state.particles.push({
                id: Math.random().toString(),
                x: px + Math.cos(pAngle) * 22,
                y: py + Math.sin(pAngle) * 22,
                vx: 0,
                vy: 0,
                color: '#FFE4B5',
                size: 16,
                alpha: 1,
                decay: 8.0,
                life: 0.1,
                maxLife: 0.1,
                type: 'explosion_flash'
              });

              // Bullet casing
              state.particles.push({
                id: Math.random().toString(),
                x: px,
                y: py,
                vx: Math.cos(pAngle - Math.PI / 2) * 2 + (Math.random() - 0.5),
                vy: Math.sin(pAngle - Math.PI / 2) * 2 + (Math.random() - 0.5),
                color: '#DAA520',
                size: 2,
                alpha: 1,
                decay: 1.5,
                life: 0.5,
                maxLife: 0.5,
                type: 'casing'
              });
            }

            // Bullets mechanics
            if (player.currentWeapon === 'fist') {
              // Melee Punch collision box
              const punchX = px + Math.cos(pAngle) * 35;
              const punchY = py + Math.sin(pAngle) * 35;
              
              // Check pedestrians hit
              state.pedestrians.forEach(ped => {
                if (ped.state === 'dead') return;
                const dist = Math.sqrt((ped.x - punchX) ** 2 + (ped.y - punchY) ** 2);
                if (dist < 30) {
                  ped.health -= info.damage;
                  ped.state = ped.type === 'police' ? 'chasing' : 'fleeing';
                  ped.targetX = px;
                  ped.targetY = py;
                  ped.angle = Math.atan2(py - ped.y, px - ped.x);

                  // Wanted point penalty for assault
                  state.player.wantedPoints += 15;
                  state.player.lastCrimeTime = Date.now();

                  // Spawn tiny blood particle
                  spawnBlood(ped.x, ped.y, 4);
                }
              });
            } else if (player.currentWeapon === 'shotgun') {
              // Spawn 6 pellets spread
              for (let i = -2; i <= 2; i++) {
                const spreadAngle = pAngle + (i * 0.08) + (Math.random() - 0.5) * 0.05;
                state.bullets.push({
                  id: Math.random().toString(),
                  x: px + Math.cos(pAngle) * 22,
                  y: py + Math.sin(pAngle) * 22,
                  vx: Math.cos(spreadAngle) * info.bulletSpeed,
                  vy: Math.sin(spreadAngle) * info.bulletSpeed,
                  owner: 'player',
                  damage: info.damage,
                  range: info.range,
                  distanceTraveled: 0,
                  color: info.color,
                  size: 2.5,
                  isRocket: false
                });
              }
              // Gunshot sound alerts nearby pedestrians & increases wanted points
              alertNearbyPeds(px, py);
            } else {
              // Standard pistol, smg, rocket launcher single projectile
              const isRocket = player.currentWeapon === 'rocket';
              state.bullets.push({
                id: Math.random().toString(),
                x: px + Math.cos(pAngle) * 22,
                y: py + Math.sin(pAngle) * 22,
                vx: Math.cos(pAngle) * info.bulletSpeed,
                vy: Math.sin(pAngle) * info.bulletSpeed,
                owner: 'player',
                damage: info.damage,
                range: info.range,
                distanceTraveled: 0,
                color: info.color,
                size: isRocket ? 5 : 3,
                isRocket: isRocket
              });
              alertNearbyPeds(px, py);
            }
          }
        }

        // --- WANTED SYSTEM CALCULATION ---
        // Decays wanted points slowly over time if no crimes committed recently
        if (Date.now() - state.player.lastCrimeTime > 12000) {
          state.player.wantedPoints = Math.max(0, state.player.wantedPoints - dt * 2.5);
        }

        // Set stars based on raw wanted points
        let prevWantedLevel = state.player.wantedLevel;
        if (state.player.wantedPoints >= 180) state.player.wantedLevel = 5;
        else if (state.player.wantedPoints >= 120) state.player.wantedLevel = 4;
        else if (state.player.wantedPoints >= 70) state.player.wantedLevel = 3;
        else if (state.player.wantedPoints >= 30) state.player.wantedLevel = 2;
        else if (state.player.wantedPoints >= 5) state.player.wantedLevel = 1;
        else state.player.wantedLevel = 0;

        // Active sirens background chime trigger on state changes
        if (state.player.wantedLevel > 0) {
          sound.setSirenSound(true);
        } else {
          sound.setSirenSound(false);
        }

        // Auto regenerate health slowly if outside combat
        if (Date.now() - state.player.lastCrimeTime > 8000 && pHealth < pHealth * 0.4) {
          pHealth = Math.min(pHealth * 0.4, pHealth + dt * 2);
        }

        // Sync player data to state variables
        state.player.x = px;
        state.player.y = py;
        state.player.angle = pAngle;
        state.player.health = pHealth;
        state.player.armor = pArmor;
        state.player.stamina = pStamina;

        // Death state transition
        if (state.player.health <= 0) {
          sound.setEngineSound(false);
          sound.setSirenSound(false);
          state.gameStatus = 'gameover';
          sound.playMissionFailed();
        }

        // --- 2. BULLET LOGIC & COLLISION ---
        const activeBullets: Bullet[] = [];
        state.bullets.forEach(b => {
          b.x += b.vx;
          b.y += b.vy;
          b.distanceTraveled += Math.sqrt(b.vx ** 2 + b.vy ** 2);

          let bulletDestroyed = false;

          // Border check
          if (b.x < 0 || b.x > MAP_SIZE || b.y < 0 || b.y > MAP_SIZE) {
            bulletDestroyed = true;
          }

          // Bullet Range check
          if (b.distanceTraveled >= b.range) {
            bulletDestroyed = true;
          }

          // Building collision check
          state.buildings.forEach(building => {
            if (
              b.x > building.x && b.x < building.x + building.width &&
              b.y > building.y && b.y < building.y + building.height
            ) {
              bulletDestroyed = true;
              if (b.isRocket) {
                triggerExplosion(b.x, b.y);
              } else {
                // Spark particle
                state.particles.push({
                  id: Math.random().toString(),
                  x: b.x,
                  y: b.y,
                  vx: -b.vx * 0.2 + (Math.random() - 0.5) * 4,
                  vy: -b.vy * 0.2 + (Math.random() - 0.5) * 4,
                  color: '#FFFFFF',
                  size: 1.5,
                  alpha: 0.8,
                  decay: 3,
                  life: 0.3,
                  maxLife: 0.3,
                  type: 'spark'
                });
              }
            }
          });

          // Player Hit check (Only for enemy bullets)
          if (!bulletDestroyed && b.owner !== 'player') {
            const hitDist = Math.sqrt((b.x - state.player.x) ** 2 + (b.y - state.player.y) ** 2);
            if (hitDist < 16 && !state.player.insideVehicleId) {
              bulletDestroyed = true;
              damagePlayer(b.damage);
              spawnBlood(state.player.x, state.player.y, 6);
            }
          }

          // Pedestrian hit check
          if (!bulletDestroyed) {
            state.pedestrians.forEach(ped => {
              if (ped.state === 'dead' || ped.isFadingGray || bulletDestroyed) return;
              
              // Only hit ped if bullet owner isn't other friendly peds (e.g. police shooting police)
              const sameTeam = (b.owner === 'police' && ped.type === 'police');
              if (sameTeam) return;

              const dist = Math.sqrt((b.x - ped.x) ** 2 + (b.y - ped.y) ** 2);
              if (dist < 18) {
                bulletDestroyed = true;
                
                if (b.isRocket) {
                  triggerExplosion(b.x, b.y);
                } else {
                  // Increment shot count if hit by player
                  if (b.owner === 'player') {
                    ped.shotCount = (ped.shotCount || 0) + 1;
                  }

                  const isDeadlyHit = ped.health - b.damage <= 0 || (ped.shotCount !== undefined && ped.shotCount >= 5);

                  if (isDeadlyHit) {
                    ped.isFadingGray = true;
                    ped.fadeAlpha = 1.0;
                    ped.color = '#808080';
                    ped.state = 'dead';
                    sound.playPunch();

                    // If killed by player
                    if (b.owner === 'player') {
                      state.player.cash += ped.dropCash;
                      sound.playMoney();
                      checkMissionHitAchieved(ped);

                      // Red notification
                      state.killNotification = {
                        message: "당신은 사람을 죽였습니다!",
                        timestamp: Date.now()
                      };

                      // Wanted points
                      state.player.wantedPoints += ped.type === 'police' ? 45 : 25;
                      state.player.lastCrimeTime = Date.now();
                    }
                  } else {
                    ped.health -= b.damage;
                    spawnBlood(ped.x, ped.y, 8);

                    // Alert pedestrian to flee or engage
                    ped.state = ped.type === 'police' || ped.type === 'bodyguard' ? 'chasing' : 'fleeing';
                    ped.targetX = b.owner === 'player' ? state.player.x : b.x;
                    ped.targetY = b.owner === 'player' ? state.player.y : b.y;

                    // Crime factor if player shot civilian or police
                    if (b.owner === 'player') {
                      state.player.wantedPoints += ped.type === 'police' ? 45 : 25;
                      state.player.lastCrimeTime = Date.now();
                    }
                  }
                }
              }
            });
          }

          // Car hit check
          if (!bulletDestroyed) {
            state.cars.forEach(car => {
              if (bulletDestroyed) return;
              // Avoid hitting same vehicle player is driving from within
              if (car.id === state.player.insideVehicleId && b.owner === 'player') return;

              const dist = Math.sqrt((b.x - car.x) ** 2 + (b.y - car.y) ** 2);
              if (dist < 32) {
                bulletDestroyed = true;
                
                if (b.isRocket) {
                  triggerExplosion(b.x, b.y);
                } else {
                  car.health -= b.damage * 0.4;
                  sound.playCrash();

                  // Metallic sparks
                  for (let i = 0; i < 4; i++) {
                    state.particles.push({
                      id: Math.random().toString(),
                      x: b.x,
                      y: b.y,
                      vx: (Math.random() - 0.5) * 5,
                      vy: (Math.random() - 0.5) * 5,
                      color: '#FFA500',
                      size: 2,
                      alpha: 0.9,
                      decay: 2.5,
                      life: 0.35,
                      maxLife: 0.35,
                      type: 'spark'
                    });
                  }

                  if (car.health <= 0) {
                    triggerCarExplosion(car);
                  }
                }
              }
            });
          }

          if (!bulletDestroyed) {
            activeBullets.push(b);
          }
        });
        state.bullets = activeBullets;

        // --- 3. PEDESTRIAN AI LOGIC (Spawn & Actions) ---
        // Dynamically spawn civilians or police near player camera range
        managePedestrianSpawning(state);

        const activePedestrians: Pedestrian[] = [];
        state.pedestrians.forEach(ped => {
          if (ped.isFadingGray) {
            ped.fadeAlpha = (ped.fadeAlpha !== undefined ? ped.fadeAlpha : 1.0) - dt * 0.8;
            if (ped.fadeAlpha > 0) {
              activePedestrians.push(ped);
            }
            return;
          }

          if (ped.state === 'dead') {
            activePedestrians.push(ped);
            return;
          }

          // Gunshot sound alerting civilian state transitions
          if (ped.alertedByWeapon && ped.type === 'civilian') {
            ped.state = 'fleeing';
            // run directly away from player
            const pAngleAway = Math.atan2(ped.y - state.player.y, ped.x - state.player.x);
            ped.targetX = ped.x + Math.cos(pAngleAway) * 400;
            ped.targetY = ped.y + Math.sin(pAngleAway) * 400;
            ped.alertedByWeapon = false;
          }

          // State action execution
          const distToPlayer = Math.sqrt((ped.x - state.player.x) ** 2 + (ped.y - state.player.y) ** 2);

          if (ped.state === 'walking' || ped.state === 'patrolling') {
            // Walk randomly to targetNode
            const distToTarget = Math.sqrt((ped.x - ped.targetX) ** 2 + (ped.y - ped.targetY) ** 2);
            if (distToTarget < 20) {
              ped.targetX = ped.x + (Math.random() - 0.5) * 350;
              ped.targetY = ped.y + (Math.random() - 0.5) * 350;
              // clamp target to borders
              ped.targetX = Math.max(50, Math.min(MAP_SIZE - 50, ped.targetX));
              ped.targetY = Math.max(50, Math.min(MAP_SIZE - 50, ped.targetY));
            }

            // Patrol police look out for crimes
            if (ped.type === 'police' && state.player.wantedLevel > 0) {
              ped.state = 'chasing';
            }

            // Move pedestrian
            ped.angle = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
            ped.x += Math.cos(ped.angle) * ped.speed * dt;
            ped.y += Math.sin(ped.angle) * ped.speed * dt;
          } 
          else if (ped.state === 'fleeing') {
            const distToTarget = Math.sqrt((ped.x - ped.targetX) ** 2 + (ped.y - ped.targetY) ** 2);
            if (distToTarget < 20) {
              ped.state = 'walking'; // calmed down
            }
            // Move fast away
            ped.angle = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
            ped.x += Math.cos(ped.angle) * ped.maxSpeed * dt;
            ped.y += Math.sin(ped.angle) * ped.maxSpeed * dt;
          } 
          else if (ped.state === 'chasing' || ped.state === 'hostile') {
            // Police or bodyguards hunt player down
            ped.angle = Math.atan2(state.player.y - ped.y, state.player.x - ped.x);
            
            // Move towards player coordinate
            if (distToPlayer > 120) {
              ped.x += Math.cos(ped.angle) * ped.maxSpeed * dt;
              ped.y += Math.sin(ped.angle) * ped.maxSpeed * dt;
            }

            // Shooting weapons at player
            if (distToPlayer < 350 && !state.player.isDead) {
              if (ped.shootCooldown > 0) {
                ped.shootCooldown -= dt;
              } else {
                ped.shootCooldown = ped.type === 'police' ? 1.0 : 1.5; // fire rate
                
                // Shoot bullet toward player
                sound.playPistol();
                state.bullets.push({
                  id: Math.random().toString(),
                  x: ped.x + Math.cos(ped.angle) * 18,
                  y: ped.y + Math.sin(ped.angle) * 18,
                  vx: Math.cos(ped.angle) * 10,
                  vy: Math.sin(ped.angle) * 10,
                  owner: ped.type === 'police' ? 'police' : 'gang',
                  damage: ped.type === 'police' ? 12 : 8,
                  range: 350,
                  distanceTraveled: 0,
                  color: '#FF0000',
                  size: 2,
                  isRocket: false
                });
              }
            }

            // Lose aggo if player escapes far away and wanted level resets
            if (distToPlayer > 800 && state.player.wantedLevel === 0 && ped.type === 'police') {
              ped.state = 'walking';
            }
          }

          activePedestrians.push(ped);
        });
        state.pedestrians = activePedestrians;

        // --- 4. TRAFFIC & POLICE VEHICLES AI ---
        manageVehicleSpawning(state);

        state.cars.forEach(car => {
          if (car.isPlayerDriving) return;

          // Police cars chase player
          if (car.type === 'police' && state.player.wantedLevel > 0) {
            const distToPlayer = Math.sqrt((car.x - state.player.x) ** 2 + (car.y - state.player.y) ** 2);
            car.angle = Math.atan2(state.player.y - car.y, state.player.x - car.x);
            car.sirenOn = true;

            // Drive towards player
            if (distToPlayer > 60) {
              car.speed = Math.min(car.maxSpeed, car.speed + car.accel * dt);
              car.x += Math.cos(car.angle) * car.speed * dt * 10;
              car.y += Math.sin(car.angle) * car.speed * dt * 10;
            } else {
              // Ram player or stop and drop officers
              car.speed = 0;
              // Spawn officers on foot to engage
              if (Math.random() < 0.05) {
                spawnPoliceOfficersFromVehicle(car);
              }
            }

            // Damage player if police car rams player on foot
            if (distToPlayer < 40 && !state.player.insideVehicleId && car.speed > 1) {
              damagePlayer(Math.round(car.speed * 8));
              spawnBlood(state.player.x, state.player.y, 10);
              car.speed = 0;
            }
          } 
          else if (car.aiActive) {
            // Standard traffic movement along lanes
            const distToTarget = Math.sqrt((car.x - car.targetX) ** 2 + (car.y - car.targetY) ** 2);
            if (distToTarget < 35) {
              // Select random next road node
              const nextNode = findRandomRoadIntersection(car.x, car.y);
              car.targetX = nextNode.x;
              car.targetY = nextNode.y;
            }

            // Drive toward target node
            const targetAngle = Math.atan2(car.targetY - car.y, car.targetX - car.x);
            
            // Smooth steering rotation using robust trigonometric normalization (prevents infinite loops)
            let angleDiff = targetAngle - car.angle;
            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
            car.angle += angleDiff * 3.5 * dt;

            // Stop if player or another vehicle is in front
            let obstacleInFront = false;
            
            // Distance check to player
            const distToPlayer = Math.sqrt((car.x - state.player.x) ** 2 + (car.y - state.player.y) ** 2);
            if (distToPlayer < 120 && !state.player.insideVehicleId) {
              obstacleInFront = true;
            }

            if (obstacleInFront) {
              car.speed = Math.max(0, car.speed - car.accel * 2.5 * dt);
            } else {
              car.speed = Math.min(car.maxSpeed * 0.6, car.speed + car.accel * 0.8 * dt);
            }

            car.x += Math.cos(car.angle) * car.speed * dt * 10;
            car.y += Math.sin(car.angle) * car.speed * dt * 10;
          }
        });

        // --- 5. PARTICLE SYSTEM ANIMATION ---
        const activeParticles: Particle[] = [];
        state.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= dt;
          p.alpha = Math.max(0, p.life / p.maxLife);

          if (p.type === 'smoke') {
            p.size += dt * 8; // expand smoke cloud
            p.vx *= 0.96;
            p.vy *= 0.96;
          }

          if (p.life > 0) {
            activeParticles.push(p);
          }
        });
        state.particles = activeParticles;

        // --- 6. TIME OF DAY ENGINE ---
        state.timeOfDay = (state.timeOfDay + dt * 18) % 2400; // speed of game clock

        // --- 7. MISSION SYSTEM STATE UPDATER ---
        updateActiveMissionsCheck(state);

        // Commit all dynamic edits back to React State
        setGameState({ ...state });
      }

      // --- 8. CAMERA RENDERING FLOW ---
      const stateObj = gameStateRef.current;
      const playerObj = stateObj.player;

      // Center viewport camera on current player coordinates
      const camX = playerObj.x - dimensions.width / 2;
      const camY = playerObj.y - dimensions.height / 2;

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      ctx.save();
      ctx.translate(-camX, -camY);

      // --- DRAW BACKGROUND CITY GRASS & SAND MASK ---
      ctx.fillStyle = '#1D3B23'; // dark lush grass
      ctx.fillRect(-200, -200, MAP_SIZE + 400, MAP_SIZE + 400);

      // --- DRAW GRID CITY ROADS ---
      drawCityRoadsAndIntersections(ctx);

      // --- DRAW TYRE TRACK SKIDMARKS ---
      drawSkidtracks(ctx, stateObj.particles);

      // --- DRAW BUILDINGS & SHOPS ---
      drawCityBuildings(ctx, stateObj.buildings);

      // --- DRAW PEDESTRIANS ---
      drawPedestriansList(ctx, stateObj.pedestrians);

      // --- DRAW VEHICLES ---
      drawVehiclesList(ctx, stateObj.cars);

      // --- DRAW BULLETS ---
      drawBulletsList(ctx, stateObj.bullets);

      // --- DRAW GENERAL PARTICLES (Blood, Sparks, Fire, Smoke, Explosions) ---
      drawParticlesList(ctx, stateObj.particles);

      // --- DRAW SHOP & CRITICAL DESTINATIONS MARKERS ---
      drawDestinationMarkers(ctx, stateObj);

      ctx.restore();

      // --- DRAW COMPASS MINI-MAP OVERLAY (Top-Left side HUD) ---
      drawHUDMiniMap(ctx, stateObj);
      } catch (err) {
        console.error("Error in gameLoop:", err);
      } finally {
        // Schedule next frame
        animationId = requestAnimationFrame(gameLoop);
      }
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [dimensions, mobileControls]);

  // --- RENDERING DETAIL UTILITIES ---

  const drawCityRoadsAndIntersections = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#2C2C2C'; // Asphalt gray
    ctx.strokeStyle = '#D4AF37'; // Double-yellow traffic lines

    // Draw grid roads programmatically
    const gridIntervals = [500, 1500, 2500, 3500];

    // Horizontal roads
    gridIntervals.forEach(y => {
      ctx.fillRect(0, y - ROAD_WIDTH / 2, MAP_SIZE, ROAD_WIDTH);
      // Sidewalk path highlights
      ctx.fillStyle = '#4A4A4A';
      ctx.fillRect(0, y - ROAD_WIDTH / 2 - SIDEWALK_WIDTH, MAP_SIZE, SIDEWALK_WIDTH);
      ctx.fillRect(0, y + ROAD_WIDTH / 2, MAP_SIZE, SIDEWALK_WIDTH);
      ctx.fillStyle = '#2C2C2C';

      // Yellow lane lines
      ctx.beginPath();
      ctx.setLineDash([20, 15]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#E2B13C';
      ctx.moveTo(0, y);
      ctx.lineTo(MAP_SIZE, y);
      ctx.stroke();
    });

    // Vertical roads
    gridIntervals.forEach(x => {
      ctx.fillRect(x - ROAD_WIDTH / 2, 0, ROAD_WIDTH, MAP_SIZE);
      // Sidewalk path highlights
      ctx.fillStyle = '#4A4A4A';
      ctx.fillRect(x - ROAD_WIDTH / 2 - SIDEWALK_WIDTH, 0, SIDEWALK_WIDTH, MAP_SIZE);
      ctx.fillRect(x + ROAD_WIDTH / 2, 0, SIDEWALK_WIDTH, MAP_SIZE);
      ctx.fillStyle = '#2C2C2C';

      // Yellow lane lines
      ctx.beginPath();
      ctx.setLineDash([20, 15]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#E2B13C';
      ctx.moveTo(x, 0);
      ctx.lineTo(x, MAP_SIZE);
      ctx.stroke();
    });

    ctx.setLineDash([]); // Reset dash lines
  };

  const drawSkidtracks = (ctx: CanvasRenderingContext2D, particles: Particle[]) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    particles.forEach(p => {
      if (p.type === 'tire_track') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.fillRect(-6, -1.5, 12, 3);
        ctx.restore();
      }
    });
  };

  const drawCityBuildings = (ctx: CanvasRenderingContext2D, buildings: Building[]) => {
    buildings.forEach(b => {
      // 3D Isometric building styling using layers
      ctx.fillStyle = b.color; // facade wall
      ctx.fillRect(b.x, b.y, b.width, b.height);

      // Draw standard inner grid windows
      ctx.fillStyle = 'rgba(255, 235, 150, 0.25)'; // backlit glass glow
      const winCols = Math.floor(b.width / 40);
      const winRows = Math.floor(b.height / 40);
      
      for (let c = 1; c < winCols; c++) {
        for (let r = 1; r < winRows; r++) {
          ctx.fillRect(b.x + c * 40 - 5, b.y + r * 40 - 5, 10, 10);
        }
      }

      // Roof top lid
      ctx.fillStyle = b.roofColor;
      ctx.fillRect(b.x + 4, b.y + 4, b.width - 8, b.height - 8);

      // Store title headers if shop type
      if (b.type === 'shop' && b.name) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(b.name, b.x + b.width / 2, b.y + b.height / 2);
      }
    });
  };

  const drawPedestriansList = (ctx: CanvasRenderingContext2D, pedestrians: Pedestrian[]) => {
    pedestrians.forEach(ped => {
      if (ped.isFadingGray) {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(ped.angle);
        ctx.globalAlpha = ped.fadeAlpha !== undefined ? ped.fadeAlpha : 1.0;

        // Faded Gray body shoulders
        ctx.fillStyle = '#808080';
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Faded Head circle
        ctx.fillStyle = '#A0A0A0';
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        return;
      }

      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);

      if (ped.state === 'dead') {
        // Red death ring pool
        ctx.fillStyle = '#991B1B';
        ctx.beginPath();
        ctx.arc(-4, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        // Corpse visual block
        ctx.fillStyle = '#5A5A5A';
        ctx.fillRect(-12, -4, 20, 8);
        ctx.restore();
        return;
      }

      // Pedestrian styling: body, head, arms, weapon if hostile
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      // Body shoulders
      ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head circle
      ctx.fillStyle = '#F5C4A7'; // flesh
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Hands/Arm directions if aiming
      const isAggressive = ped.state === 'chasing' || ped.state === 'hostile';
      if (isAggressive) {
        ctx.fillStyle = '#F5C4A7';
        ctx.fillRect(5, -6, 8, 3); // holding gun pose
        ctx.fillStyle = '#333333';
        ctx.fillRect(10, -7, 4, 2); // weapon snout
      }

      ctx.restore();
    });

    // Draw Player manually
    const state = gameStateRef.current;
    if (!state.player.insideVehicleId) {
      ctx.save();
      ctx.translate(state.player.x, state.player.y);
      ctx.rotate(state.player.angle);

      // Flashlight or gun beam path highlight
      if (state.player.currentWeapon !== 'fist') {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
        ctx.lineWidth = 15;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(150, 0);
        ctx.stroke();
      }

      // Custom suit coat coloring
      ctx.fillStyle = '#111827'; // Black suit
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Gold chain details
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(3, 0, 5, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();

      // Skin head dot
      ctx.fillStyle = '#E5C4A7';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Sunglasses
      ctx.fillStyle = '#000000';
      ctx.fillRect(2.5, -3, 2, 2);
      ctx.fillRect(2.5, 1, 2, 2);

      // Gun holding pose
      if (state.player.currentWeapon !== 'fist') {
        ctx.fillStyle = '#E5C4A7';
        ctx.fillRect(6, -6, 10, 4.5);
        ctx.fillStyle = '#222'; // gun outline
        ctx.fillRect(12, -7.5, 7, 3);
      }

      ctx.restore();
    }
  };

  const drawVehiclesList = (ctx: CanvasRenderingContext2D, cars: Car[]) => {
    cars.forEach(car => {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);

      // Destroyed vehicle styling
      if (car.health <= 0) {
        ctx.fillStyle = '#1A1A1A'; // charred gray
        ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);
        
        // Spawn constant heavy engine smoke fire particles
        if (Math.random() < 0.1) {
          spawnBurnParticles(car.x, car.y);
        }
        ctx.restore();
        return;
      }

      // General vehicle body chassis
      ctx.fillStyle = car.color;
      ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);

      // Hood lines
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(car.width / 4, -car.height / 2, 4, car.height);

      // Front windshield window
      ctx.fillStyle = '#475569';
      ctx.fillRect(-car.width / 8, -car.height / 2 + 3, car.width / 2.5, car.height - 6);
      
      // Rear windshield window
      ctx.fillRect(-car.width / 2.5, -car.height / 2 + 3, car.width / 5, car.height - 6);

      // Headlights front glow paths
      ctx.fillStyle = 'rgba(255, 255, 224, 0.25)';
      ctx.beginPath();
      ctx.moveTo(car.width / 2, -car.height / 2 + 3);
      ctx.lineTo(car.width / 2 + 100, -car.height / 2 - 30);
      ctx.lineTo(car.width / 2 + 100, -car.height / 2 + 30);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(car.width / 2, car.height / 2 - 3);
      ctx.lineTo(car.width / 2 + 100, car.height / 2 - 30);
      ctx.lineTo(car.width / 2 + 100, car.height / 2 + 30);
      ctx.closePath();
      ctx.fill();

      // Red tail lights back indicators
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-car.width / 2, -car.height / 2 + 1.5, 2, 4);
      ctx.fillRect(-car.width / 2, car.height / 2 - 5.5, 2, 4);

      // Police Sirens Red-Blue flashing lights
      if (car.type === 'police' && car.sirenOn) {
        const flashes = Math.floor(Date.now() / 150) % 2 === 0;
        ctx.fillStyle = flashes ? '#3B82F6' : '#EF4444';
        ctx.fillRect(-4, -car.height / 2 + 4, 8, car.height - 8);
      }

      ctx.restore();
    });
  };

  const drawBulletsList = (ctx: CanvasRenderingContext2D, bullets: Bullet[]) => {
    bullets.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const drawParticlesList = (ctx: CanvasRenderingContext2D, particles: Particle[]) => {
    particles.forEach(p => {
      // Don't render tire tracks here since they are layered below buildings
      if (p.type === 'tire_track') return;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      ctx.beginPath();
      if (p.type === 'smoke' || p.type === 'explosion_flash') {
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.fill();
      ctx.restore();
    });
  };

  const drawDestinationMarkers = (ctx: CanvasRenderingContext2D, state: GameState) => {
    // Standard mission destinations drawing overlay
    const activeMission = state.missions.find(m => m.id === state.activeMissionId);
    
    // 1. BOSS SAFEHOUSE (Always visible)
    drawPulsingBeacon(ctx, 2000, 2000, '#EAB308', 'BOSS 안가');

    // 2. ACTIVE STEPS TARGETS
    if (activeMission && state.gameStatus === 'playing') {
      const step = activeMission.steps[activeMission.currentStepIndex];
      if (step && step.targetX && step.targetY) {
        drawPulsingBeacon(ctx, step.targetX, step.targetY, '#EF4444', '목표 지점');
      }
    }
  };

  const drawPulsingBeacon = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string) => {
    const scale = 1 + Math.sin(Date.now() / 200) * 0.22;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    
    // Wave ring
    ctx.beginPath();
    ctx.arc(x, y, 40 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Solid inner core
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Text name tag above
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 55);
  };

  const drawHUDMiniMap = (ctx: CanvasRenderingContext2D, state: GameState) => {
    // Position mini-map statically in bottom left viewport corner
    const offsetLeft = 40;
    const offsetBottom = 40;
    const mapRadius = 90;
    const miniX = offsetLeft + mapRadius;
    const miniY = dimensions.height - offsetBottom - mapRadius;

    ctx.save();
    
    // Draw boundary circle
    ctx.beginPath();
    ctx.arc(miniX, miniY, mapRadius, 0, Math.PI * 2);
    ctx.clip(); // Mask rendering area to inside the circle

    // Draw dark mini-map solid fill background
    ctx.fillStyle = '#1D3B23'; // grass density
    ctx.fillRect(miniX - mapRadius, miniY - mapRadius, mapRadius * 2, mapRadius * 2);

    // Render scaled down roads, targets, and player arrow
    const scale = 0.085; // zoom factor for 180px compass
    const px = state.player.x;
    const py = state.player.y;

    // Mini map translate to follow player
    ctx.save();
    ctx.translate(miniX, miniY);
    ctx.rotate(-state.player.angle - Math.PI/2); // Align maps to player face heading direction!

    // Draw Roads
    ctx.fillStyle = '#2C2C2C';
    const gridIntervals = [500, 1500, 2500, 3500];
    gridIntervals.forEach(roadY => {
      const relativeY = (roadY - py) * scale;
      ctx.fillRect(-mapRadius * 2, relativeY - (ROAD_WIDTH / 2) * scale, mapRadius * 4, ROAD_WIDTH * scale);
    });
    gridIntervals.forEach(roadX => {
      const relativeX = (roadX - px) * scale;
      ctx.fillRect(relativeX - (ROAD_WIDTH / 2) * scale, -mapRadius * 2, ROAD_WIDTH * scale, mapRadius * 4);
    });

    // Draw Shops, Safehouse, and Missions beacons
    // BOSS Safehouse
    ctx.fillStyle = '#EAB308';
    ctx.beginPath();
    ctx.arc((2000 - px) * scale, (2000 - py) * scale, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Burger Shot
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc((1000 - px) * scale, (1000 - py) * scale, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Ammu Nation
    ctx.fillStyle = '#06B6D4';
    ctx.beginPath();
    ctx.arc((3000 - px) * scale, (3000 - py) * scale, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Spray Garage
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc((1200 - px) * scale, (3000 - py) * scale, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Bank heist location
    ctx.fillStyle = '#A855F7';
    ctx.beginPath();
    ctx.arc((3000 - px) * scale, (3000 - py) * scale, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Active Police Cars on Map
    state.cars.forEach(car => {
      if (car.type === 'police' && car.health > 1) {
        ctx.fillStyle = '#3B82F6'; // Blue
        ctx.beginPath();
        ctx.arc((car.x - px) * scale, (car.y - py) * scale, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();

    // Draw Player Centered arrow in screen space (does not rotate)
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(miniX, miniY - 7);
    ctx.lineTo(miniX - 5, miniY + 7);
    ctx.lineTo(miniX, miniY + 4);
    ctx.lineTo(miniX + 5, miniY + 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Outer Chrome compass border frame
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(miniX, miniY, mapRadius, 0, Math.PI * 2);
    ctx.stroke();
  };

  // --- SPAWNING & RECYCLING UTILITIES ---

  const spawnTireTrack = (x: number, y: number, angle: number) => {
    gameStateRef.current.particles.push({
      id: Math.random().toString(),
      x: x - Math.cos(angle) * 15,
      y: y - Math.sin(angle) * 15,
      vx: 0,
      vy: 0,
      color: 'rgba(0, 0, 0, 0.45)',
      size: 10,
      alpha: 1,
      decay: 0.1,
      life: 6.0, // long skidmark persistence
      maxLife: 6.0,
      type: 'tire_track',
      angle: angle
    });
  };

  const spawnBlood = (x: number, y: number, count: number) => {
    for (let i = 0; i < count; i++) {
      gameStateRef.current.particles.push({
        id: Math.random().toString(),
        x,
        y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        color: '#DC2626', // deep crimson blood
        size: Math.random() * 4 + 2,
        alpha: 1,
        decay: 1.8,
        life: 1.2,
        maxLife: 1.2,
        type: 'blood'
      });
    }
  };

  const alertNearbyPeds = (x: number, y: number) => {
    gameStateRef.current.pedestrians.forEach(ped => {
      const dist = Math.sqrt((ped.x - x) ** 2 + (ped.y - y) ** 2);
      if (dist < 400 && ped.state !== 'dead') {
        ped.alertedByWeapon = true;
      }
    });
  };

  const damagePlayer = (amount: number) => {
    const state = gameStateRef.current;
    if (state.player.insideVehicleId) return; // vehicle absorbs hits

    let remaining = amount;
    if (state.player.armor > 0) {
      const armorAbsorbed = Math.min(state.player.armor, amount * 0.75);
      state.player.armor -= armorAbsorbed;
      remaining -= armorAbsorbed;
    }

    state.player.health = Math.max(0, state.player.health - remaining);
    state.player.lastCrimeTime = Date.now();
  };

  const triggerExplosion = (x: number, y: number) => {
    sound.playExplosion();
    const state = gameStateRef.current;

    // Flash particle
    state.particles.push({
      id: Math.random().toString(),
      x,
      y,
      vx: 0,
      vy: 0,
      color: '#FFE4B5',
      size: 90,
      alpha: 1,
      decay: 5,
      life: 0.25,
      maxLife: 0.25,
      type: 'explosion_flash'
    });

    // Dark smoke & fire balls
    for (let i = 0; i < 15; i++) {
      state.particles.push({
        id: Math.random().toString(),
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 11,
        vy: (Math.random() - 0.5) * 11,
        color: Math.random() < 0.4 ? '#EF4444' : '#4B5563', // fire/ash
        size: Math.random() * 25 + 10,
        alpha: 1,
        decay: 1.2,
        life: 0.8,
        maxLife: 0.8,
        type: 'smoke'
      });
    }

    // High damage blast wave to items nearby
    state.pedestrians.forEach(ped => {
      if (ped.state === 'dead') return;
      const dist = Math.sqrt((ped.x - x) ** 2 + (ped.y - y) ** 2);
      if (dist < 130) {
        ped.health -= 150 * (1 - dist / 130);
        spawnBlood(ped.x, ped.y, 10);
        if (ped.health <= 0) {
          ped.state = 'dead';
          if (ped.type === 'police') state.player.wantedPoints += 45;
          checkMissionHitAchieved(ped);
        }
      }
    });

    state.cars.forEach(car => {
      const dist = Math.sqrt((car.x - x) ** 2 + (car.y - y) ** 2);
      if (dist < 150) {
        car.health -= 200 * (1 - dist / 150);
        if (car.health <= 0) {
          triggerCarExplosion(car);
        }
      }
    });

    // Blast wave to player on foot
    const pDist = Math.sqrt((state.player.x - x) ** 2 + (state.player.y - y) ** 2);
    if (pDist < 120 && !state.player.insideVehicleId) {
      damagePlayer(Math.round(130 * (1 - pDist / 120)));
      spawnBlood(state.player.x, state.player.y, 12);
    }
  };

  const triggerCarExplosion = (car: Car) => {
    car.health = 0;
    triggerExplosion(car.x, car.y);
    
    // Eject player if driving
    if (car.isPlayerDriving) {
      setGameState(prev => ({
        ...prev,
        player: {
          ...prev.player,
          insideVehicleId: null,
          health: 0 // instantly dead on vehicle explosion
        }
      }));
    }
  };

  const spawnBurnParticles = (x: number, y: number) => {
    gameStateRef.current.particles.push({
      id: Math.random().toString(),
      x: x + (Math.random() - 0.5) * 15,
      y: y + (Math.random() - 0.5) * 15,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -Math.random() * 2.5 - 1.5,
      color: Math.random() < 0.35 ? '#FF4500' : '#2D3748',
      size: Math.random() * 6 + 4,
      alpha: 0.8,
      decay: 1.5,
      life: 0.6,
      maxLife: 0.6,
      type: 'smoke'
    });
  };

  // --- TRAFFIC & MOB ROAD HELPER INTERSECTION FINDERS ---

  const findRandomRoadIntersection = (x: number, y: number): Point => {
    const intersections: Point[] = [
      { x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 2500, y: 500 }, { x: 3500, y: 500 },
      { x: 500, y: 1500 }, { x: 1500, y: 1500 }, { x: 2500, y: 1500 }, { x: 3500, y: 1500 },
      { x: 500, y: 2500 }, { x: 1500, y: 2500 }, { x: 2500, y: 2500 }, { x: 3500, y: 2500 },
      { x: 500, y: 3000 }, { x: 1500, y: 3000 }, { x: 2500, y: 3000 }, { x: 3500, y: 3000 }
    ];
    
    // Pick node distinct from closest current coordinates
    const options = intersections.filter(n => Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2) > 250);
    return options[Math.floor(Math.random() * options.length)] || intersections[0];
  };

  const managePedestrianSpawning = (state: GameState) => {
    // Keep max 25 active civilians + police near player camera viewport coordinates
    const maxPeds = 30;
    const activePeds = state.pedestrians.filter(p => p.state !== 'dead');
    
    if (activePeds.length < maxPeds) {
      // Spawn ped just out of camera view bounds
      const spawnDist = 450;
      const angle = Math.random() * Math.PI * 2;
      const spawnX = state.player.x + Math.cos(angle) * spawnDist;
      const spawnY = state.player.y + Math.sin(angle) * spawnDist;

      // Ensure inside city borders
      if (spawnX > 30 && spawnX < MAP_SIZE - 30 && spawnY > 30 && spawnY < MAP_SIZE - 30) {
        
        // Decide Pedestrian details based on Wanted levels
        let type: PedestrianType = 'civilian';
        let speed = 40 + Math.random() * 30;
        let health = 45;
        let color = ['#38BDF8', '#F472B6', '#34D399', '#FB7185', '#FBBF24'][Math.floor(Math.random() * 5)]; // colorful clothes

        const isPoliceChaseSpawn = state.player.wantedLevel > 0 && Math.random() < 0.35;
        if (isPoliceChaseSpawn) {
          type = 'police';
          speed = 95;
          health = 80;
          color = '#1E3A8A'; // Navy Police Uniform
        }

        state.pedestrians.push({
          id: Math.random().toString(),
          type,
          state: type === 'police' ? 'chasing' : 'walking',
          x: spawnX,
          y: spawnY,
          angle: Math.random() * Math.PI * 2,
          speed,
          maxSpeed: speed * 1.5,
          health,
          maxHealth: health,
          color,
          targetX: spawnX + (Math.random() - 0.5) * 200,
          targetY: spawnY + (Math.random() - 0.5) * 200,
          shootCooldown: 0,
          isInsideVehicle: false,
          dropCash: Math.floor(Math.random() * 45) + 15,
          alertedByWeapon: false
        });
      }
    }
  };

  const spawnPoliceOfficersFromVehicle = (car: Car) => {
    const state = gameStateRef.current;
    for (let i = 0; i < 2; i++) {
      state.pedestrians.push({
        id: Math.random().toString(),
        type: 'police',
        state: 'chasing',
        x: car.x + (Math.random() - 0.5) * 45,
        y: car.y + (Math.random() - 0.5) * 45,
        angle: car.angle,
        speed: 105,
        maxSpeed: 145,
        health: 80,
        maxHealth: 80,
        color: '#1E3A8A', // Navy Police Uniform
        targetX: state.player.x,
        targetY: state.player.y,
        shootCooldown: 0.5,
        isInsideVehicle: false,
        dropCash: 50,
        alertedByWeapon: false
      });
    }
  };

  const manageVehicleSpawning = (state: GameState) => {
    const maxCars = 15;
    const activeCars = state.cars.filter(c => c.health > 0);

    if (activeCars.length < maxCars) {
      // Choose road lane coordinates
      const lanes = [500, 1500, 2500, 3500];
      const isHorizontal = Math.random() < 0.5;
      
      const spawnDist = 650;
      const angle = Math.random() * Math.PI * 2;
      const spawnX = state.player.x + Math.cos(angle) * spawnDist;
      const spawnY = state.player.y + Math.sin(angle) * spawnDist;

      // Find nearest coordinate intersections
      let closestLane = lanes[0];
      let minDist = Infinity;
      lanes.forEach(l => {
        const d = Math.abs((isHorizontal ? spawnY : spawnX) - l);
        if (d < minDist) {
          minDist = d;
          closestLane = l;
        }
      });

      const carX = isHorizontal ? spawnX : closestLane;
      const carY = isHorizontal ? closestLane : spawnY;

      if (carX > 50 && carX < MAP_SIZE - 50 && carY > 50 && carY < MAP_SIZE - 50) {
        
        // Spawn Details
        let type: VehicleType = ['sedan', 'sports', 'truck', 'taxi'][Math.floor(Math.random() * 4)] as VehicleType;
        let color = ['#DC2626', '#2563EB', '#16A34A', '#D97706', '#EAB308', '#000000', '#FFFFFF'][Math.floor(Math.random() * 7)];
        let maxSpeed = 160;
        let accel = 80;

        if (type === 'sports') {
          maxSpeed = 220;
          accel = 125;
        }

        // Spawn police cars dynamically if high wanted levels
        if (state.player.wantedLevel >= 2 && Math.random() < 0.4) {
          type = 'police';
          color = '#FFFFFF'; // White patrol car
          maxSpeed = 190;
          accel = 110;
        }

        const nextNode = findRandomRoadIntersection(carX, carY);

        state.cars.push({
          id: Math.random().toString(),
          type,
          x: carX,
          y: carY,
          angle: isHorizontal ? 0 : Math.PI / 2,
          speed: 25,
          maxSpeed,
          accel,
          friction: 0.98,
          color,
          health: 100,
          maxHealth: 100,
          width: type === 'truck' ? 56 : 48,
          height: type === 'truck' ? 24 : 20,
          isPlayerDriving: false,
          aiActive: type !== 'police',
          targetX: nextNode.x,
          targetY: nextNode.y,
          roadNodeIndex: 0,
          stopTimer: 0,
          sirenOn: false
        });
      }
    }
  };

  // --- DYNAMIC MISSION PROGRESS ACHIEVED TRACKER ---

  const checkMissionHitAchieved = (ped: Pedestrian) => {
    const state = gameStateRef.current;
    const activeMission = state.missions.find(m => m.id === state.activeMissionId);
    if (!activeMission) return;

    const step = activeMission.steps[activeMission.currentStepIndex];
    if (step && step.type === 'kill_target' && step.targetPedType === ped.type) {
      // Step up complete
      setGameState(prev => {
        const nextMissions = prev.missions.map(m => {
          if (m.id === activeMission.id) {
            const nextIdx = m.currentStepIndex + 1;
            return {
              ...m,
              currentStepIndex: nextIdx
            } as GameMission;
          }
          return m;
        });

        return {
          ...prev,
          missions: nextMissions
        };
      });
    }
  };

  const updateActiveMissionsCheck = (state: GameState) => {
    const activeMission = state.missions.find(m => m.id === state.activeMissionId);
    if (!activeMission) return;

    const step = activeMission.steps[activeMission.currentStepIndex];
    if (!step) {
      // All steps completed, but do not auto-complete!
      // Let the player click the manual "보상 수령 (Claim Reward)" button in the UI.
      return;
    }

    // Step condition checks
    if (step.type === 'escape_wanted') {
      // Survive 3-star police chases with no stars remaining
      if (state.player.wantedLevel === 0) {
        activeMission.currentStepIndex += 1;
        sound.playMoney();
      }
    }
  };

  const isInsideVehicle = !!gameState.player.insideVehicleId;
  const isSprayShop = nearBuilding?.name?.includes('Spray Shop') || nearBuilding?.name?.includes('Pay \'n\' Spray');
  const canEnter = !isInsideVehicle || isSprayShop;

  const activeMission = gameState.missions.find(m => m.id === gameState.activeMissionId);
  const currentStep = activeMission?.steps[activeMission.currentStepIndex];
  const isNearMissionTarget = !!(activeMission && currentStep && currentStep.type === 'goto' && currentStep.targetX && currentStep.targetY &&
    Math.sqrt((gameState.player.x - currentStep.targetX) ** 2 + (gameState.player.y - currentStep.targetY) ** 2) < 120);

  return (
    <div className="w-full h-full relative select-none">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className="w-full h-full block bg-slate-900 cursor-crosshair touch-none"
      />

      {isNearMissionTarget && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-24 bg-black/95 border-2 border-emerald-500 text-white px-6 py-4 rounded-2xl flex flex-col items-center gap-2 shadow-[0_10px_40px_rgba(16,185,129,0.5)] backdrop-blur-md pointer-events-auto select-none max-w-sm text-center z-25 animate-fade-in">
          <div className="text-[10px] uppercase font-mono tracking-[0.2em] text-emerald-400 font-bold animate-pulse">MISSION TARGET ARRIVED</div>
          <div className="font-extrabold text-sm uppercase tracking-tight text-white mb-0.5">
            {activeMission?.title === '로스 산토스 데뷔 (Meet Boss)' ? '보스 안가 도착' : '목표 지점 도착'}
          </div>
          
          {!gameState.player.insideVehicleId ? (
            <button 
              onClick={() => activeMission && triggerMissionStepSuccess(activeMission.id)}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg active:scale-95 pointer-events-auto cursor-pointer flex items-center gap-2 border border-emerald-400/30 animate-pulse animate-duration-1000"
            >
              <span className="bg-black text-emerald-400 font-mono text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold shadow-inner">E</span>
              <span>입장하기 / 미션 성공 (Enter & Complete)</span>
            </button>
          ) : (
            <div className="text-[10px] text-red-400 font-mono uppercase tracking-wider bg-red-950/40 border border-red-500/20 px-3 py-1.5 rounded-md">
              차량에서 내린 후 [E]를 눌러 입장 및 미션 완료
            </div>
          )}
        </div>
      )}

      {nearBuilding && !gameState.shopOpen && !isNearMissionTarget && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-20 bg-black/90 border border-yellow-500/30 text-white px-5 py-3.5 rounded-2xl flex flex-col items-center gap-2 shadow-[0_10px_30px_rgba(0,0,0,0.95)] backdrop-blur-md pointer-events-auto select-none max-w-xs text-center z-20 animate-fade-in">
          <div className="text-[10px] uppercase font-mono tracking-[0.15em] text-yellow-500 font-bold animate-pulse">Space Nearby</div>
          <div className="font-extrabold text-sm uppercase tracking-tight text-white mb-0.5">{nearBuilding.name}</div>
          
          {canEnter ? (
            <button 
              onClick={() => enterSpace(nearBuilding)}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black text-xs px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 pointer-events-auto cursor-pointer flex items-center gap-2 border border-yellow-400/30"
            >
              <span className="bg-black text-yellow-400 font-mono text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/20 font-bold shadow-inner">E</span>
              <span>입장하기 (Enter)</span>
            </button>
          ) : (
            <div className="text-[10px] text-red-400 font-mono uppercase tracking-wider bg-red-950/40 border border-red-500/20 px-2 py-1 rounded-md">
              차량에서 내린 후 입장 가능
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default GameCanvas;
