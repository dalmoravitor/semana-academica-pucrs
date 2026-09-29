import React, { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import type { CardPublic } from "../services/api";

interface Props {
  card: CardPublic;
  onSwipe: (direction: "real" | "ai") => void;
  disabled?: boolean;
  decision?: "real" | "ai" | null;
}

export const SwipeCard: React.FC<Props> = ({ card, onSwipe, disabled, decision = null }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useMotionValue(1);
  const opacityReal = useTransform(x, [0, 18, 140], [0, 0.42, 1]);
  const opacityAi = useTransform(x, [-140, -18, 0], [1, 0.42, 0]);
  const scaleReal = useTransform(x, [0, 140], [0.9, 1]);
  const scaleAi = useTransform(x, [-140, 0], [1, 0.9]);

  useEffect(() => {
    const exitNudge = decision === "real" ? 72 : decision === "ai" ? -72 : 0;
    const target = decision ? x.get() + exitNudge : 0;
    const animation = animate(x, target, {
      duration: decision ? 1 : 0.22,
      ease: [0.4, 0, 0.2, 1],
    });
    const fadeAnimation = animate(opacity, decision ? 0 : 1, {
      duration: decision ? 1 : 0.22,
      ease: [0.4, 0, 0.2, 1],
    });
    return () => {
      animation.stop();
      fadeAnimation.stop();
    };
  }, [decision, opacity, x]);

  const handleDrag = (_: any, info: any) => {
    opacity.set(Math.max(0, 1 - Math.abs(info.offset.x) / 500));
  };

  const handleDragEnd = (_: any, info: any) => {
    if (disabled) return;
    if (info.offset.x > 120) {
      onSwipe("real");
    } else if (info.offset.x < -120) {
      onSwipe("ai");
    } else {
      animate(opacity, 1, {
        duration: 0.22,
        ease: [0.4, 0, 0.2, 1],
      });
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      className="relative w-full h-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing border border-slate-700/80 select-none flex items-center justify-center"
    >
      {/* 1. Fundo com blur atmosférico preenchendo as bordas */}
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-2xl scale-125 opacity-40 pointer-events-none"
        style={{ backgroundImage: `url(${card.imageUrl})` }}
      />
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* 2. Imagem principal com object-contain (100% visível, sem cortes) */}
      <img
        src={card.imageUrl}
        alt="Desafio visual"
        className="relative z-10 max-w-full max-h-full object-contain p-2 rounded-2xl pointer-events-none drop-shadow-2xl"
      />

      {/* 3. Indicadores de swipe */}
      <motion.div
        style={{ opacity: opacityAi, scale: scaleAi }}
        className="absolute top-6 left-6 z-20 border-4 border-rose-500 text-rose-500 font-black px-4 py-1 rounded-xl text-2xl rotate-[-12deg] bg-slate-950/90 backdrop-blur-md shadow-xl pointer-events-none"
      >
        IA 🤖
      </motion.div>
      <motion.div
        style={{ opacity: opacityReal, scale: scaleReal }}
        className="absolute top-6 right-6 z-20 border-4 border-emerald-500 text-emerald-500 font-black px-4 py-1 rounded-xl text-2xl rotate-[12deg] bg-slate-950/90 backdrop-blur-md shadow-xl pointer-events-none"
      >
        REAL 📷
      </motion.div>

      {/* 4. Etiqueta da categoria */}
      <div className="absolute bottom-4 left-4 z-20">
        <span className="text-xs uppercase tracking-wider font-bold text-slate-200 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/80 shadow-md">
          {card.category === "wildlife" ? "🐾 Fauna Selvagem" : "🏛️ Arquitetura"}
        </span>
      </div>
    </motion.div>
  );
};