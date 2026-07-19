import React, { useState, useRef, useEffect } from 'react';
import { 
  Navigation, 
  RotateCw, 
  Flame, 
  User, 
  Key, 
  Compass,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { WeaponType } from '../types';

interface MobileControlsProps {
  onControlChange: (controls: {
    joystickX: number; // -1 to 1
    joystickY: number; // -1 to 1
    isJoystickActive: boolean;
    accelerate: boolean;
    reverse: boolean;
    drift: boolean;
    shoot: boolean;
    enterVehicle: boolean;
    nextWeapon: boolean;
  }) => void;
  insideVehicle: boolean;
  currentWeapon: WeaponType;
  onWeaponChangeTrigger: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onControlChange,
  insideVehicle,
  currentWeapon,
  onWeaponChangeTrigger
}) => {
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  
  // Keep track of button states
  const buttonStates = useRef({
    accelerate: false,
    reverse: false,
    drift: false,
    shoot: false,
    enterVehicle: false,
    nextWeapon: false
  });

  const joystickVector = useRef({ x: 0, y: 0 });

  // Update loop to push control change
  const pushControlUpdates = () => {
    onControlChange({
      joystickX: joystickVector.current.x,
      joystickY: joystickVector.current.y,
      isJoystickActive: isJoystickActive,
      ...buttonStates.current
    });
  };

  useEffect(() => {
    pushControlUpdates();
  }, [isJoystickActive, joystickPos]);

  // Handle touch events on Joystick
  const handleJoystickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsJoystickActive(true);
    handleJoystickMove(e);
  };

  const handleJoystickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!joystickRef.current) return;
    
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const touch = e.touches[0];
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    
    const maxRadius = rect.width / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    let targetX = dx;
    let targetY = dy;
    
    if (distance > maxRadius) {
      targetX = (dx / distance) * maxRadius;
      targetY = (dy / distance) * maxRadius;
    }
    
    setJoystickPos({ x: targetX, y: targetY });
    
    // Normalize vector to -1 to 1 range
    joystickVector.current = {
      x: targetX / maxRadius,
      y: targetY / maxRadius
    };
    
    pushControlUpdates();
  };

  const handleJoystickEnd = () => {
    setIsJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    joystickVector.current = { x: 0, y: 0 };
    pushControlUpdates();
  };

  // Helper to handle touch events for action buttons
  const setButton = (btn: keyof typeof buttonStates.current, value: boolean) => {
    buttonStates.current[btn] = value;
    pushControlUpdates();
  };

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none p-4 md:p-6 select-none flex justify-between items-end gap-4 z-20">
      
      {/* LEFT SIDE: STEERING / WALKING JOYSTICK */}
      <div className="pointer-events-auto flex items-center justify-center p-2">
        <div 
          ref={joystickRef}
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-[#050505]/85 border border-white/10 relative flex items-center justify-center shadow-[0_4px_24px_rgba(0,0,0,0.5)] backdrop-blur-md touch-none"
        >
          {/* Compass direction ring */}
          <div className="absolute inset-2 border border-dashed border-white/5 rounded-full flex items-center justify-center">
            <span className="absolute top-1 text-[8px] text-gray-500 font-mono font-bold">N</span>
            <span className="absolute bottom-1 text-[8px] text-gray-500 font-mono font-bold">S</span>
            <span className="absolute left-1 text-[8px] text-gray-500 font-mono font-bold">W</span>
            <span className="absolute right-1 text-[8px] text-gray-500 font-mono font-bold">E</span>
          </div>

          {/* Active indicator dot */}
          <div 
            className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#111] border border-white/20 absolute flex items-center justify-center shadow-lg active:scale-95 transition-shadow duration-100"
            style={{
              transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
            }}
          >
            <Compass className="w-5 h-5 text-yellow-500 animate-spin-slow" />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: CAR & CHARACTER CONTROLS */}
      <div className="pointer-events-auto flex flex-col gap-3 items-end p-2 min-w-[180px]">
        
        {/* Row 1: Action (Enter Car, Next Weapon) */}
        <div className="flex gap-3">
          {/* Next Weapon Button */}
          <button
            onTouchStart={() => {
              onWeaponChangeTrigger();
              buttonStates.current.nextWeapon = true;
              pushControlUpdates();
            }}
            onTouchEnd={() => {
              buttonStates.current.nextWeapon = false;
              pushControlUpdates();
            }}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#050505]/95 border border-cyan-500/20 text-cyan-400 flex items-center justify-center active:scale-90 shadow-lg backdrop-blur-md"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Enter/Exit Vehicle Button */}
          <button
            onTouchStart={() => setButton('enterVehicle', true)}
            onTouchEnd={() => setButton('enterVehicle', false)}
            className={`w-14 h-14 md:w-16 md:h-16 rounded-full border flex items-center justify-center active:scale-90 shadow-xl transition-all backdrop-blur-md ${
              insideVehicle 
                ? 'bg-[#050505]/95 border-red-500/30 text-red-400' 
                : 'bg-[#050505]/95 border-yellow-500/30 text-yellow-400'
            }`}
          >
            {insideVehicle ? (
              <User className="w-5 h-5" />
            ) : (
              <Key className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Row 2: Movement Speed & Drift / Combat (Shoot) */}
        <div className="flex gap-4 items-center mt-1">
          {insideVehicle ? (
            // driving layout
            <div className="flex gap-2.5 items-center">
              {/* Drift/Handbrake */}
              <button
                onTouchStart={() => setButton('drift', true)}
                onTouchEnd={() => setButton('drift', false)}
                className="w-12 h-12 rounded-full bg-[#050505]/95 border border-white/5 text-gray-400 flex items-center justify-center text-[10px] font-black tracking-widest uppercase active:scale-90 shadow-lg backdrop-blur-md"
              >
                SKID
              </button>

              {/* Brake / Reverse S */}
              <button
                onTouchStart={() => setButton('reverse', true)}
                onTouchEnd={() => setButton('reverse', false)}
                className="w-14 h-14 rounded-full bg-[#050505]/95 border border-red-500/20 text-red-400 flex items-center justify-center active:scale-90 shadow-lg backdrop-blur-md"
              >
                <ArrowDown className="w-5 h-5" />
              </button>

              {/* Gas / Accelerate W */}
              <button
                onTouchStart={() => setButton('accelerate', true)}
                onTouchEnd={() => setButton('accelerate', false)}
                className="w-16 h-16 rounded-full bg-[#050505]/95 border-2 border-[#45a049]/30 text-green-400 flex items-center justify-center active:scale-90 shadow-xl backdrop-blur-md"
              >
                <ArrowUp className="w-6 h-6 text-green-500" />
              </button>
            </div>
          ) : (
            // walking layout (just Shoot/Punch button)
            <div className="flex gap-3">
              <button
                onTouchStart={() => setButton('shoot', true)}
                onTouchEnd={() => setButton('shoot', false)}
                className="w-20 h-20 rounded-full bg-[#050505]/95 border-2 border-red-500/40 text-red-500 flex items-center justify-center active:scale-90 shadow-2xl backdrop-blur-md"
              >
                <Flame className="w-8 h-8 fill-red-500/20" />
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
export default MobileControls;
