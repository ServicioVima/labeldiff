import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";

/** Constantes del login: rutas, textos y copy. */
export const LOGIN_CONFIG = {
  backgroundSrc: "/imagenfondo.png",
  videoSrc: "/VIMOVIDEO.mp4",
  mascotSrc: "/vima1.gif",
  logoSrc: "/vimafoods-logo.png",
  title: "¡Bienvenido a Vima Etiquetas!",
  helloLabel: "Hola, soy Vimo",
  tagline: "Tu asistente para analizar etiquetas con inteligencia artificial.",
  features: [
    "Analiza ingredientes",
    "Detecta alérgenos",
    "Comprende etiquetas automáticamente",
  ] as const,
  ctaLabel: "Iniciar sesión con Microsoft",
  mascotAlt: "Vimo, mascota oficial de Vima Foods",
  logoAlt: "Vima Foods",
} as const;

/** Icono Microsoft (4 cuadrados) para el botón de login. */
function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none" aria-hidden>
      <path fill="#F25022" d="M1 1h9v9H1z" />
      <path fill="#7FBA00" d="M11 1h9v9h-9z" />
      <path fill="#00A4EF" d="M1 11h9v9H1z" />
      <path fill="#FFB900" d="M11 11h9v9h-9z" />
    </svg>
  );
}

type LoginScreenProps = { loginUrl: string };

export function LoginScreen({ loginUrl }: LoginScreenProps) {
  const { backgroundSrc, videoSrc, mascotSrc, logoSrc, title, helloLabel, tagline, features, ctaLabel, mascotAlt, logoAlt } = LOGIN_CONFIG;
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden"
      role="main"
      aria-label="Pantalla de bienvenida e inicio de sesión"
    >
      {/* Fondo: imagen de campo + hexágonos (imagenfondo.png) */}
      <div className="absolute inset-0 z-0">
        <img
          src={backgroundSrc}
          alt=""
          className="w-full h-full object-cover object-center"
          fetchPriority="high"
        />
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.4) 50%, rgba(0,0,0,0.08) 100%)",
          }}
        />
      </div>

      {/* Contenido: card + Vimo */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
        {/* Card de login: semitransparente, redondeada, sombra */}
        <motion.article
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-[420px] rounded-3xl bg-white/92 backdrop-blur-md border border-white/90 shadow-2xl shadow-black/10 flex flex-col px-8 py-10 sm:px-10 sm:py-12"
          style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.8)" }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src={logoSrc} alt={logoAlt} className="h-10 w-auto object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight text-center mb-4">
            {title}
          </h1>
          {/* Hola, soy Vimo + tagline */}
          <p className="flex items-center justify-center gap-2 text-zinc-800 font-semibold mb-1">
            <span role="img" aria-label="Saludo">👋</span> {helloLabel}
          </p>
          <p className="text-sm text-zinc-600 text-center mb-6 leading-relaxed">
            {tagline}
          </p>
          {/* Lista de beneficios con check verde */}
          <ul className="space-y-3 mb-8" aria-label="Beneficios">
            {features.map((text, i) => (
              <li key={i} className="flex items-center gap-3 text-zinc-700 text-sm">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                  <Check className="w-3 h-3" strokeWidth={3} />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          {/* Botón Microsoft: blanco, logo 4 cuadrados, texto gris */}
          <a
            href={loginUrl}
            className="w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-white border border-zinc-200/90 text-zinc-800 font-medium shadow-lg shadow-black/5 hover:bg-zinc-50 hover:shadow-xl hover:border-zinc-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-[0.98]"
          >
            <MicrosoftLogo className="w-5 h-5 flex-shrink-0" />
            <span>{ctaLabel}</span>
          </a>
        </motion.article>

        {/* Vimo: a la derecha de la card en desktop, debajo en móvil */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.45 }}
          className="flex-shrink-0 flex items-end justify-center w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] lg:w-[280px] lg:h-[280px]"
        >
          {prefersReducedMotion ? (
            <img
              src={mascotSrc}
              alt={mascotAlt}
              className="w-full h-full object-contain object-bottom"
              loading="eager"
              decoding="async"
            />
          ) : (
            <video
              src={videoSrc}
              poster={mascotSrc}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="w-full h-full object-contain object-bottom"
              aria-label={mascotAlt}
              title={mascotAlt}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
