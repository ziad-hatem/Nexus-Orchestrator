"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Network,
  Workflow,
  ShieldCheck,
  Database,
  Terminal,
  Quote,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { Particles } from "./medusae";

const WordReveal = ({
  text,
  delay = 0,
  className = "",
  wordClassName = "",
  disabled = false,
}: {
  text: string;
  delay?: number;
  className?: string;
  wordClassName?: string;
  disabled?: boolean;
}) => {
  const words = text.split(" ");

  if (disabled) {
    return (
      <span className={`inline-block ${className}`}>
        {words.map((word, i) => (
          <span key={i} className={`inline-block mr-[0.25em] ${wordClassName}`}>
            {word}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className={`inline-block ${className}`}>
      {words.map((word, i) => (
        <span
          key={i}
          className={`inline-block overflow-hidden mr-[0.25em] pb-[0.1em]`}
        >
          <motion.span
            className={`inline-block ${wordClassName}`}
            initial={{ y: "120%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
              delay: delay + i * 0.08,
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
};

function useLandingPerformanceMode() {
  const prefersReducedMotion = useReducedMotion();
  const [isConstrained, setIsConstrained] = useState(false);

  useEffect(() => {
    const update = () => {
      const nav = navigator as Navigator & {
        connection?: { saveData?: boolean };
        deviceMemory?: number;
      };
      const isMobileViewport = window.matchMedia("(max-width: 767px)").matches;
      const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const saveData =
        typeof nav.connection === "object" &&
        nav.connection &&
        "saveData" in nav.connection
          ? Boolean(nav.connection.saveData)
          : false;
      const deviceMemory =
        typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
      const lowCoreCount =
        typeof navigator.hardwareConcurrency === "number" &&
        navigator.hardwareConcurrency > 0 &&
        navigator.hardwareConcurrency <= 4;

      setIsConstrained(
        isMobileViewport ||
          hasCoarsePointer ||
          saveData ||
          (deviceMemory !== null && deviceMemory <= 4) ||
          lowCoreCount,
      );
    };

    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  return {
    reducedMotion: prefersReducedMotion,
    constrainedMotion: prefersReducedMotion || isConstrained,
  };
}

const Navbar = ({ constrainedMotion }: { constrainedMotion: boolean }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (constrainedMotion) {
      setIsScrolled(true);
      return;
    }

    let ticking = false;
    const handleScroll = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 20);
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [constrainedMotion]);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? "glass-panel py-3 shadow-sm" : "bg-transparent py-5"}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 premium-gradient rounded-lg flex items-center justify-center shadow-sm">
            <Network className="text-(--on-primary) w-5 h-5" />
          </div>
          <span className="text-lg sm:text-xl font-black tracking-tight text-on-surface truncate">
            Nexus<span className="hidden sm:inline"> Orchestrator</span>
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <Link
            href="/login"
            className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="premium-gradient text-(--on-primary) px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform active:scale-95 inline-block shadow-[0_8px_16px_rgba(0,95,158,0.12)]"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
};

const Hero = ({ constrainedMotion }: { constrainedMotion: boolean }) => {
  const containerRef = useRef<HTMLElement>(null);
  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center pt-20 overflow-hidden"
    >
      <div className="absolute inset-0 z-0 bg-(--surface)">
        {!constrainedMotion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2, delay: 1.5 }}
            className="absolute inset-0 z-0 pointer-events-auto"
          >
            <Canvas
              eventSource={containerRef as any}
              camera={{ position: [0, 0, 5] }}
              gl={{ alpha: true }}
            >
              <Particles />
            </Canvas>
          </motion.div>
        )}
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none opacity-10 ${
            constrainedMotion ? "h-full w-full" : "h-[120%] w-[120%]"
          }`}
        >
          <div
            className={`absolute inset-0 bg-[radial-gradient(circle_at_center,var(--color-primary)_0%,transparent_70%)] ${
              constrainedMotion ? "blur-[56px]" : "blur-[120px]"
            }`}
          />
        </div>
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-surface/50 to-surface pointer-events-none" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full pointer-events-none">
        <div className="max-w-4xl">
          {constrainedMotion ? (
            <span className="inline-block px-4 py-1.5 mb-8 text-[10px] font-bold tracking-[0.2em] uppercase bg-surface-container-high text-primary rounded-full">
              Enterprise Automation OS
            </span>
          ) : (
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-block px-4 py-1.5 mb-8 text-[10px] font-bold tracking-[0.2em] uppercase bg-surface-container-high text-primary rounded-full"
            >
              Enterprise Automation OS
            </motion.span>
          )}
          <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-none mb-8 text-on-surface">
            <WordReveal
              text="Architecting the Future of"
              delay={0.2}
              disabled={constrainedMotion}
            />
            <br className="hidden md:block" />
            <WordReveal
              text="Nexus Orchestrator"
              delay={0.2 + 4 * 0.08}
              wordClassName="text-gradient"
              disabled={constrainedMotion}
            />
          </h1>
          {constrainedMotion ? (
            <p className="text-xl md:text-2xl text-on-surface-variant mb-12 max-w-2xl leading-relaxed relative z-10">
              Scale operations globally with high-performance multi-tenancy,
              sophisticated visual orchestration, and military-grade isolation.
            </p>
          ) : (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="text-xl md:text-2xl text-on-surface-variant mb-12 max-w-2xl leading-relaxed relative z-10"
            >
              Scale operations globally with high-performance multi-tenancy,
              sophisticated visual orchestration, and military-grade isolation.
            </motion.p>
          )}
          {constrainedMotion ? (
            <div className="flex flex-wrap gap-4 pointer-events-auto">
              <Link
                href="/register"
                className="premium-gradient text-(--on-primary) px-8 py-4 rounded-xl font-bold text-lg shadow-[0_12px_28px_rgba(0,95,158,0.18)] transition-opacity active:scale-95 inline-block"
              >
                Get Started
              </Link>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="flex flex-wrap gap-4 pointer-events-auto"
            >
              <Link
                href="/register"
                className="premium-gradient text-(--on-primary) px-8 py-4 rounded-xl font-bold text-lg shadow-[0_12px_28px_rgba(0,95,158,0.18)] hover:scale-105 transition-transform active:scale-95 inline-block"
              >
                Get Started
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
};

const TrustBar = () => (
  <section className="py-16 bg-surface-container-low/30 border-y border-outline-variant/10">
    <div className="max-w-7xl mx-auto px-6">
      <p className="text-center text-[10px] font-bold tracking-[0.2em] uppercase text-on-surface-variant/60 mb-10">
        Trusted by Global Leaders
      </p>
      <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
        {[
          "NEXUS_CORP",
          "QUANTUM_SYS",
          "VANTAGE_PEAK",
          "AETHER_IND",
          "STRATOS_AI",
        ].map((name) => (
          <div
            key={name}
            className="text-xl font-black tracking-tighter text-on-surface"
          >
            {name}
          </div>
        ))}
      </div>
    </div>
  </section>
);

const Features = ({ constrainedMotion }: { constrainedMotion: boolean }) => {
  const pillars = [
    {
      icon: <Network className="w-8 h-8" />,
      title: "Multi-Tenant Isolation",
      desc: "Hardware-level segregation for every tenant. Maintain strict data residency and compliance boundaries across global regions.",
    },
    {
      icon: <Workflow className="w-8 h-8" />,
      title: "Visual Workflow Builder",
      desc: "Design complex logic with a high-fidelity drag-and-drop interface. Real-time debugging and version control built-in.",
    },
    {
      icon: <ShieldCheck className="w-8 h-8" />,
      title: "Enterprise-Grade Security",
      desc: "Zero-trust architecture with end-to-end encryption. Granular RBAC, audit logging, and automated threat detection.",
    },
  ];

  return (
    <section className="py-32 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {pillars.map((p, i) => (
          <motion.div
            key={i}
            whileHover={constrainedMotion ? undefined : { y: -10 }}
            transition={constrainedMotion ? { duration: 0 } : undefined}
            className={`group bg-surface-container-lowest p-10 rounded-[2.5rem] border border-outline-variant/10 ambient-shadow ${
              constrainedMotion
                ? "transition-colors duration-200"
                : "hover:bg-primary transition-all duration-500"
            }`}
          >
            <div className="w-16 h-16 bg-surface-container-high rounded-2xl flex items-center justify-center mb-8 group-hover:bg-white/10 transition-colors">
              <div className="text-primary group-hover:text-white transition-colors">
                {p.icon}
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-4 group-hover:text-white transition-colors">
              {p.title}
            </h3>
            <p className="text-on-surface-variant group-hover:text-white/80 leading-relaxed transition-colors">
              {p.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

const DeepDive = () => (
  <section className="py-32 bg-surface-container-low/50 overflow-hidden">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div>
          <span className="text-primary font-bold tracking-[0.2em] text-[10px] uppercase mb-6 block">
            Engineered for Complexity
          </span>
          <h2 className="text-4xl md:text-5xl font-black mb-10 leading-tight text-on-surface">
            Sophisticated tools for high-stakes operations.
          </h2>
          <div className="space-y-10">
            {[
              {
                icon: <Database className="w-6 h-6" />,
                title: "Infinite Scalability",
                desc: "Parallelize millions of nodes without latency. Our orchestrator adapts to your workload dynamically.",
              },
              {
                icon: <Terminal className="w-6 h-6" />,
                title: "Code-Level Control",
                desc: "Inject custom Python or Node.js functions directly into your visual flows for ultimate flexibility.",
              },
            ].map((f, i) => (
              <div key={i} className="flex gap-6">
                <div className="shrink-0 w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  {f.icon}
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2 text-on-surface">
                    {f.title}
                  </h4>
                  <p className="text-on-surface-variant leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-10 bg-primary/5 blur-[100px] rounded-full" />
          <div className="relative bg-surface-container-lowest rounded-[3rem] p-4 ambient-shadow border border-outline-variant/10">
            <img
              src="https://picsum.photos/seed/nexus-ui/1200/800"
              alt="Nexus UI"
              className="rounded-4xl w-full object-cover aspect-video"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
);

const Stats = () => (
  <section className="py-32 px-6 max-w-7xl mx-auto text-center">
    <h2 className="text-4xl md:text-5xl font-black mb-24 leading-tight text-on-surface">
      Reliability at <span className="text-gradient">Planetary Scale</span>
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
      {[
        {
          stat: "99.99%",
          label: "Uptime Guarantee",
          desc: "Redundant architecture across 32 availability zones for absolute continuity.",
        },
        {
          stat: "Global",
          label: "Distribution",
          desc: "Deploy workflows closer to your users with automated edge-execution nodes.",
        },
        {
          stat: "SOC2",
          label: "Compliance",
          desc: "Fully certified Type II compliance, GDPR ready, and HIPAA eligible infrastructure.",
        },
      ].map((s, i) => (
        <div
          key={i}
          className={`p-8 ${i === 1 ? "md:border-x border-outline-variant/20" : ""}`}
        >
          <div className="text-6xl font-black text-primary mb-6 tracking-tighter">
            {s.stat}
          </div>
          <h4 className="text-xl font-bold mb-3 text-on-surface">{s.label}</h4>
          <p className="text-on-surface-variant leading-relaxed">{s.desc}</p>
        </div>
      ))}
    </div>
  </section>
);

const Testimonial = () => (
  <section className="py-32 bg-surface-container-high/30">
    <div className="max-w-4xl mx-auto px-6 text-center">
      <Quote className="w-16 h-16 text-primary/20 mx-auto mb-10" />
      <blockquote className="text-3xl md:text-4xl font-semibold text-on-surface leading-tight mb-12 italic">
        "Orchestrator hasn't just replaced our legacy automation tools; it has
        fundamentally redefined how we architect our global supply chain logic.
        The isolation model is the most robust I've seen in two decades of
        enterprise IT."
      </blockquote>
      <div className="flex flex-col items-center">
        <img
          src="https://picsum.photos/seed/marcus/200/200"
          alt="Marcus Chen"
          className="w-20 h-20 rounded-full mb-4 border-4 border-white shadow-lg"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
        <div className="font-bold text-lg text-on-surface">Marcus Chen</div>
        <div className="text-primary font-medium">
          Chief Technology Officer, Fortune 500 Manufacturing
        </div>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-surface-container-low pt-24 pb-12 border-t border-outline-variant/10">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-20">
        <div className="col-span-2 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <Network className="text-white w-4 h-4" />
            </div>
            <span className="text-lg font-black tracking-tight text-on-surface">
              Nexus Orchestrator
            </span>
          </div>
          <p className="text-on-surface-variant max-w-xs leading-relaxed mb-8">
            Empowering enterprises with architectural automation and high-scale
            orchestration.
          </p>
        </div>
      </div>
      <div className="pt-12 border-t border-outline-variant/10 text-center text-on-surface-variant/60 text-xs font-medium">
        © 2026 Nexus Orchestrator Inc. All rights reserved.
      </div>
    </div>
  </footer>
);

export function LandingClient() {
  const { constrainedMotion } = useLandingPerformanceMode();

  return (
    <div className="min-h-screen">
      <Navbar constrainedMotion={constrainedMotion} />
      <Hero constrainedMotion={constrainedMotion} />
      <TrustBar />
      <Features constrainedMotion={constrainedMotion} />
      <DeepDive />
      <Stats />
      <Testimonial />

      {/* Final CTA */}
      <section className="py-40 px-6 text-center bg-surface-container-high/20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl md:text-7xl font-black mb-10 leading-tight text-on-surface">
            Ready to Orchestrate Your Workflows?
          </h2>
          <p className="text-xl text-on-surface-variant mb-12 max-w-2xl mx-auto leading-relaxed">
            Join the world's most innovative enterprises and start building the
            future of automated operations today.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/register"
              className={`premium-gradient text-(--on-primary) px-10 py-5 rounded-xl font-black text-xl shadow-[0_12px_28px_rgba(0,95,158,0.18)] active:scale-95 inline-block ${
                constrainedMotion
                  ? "transition-opacity"
                  : "hover:scale-105 transition-transform"
              }`}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
