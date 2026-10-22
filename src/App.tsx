/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { useHandTracking } from './hooks/useHandTracking';
import { cn } from './lib/utils';
import { Eye, Hand, MousePointer2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, LayoutGrid, MoveHorizontal } from 'lucide-react';

const SHOWREEL_ITEMS = [
  {
    id: '01',
    title: 'Outage Alert & Work Order Creation',
    description: 'The platform detects an outage event and issues alerts to the admin and affected customers. The admin creates an emergency work order for resolution. Field workers are triggered once the work order is assigned.',
    buttonText: 'View Alert',
    x: 20,
    y: 50,
  },
  {
    id: '02',
    title: 'Route Details',
    description: 'The outage ticket is automatically assigned to the nearest qualified field worker using AI-powered scheduling and dispatching.',
    buttonText: 'View Route',
    x: 100,
    y: 50,
  },
  {
    id: '03',
    title: 'Asset Details',
    description: 'Field worker receives the job on their SmartWX mobile app with asset details, customer impact, and safety guidelines.',
    buttonText: 'View Asset Details',
    x: 180,
    y: 50,
  },
  {
    id: '04',
    title: 'Resolution & Reporting',
    description: 'Once the work is completed, the field worker updates the status and generates a report for the admin and customer.',
    buttonText: 'View Report',
    x: 260,
    y: 50,
  },
];

// Swipe detection constants
const SWIPE_VELOCITY_THRESHOLD = 0.001; // Lower is more sensitive
const SWIPE_COOLDOWN = 300; // ms

export default function App() {
  const { videoRef, handData } = useHandTracking();
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const [isManualMode, setIsManualMode] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs for swipe detection
  const lastXRef = useRef<number>(0.5);
  const lastTimeRef = useRef<number>(Date.now());
  const isSwipingRef = useRef<boolean>(false);

  useEffect(() => {
    // Simple timeout to hide loading screen once camera is likely ready
    const timer = setTimeout(() => setIsInitializing(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Smooth springs for hand tracking - ultra-premium fluidity
  const viewSpringConfig = { damping: 65, stiffness: 35, mass: 4 };
  const cursorSpringConfig = { damping: 45, stiffness: 200, mass: 0.5 }; // Faster but smoother than raw
  
  const smoothX = useSpring(0, viewSpringConfig);
  const smoothY = useSpring(0, viewSpringConfig);
  const smoothZoom = useSpring(1.0, viewSpringConfig);
  
  const cursorX = useSpring(0, cursorSpringConfig);
  const cursorY = useSpring(0, cursorSpringConfig);
  
  // Link cursor springs to hand data
  useEffect(() => {
    if (handData.isHandVisible) {
      cursorX.set(handData.x * window.innerWidth - 16);
      cursorY.set(handData.y * window.innerHeight - 16);
    }
  }, [handData.x, handData.y, handData.isHandVisible]);

  // Map activeIndex to precise pixel offset
  // Card width (400) + Gap (100) = 500px per step
  // Total width for 4 items: 400*4 + 100*3 = 1900px
  // Center of container is at 0. First item center is at -750px relative to container center.
  // So to center first item, we need x = 750.
  const targetX = useRef(750);
  
  useEffect(() => {
    activeIndexRef.current = activeIndex;
    targetX.current = 750 - (activeIndex * 500);
    smoothX.set(targetX.current);
    smoothY.set(0);
    smoothZoom.set(1.0);
  }, [activeIndex]);

  useEffect(() => {
    if (handData.isHandVisible && !isManualMode) {
      // Hand movement follows the opposite direction (inverted)
      // Reduced ranges for less sensitivity
      const panRangeX = 1200; 
      const panRangeY = 800;
      
      const offsetX = (0.5 - handData.x) * panRangeX;
      const offsetY = (0.5 - handData.y) * panRangeY;
      
      smoothX.set(targetX.current + offsetX);
      smoothY.set(offsetY);
      
      // Ultra-smooth zoom: range from 0.2 to 2.8
      const targetZoom = 0.2 + (handData.pinch * 2.6);
      smoothZoom.set(targetZoom);
    } else if (!handData.isHandVisible && !isManualMode) {
      // Reset to default centered view when hand disappears
      smoothX.set(targetX.current);
      smoothY.set(0);
      smoothZoom.set(1.0);
    }
  }, [handData.x, handData.y, handData.pinch, handData.isHandVisible, isManualMode]);

  // Detect card selection by hand cursor position
  useEffect(() => {
    if (handData.isHandVisible) {
      const x = handData.x * window.innerWidth;
      const y = handData.y * window.innerHeight;
      
      const element = document.elementFromPoint(x, y);
      const card = element?.closest('[data-card-index]');
      if (card) {
        const index = parseInt(card.getAttribute('data-card-index') || '0', 10);
        if (index !== activeIndexRef.current) {
          setActiveIndex(index);
        }
      }
    }
  }, [handData.x, handData.y, handData.isHandVisible]);

  // Handle manual navigation
  const goToItem = (index: number) => {
    setActiveIndex(index);
    setIsManualMode(true);
  };

  const nextItem = () => {
    setActiveIndex(prev => (prev + 1) % SHOWREEL_ITEMS.length);
    setIsManualMode(true);
  };

  const prevItem = () => {
    setActiveIndex(prev => (prev - 1 + SHOWREEL_ITEMS.length) % SHOWREEL_ITEMS.length);
    setIsManualMode(true);
  };

  // Swipe detection logic
  useEffect(() => {
    if (handData.isHandVisible) {
      const now = Date.now();
      const dt = now - lastTimeRef.current;
      const dx = handData.x - lastXRef.current;
      
      if (dt > 0 && dt < 100) {
        const velocity = dx / dt;
        
        if (Math.abs(velocity) > SWIPE_VELOCITY_THRESHOLD && !isSwipingRef.current) {
          if (velocity > 0) {
            prevItem();
            setSwipeDirection('right');
          } else {
            nextItem();
            setSwipeDirection('left');
          }
          
          isSwipingRef.current = true;
          setTimeout(() => {
            isSwipingRef.current = false;
            setSwipeDirection(null);
          }, SWIPE_COOLDOWN);
        }
      }
      
      lastXRef.current = handData.x;
      lastTimeRef.current = now;
    }
  }, [handData.x, handData.y, handData.isHandVisible]);

  // Resume hand tracking on hand movement
  useEffect(() => {
    if (handData.isHandVisible && isManualMode) {
      // If hand moves significantly from center, resume hand tracking
      const dist = Math.abs(handData.x - 0.5);
      if (dist > 0.2) {
        setIsManualMode(false);
      }
    }
  }, [handData.x, handData.isHandVisible, isManualMode]);

  // Transform values for the spatial canvas
  const translateX = smoothX;
  const translateY = smoothY;
  const scale = smoothZoom;

  return (
    <div className="relative w-full h-screen bg-[#0a0a0a] text-white overflow-hidden font-sans selection:bg-purple-500/30">
      {/* Loading Screen */}
      {isInitializing && (
        <motion.div 
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 2, duration: 1 }}
          className="fixed inset-0 z-[1000] bg-[#0a0a0a] flex flex-col items-center justify-center gap-6"
        >
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="absolute inset-0 border-4 border-t-purple-500 rounded-full"
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h2 className="text-xl font-black uppercase tracking-widest">Initializing</h2>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-40 font-bold">Spatial Engine v1.0</p>
          </div>
        </motion.div>
      )}

      {/* Hidden Video for MediaPipe */}
      <video
        ref={videoRef}
        className="absolute bottom-4 right-4 w-48 h-36 rounded-xl border border-white/10 opacity-60 pointer-events-none z-50 shadow-2xl shadow-purple-500/20"
        autoPlay
        playsInline
        muted
      />

      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      {/* HUD Overlay */}
      <div className="absolute top-8 left-8 z-50 flex flex-col gap-4">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full">
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            handData.isHandVisible ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500 shadow-[0_0_8px_#ef4444]"
          )} />
          <span className="text-[10px] uppercase tracking-widest font-semibold opacity-70">
            {handData.isHandVisible ? "Tracking Active" : "Searching for Hand"}
          </span>
        </div>
      </div>

      {/* Controls Legend */}
      <div className="absolute bottom-8 left-8 z-50 flex flex-col gap-4">
        <div className="flex gap-6">
          <div className="flex items-center gap-2 opacity-40">
            <Hand size={14} />
            <span className="text-[10px] uppercase tracking-wider font-bold">Move Hand to Pan</span>
          </div>
          <div className="flex items-center gap-2 opacity-40">
            <MoveHorizontal size={14} />
            <span className="text-[10px] uppercase tracking-wider font-bold">Swipe to Cycle</span>
          </div>
          <div className="flex items-center gap-2 opacity-40">
            <ZoomOut size={14} />
            <span className="text-[10px] uppercase tracking-wider font-bold">Pinch to Zoom Out/In</span>
          </div>
        </div>
      </div>

      {/* Spatial Canvas */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <motion.div
          ref={containerRef}
          style={{
            x: translateX,
            y: translateY,
            scale,
          }}
          className="flex items-center gap-[100px]"
        >
          {/* Connecting Line Background */}
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent -translate-y-1/2 pointer-events-none" />

          {/* Showreel Items */}
            {SHOWREEL_ITEMS.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ 
                  opacity: 1, 
                  x: 0,
                  y: activeIndex === index ? 0 : [0, Math.sin(index) * 15, 0],
                  scale: activeIndex === index ? 1.05 : [0.95, 0.97, 0.95],
                }}
                whileHover={{ scale: 1.1 }}
                transition={{ 
                  opacity: { delay: index * 0.1 },
                  x: { delay: index * 0.1 },
                  y: { 
                    duration: 4 + (index % 3), 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  },
                  scale: { 
                    duration: 3 + (index % 2), 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }
                }}
                className={cn(
                  "relative flex-shrink-0 w-[400px] group transition-all duration-500",
                  activeIndex === index ? "" : "opacity-40 grayscale-[0.5]"
                )}
              >
              <div className="relative flex flex-col gap-6">
                {/* Number Background */}
                <div className="absolute -top-16 -left-8 pointer-events-none">
                  <span className="text-[12rem] font-black italic text-white/[0.03] leading-none select-none">
                    {item.id}
                  </span>
                </div>

                {/* Card UI */}
                <div 
                  data-card-index={index}
                  className={cn(
                    "relative bg-gradient-to-br from-[#121212] via-[#1a122e] to-[#241a3d] border-2 p-8 rounded-[2rem] shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer",
                    activeIndex === index ? "border-purple-500/50 shadow-purple-500/20" : "border-white/5 group-hover:border-white/30"
                  )}
                >
                  {/* Card Glow */}
                  {activeIndex === index && (
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/20 blur-[80px] rounded-full" />
                  )}

                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-8 rounded-full transition-colors duration-500",
                        activeIndex === index ? "bg-purple-500" : "bg-white/10"
                      )} />
                      <span className="text-sm font-black uppercase tracking-[0.3em] text-purple-400">
                        Step {item.id}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5">
                      <LayoutGrid size={16} className="text-white/40" />
                    </div>
                  </div>
                  
                  <h2 className="text-3xl font-bold mb-4 leading-tight tracking-tight">
                    {item.title}
                  </h2>
                  
                  <p className="text-sm text-white/40 leading-relaxed font-medium">
                    {item.description}
                  </p>
                </div>

                {/* Connector Dot */}
                <div className={cn(
                  "absolute left-1/2 -bottom-12 w-4 h-4 -translate-x-1/2 rounded-full border-4 border-[#0a0a0a] transition-all duration-500",
                  activeIndex === index ? "bg-purple-500 scale-125 shadow-[0_0_20px_rgba(168,85,247,0.8)]" : "bg-white/10 scale-100"
                )} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Swipe Indicator Overlay */}
      <motion.div
        animate={{ 
          opacity: swipeDirection ? 1 : 0,
          x: swipeDirection === 'left' ? -100 : swipeDirection === 'right' ? 100 : 0
        }}
        className="fixed inset-0 pointer-events-none z-[200] flex items-center justify-center"
      >
        {swipeDirection && (
          <div className="bg-purple-500/20 backdrop-blur-3xl p-12 rounded-full border border-purple-500/30">
            {swipeDirection === 'left' ? <ChevronRight size={80} className="text-purple-500" /> : <ChevronLeft size={80} className="text-purple-500" />}
          </div>
        )}
      </motion.div>

      {/* Hand Cursor Visualization */}
      {handData.isHandVisible && (
        <>
          {/* Subtle Trail Effect */}
          {handData.trail.map((point, index) => (
            <motion.div
              key={point.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: (index / handData.trail.length) * 0.4, scale: index / handData.trail.length }}
              className="fixed top-0 left-0 w-6 h-6 pointer-events-none z-[90] rounded-full bg-purple-500/10 blur-[6px]"
              style={{
                x: point.x * window.innerWidth - 12,
                y: point.y * window.innerHeight - 12,
              }}
            />
          ))}
          
          <motion.div
            className="fixed top-0 left-0 w-8 h-8 pointer-events-none z-[100]"
            style={{
              x: cursorX,
              y: cursorY,
            }}
          >
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-md animate-ping" />
            <MousePointer2 className="text-purple-500 fill-purple-500" size={24} />
            
            {/* Pinch Indicator */}
            <motion.div 
              className="absolute -inset-4 border border-purple-500/30 rounded-full"
              style={{ scale: 1 + handData.pinch * 2 }}
            />
          </div>
        </motion.div>
      </>
    )}

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
    </div>
  );
}
