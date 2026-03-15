import React from "react";
import { motion } from "motion/react";
import { LogIn } from "lucide-react";

/** Constantes del login: tamaños (px), textos y rutas. Ajustar aquí para cambiar la pantalla. */
export const LOGIN_CONFIG = {
  /** Ancho del GIF por breakpoint (altura automática para mantener proporción). */
  gifWidth: { mobile: 180, tablet: 220, desktop: 260 },
  /** Tamaño del contenedor del GIF (cuadrado aproximado). */
  containerSize: { mobile: 240, tablet: 280, desktop: 340 },
  /** GIF local (ruta pública). */
  mascotSrc: "/vima1.gif",
  logoSrc: "/vimafoods-logo.png",
  title: "¡Bienvenido a Vima Etiquetas!",
  /** Línea que presenta a la mascota por nombre. */
  mascotTagline: "Vimo, tu asistente",
  subtitle: "Soy Vimo, tu asistente de Vima Foods. Te doy la bienvenida al análisis de etiquetas con IA.",
  brandName: "Vima Etiquetas",
  ctaHint: "Inicia sesión con tu cuenta Microsoft para continuar.",
  ctaLabel: "Iniciar sesión con Microsoft",
  mascotAlt: "Vimo, mascota oficial de Vima Foods",
  logoAlt: "Vima Foods",
} as const;

type LoginScreenProps = { loginUrl: string };

export function LoginScreen({ loginUrl }: LoginScreenProps) {
  const { gifWidth, containerSize, mascotSrc, logoSrc, title, mascotTagline, subtitle, brandName, ctaHint, ctaLabel, mascotAlt, logoAlt } = LOGIN_CONFIG;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      role="main"
      aria-label="Pantalla de bienvenida e inicio de sesión"
    >
      {/* Fondo: degradado suave verde claro → blanco */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 25%, #f8faf8 50%, #ffffff 100%)",
        }}
      />
      {/* Halos y brillos sutiles */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background: "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(16, 185, 129, 0.08), transparent 50%)",
        }}
      />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%)" }}
      />
      {/* Decoración botánica sutil: esquinas inferiores */}
      <div
        className="absolute bottom-0 left-0 w-48 h-48 sm:w-64 sm:h-64 pointer-events-none opacity-[0.07]"
        style={{
          background: "radial-gradient(ellipse at 0% 100%, rgba(16, 185, 129, 0.4) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-48 h-48 sm:w-64 sm:h-64 pointer-events-none opacity-[0.07]"
        style={{
          background: "radial-gradient(ellipse at 100% 100%, rgba(16, 185, 129, 0.35) 0%, transparent 70%)",
        }}
      />

      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-[420px] rounded-3xl bg-white/95 backdrop-blur-md border border-white/80 shadow-xl shadow-black/5 flex flex-col items-center text-center px-8 py-10 sm:px-10 sm:py-12"
        style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)" }}
      >
        {/* Encabezado: título, presentación de Vimo y subtítulo */}
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight mb-1.5" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {title}
          </h1>
          <p className="text-sm font-semibold text-emerald-600 mb-2" aria-label="Mascota Vimo">
            {mascotTagline}
          </p>
          <p className="text-sm sm:text-base text-zinc-600 leading-relaxed max-w-[320px] mx-auto">
            {subtitle}
          </p>
        </header>

        {/* Contenedor de la mascota: glow, bordes, sombra — responsive según LOGIN_CONFIG */}
        <motion.div
          data-login-mascot-box
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex items-center justify-center rounded-2xl mb-8 w-[240px] h-[240px] sm:w-[280px] sm:h-[280px] lg:w-[340px] lg:h-[340px] transition-shadow duration-300 hover:shadow-emerald-500/15"
          style={{
            boxShadow: "0 0 0 1px rgba(16, 185, 129, 0.12), 0 8px 30px -10px rgba(16, 185, 129, 0.2), 0 4px 20px -8px rgba(0,0,0,0.08)",
            background: "linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(236, 253, 245, 0.5) 100%)",
          }}
        >
          <img
            src={mascotSrc}
            alt={mascotAlt}
            width={gifWidth.desktop}
            height={gifWidth.desktop}
            className="object-contain object-center w-[180px] h-auto sm:w-[220px] lg:w-[260px]"
            loading="eager"
            decoding="async"
          />
        </motion.div>

        {/* Branding */}
        <div className="flex flex-col items-center gap-1 mb-2">
          <img src={logoSrc} alt={logoAlt} className="w-24 h-auto object-contain opacity-90 mb-1" />
          <p className="text-lg sm:text-xl font-bold text-zinc-900 tracking-tight">{brandName}</p>
          <p className="text-xs sm:text-sm text-zinc-500">{ctaHint}</p>
        </div>

        {/* CTA principal */}
        <a
          href={loginUrl}
          className="mt-8 w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 hover:bg-emerald-600 active:scale-[0.98]"
          style={{
            backgroundColor: "#059669",
            boxShadow: "0 4px 14px 0 rgba(5, 150, 105, 0.35)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#047857";
            e.currentTarget.style.boxShadow = "0 6px 20px 0 rgba(5, 150, 105, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#059669";
            e.currentTarget.style.boxShadow = "0 4px 14px 0 rgba(5, 150, 105, 0.35)";
          }}
        >
          <LogIn className="w-5 h-5 flex-shrink-0" aria-hidden />
          <span>{ctaLabel}</span>
        </a>
      </motion.article>
    </div>
  );
}
