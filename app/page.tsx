"use client";

import { useEffect } from "react";
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

const FEATURES = [
  {
    title: "Station-wise Tracking",
    description:
      "Monitor housekeeping activities on a station-by-station basis. Get comprehensive insights into operations across all DMRC stations in real-time.",
    icon: Building2,
  },
  {
    title: "Chemical Monitoring",
    description:
      "Track chemical consumption and utilization. Monitor monthly and daily usage patterns to optimize procurement and reduce wastage.",
    icon: ClipboardList,
  },
  {
    title: "Machinery Management",
    description:
      "Record and track machinery usage and maintenance schedules. Ensure equipment is properly maintained and operational at all times.",
    icon: Wrench,
  },
  {
    title: "Staff Management",
    description:
      "Manage manpower deployment across shifts and stations. Track staffing levels, attendance, and shift patterns for better resource planning.",
    icon: Users,
  },
  {
    title: "Pest Control Tracking",
    description:
      "Document all pest control activities including chemicals used and quantities. Maintain compliance with health and safety standards.",
    icon: ShieldCheck,
  },
  {
    title: "Advanced Filtering & Reports",
    description:
      "Filter data by date, station, and other parameters. Generate comprehensive reports for analysis and decision-making.",
    icon: ClipboardCheck,
  },
];

const ROLES = [
  {
    title: "Super Admin",
    responsibilities: [
      "Create and manage master data (stations, chemicals, machinery, staff)",
      "Monitor system activities in real-time",
      "View all housekeeping logs and reports",
      "Manage user accounts and permissions",
      "Generate comprehensive usage reports",
      "Track compliance and utilization metrics",
    ],
  },
  {
    title: "User",
    responsibilities: [
      "Submit daily housekeeping operation details",
      "Record cleaning activities and observations",
      "Track chemical and material usage",
      "View own submission history",
      "Access work schedules and assignments",
      "Generate personal activity reports",
    ],
  },
];

export default function Page() {
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-observe]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.2 }
    );

    sections.forEach((section) => {
      section.classList.remove("is-visible");
      observer.observe(section);
    });

    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f4f6fb] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-white/20 bg-[#0b3fa1]/95 text-white shadow-lg shadow-[#081c44]/40 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="text-2xl font-bold tracking-wide">DMRC HMS</div>
          <nav>
            <ul className="flex flex-wrap items-center gap-6 text-sm font-semibold">
              <li>
                <a className="transition-colors hover:text-[#9fd1ff]" href="#home">
                  Home
                </a>
              </li>
              <li>
                <a className="transition-colors hover:text-[#9fd1ff]" href="#features">
                  Features
                </a>
              </li>
              <li>
                <a className="rounded-full bg-white px-5 py-1.5 text-[#0b3fa1] shadow-md shadow-black/10 transition hover:bg-[#e2eeff]" href="/login">
                  Login
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <section
        id="home"
        className="bg-gradient-to-b from-[#0c4cc1] via-[#0b3fa1] to-[#0a3184] text-white"
        data-observe
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-10 text-center lg:flex-row lg:items-center lg:text-left">
            <div className="flex flex-col items-center lg:items-start">
              <div className="rounded-3xl bg-white/10 p-0 shadow-2xl shadow-black/30 backdrop-blur">
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRVm58yUFV4Rrwjf72iFf05IIu2hTJ-Ugvnaw&s"
                  alt="DMRC welcome mascot with namaste"
                  className="h-55 w-55 object-contain drop-shadow-lg"
                  loading="lazy"
                />
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.4em] text-sky-100">
                Welcome to DMRC
              </p>
            </div>
            <div className="mx-auto max-w-3xl space-y-5">
              <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
                Digital Housekeeping Monitoring for DMRC Stations
              </h1>
              <p className="text-base text-sky-100">
                Efficiently manage staff, chemicals, machinery, and pest control operations across all DMRC stations with real-time tracking and reporting.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                <a
                  className="rounded-full bg-[#178b27] px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#0f641c]"
                  href="/login"
                >
                  Login as Super Admin
                </a>
                <a
                  className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-[#0c3f97] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-slate-100"
                  href="/login"
                >
                  Login as User
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-12 sm:px-6 lg:px-8">
        <section id="features" className="bg-white px-6 py-12 text-[#0c2560] shadow-xl shadow-[#c7cfeb]" data-observe>
          <div className="mb-3 flex justify-center">
            <span className="inline-flex items-center rounded-full bg-[#0d3c9b]/10 px-6 py-2 text-base font-semibold text-black shadow-inner">
              Key Features
            </span>
          </div>
          <p className="text-center text-2xl font-semibold text-black sm:text-3xl">
            Everything You Need to <span className="text-[#0d3c9b]">Manage Operations</span>
          </p>
          <p className="mb-10 mt-2 text-center text-base text-slate-500">
            Stay on top of every operation with real-time insights tailored for DMRC housekeeping workflows.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group h-full rounded-3xl border border-l-4 border-slate-100 bg-white p-6 pl-8 shadow-md transition-all duration-300 hover:-translate-y-2 hover:border-[#1e62d8] hover:shadow-2xl"
                  data-observe
                  style={{ transitionDelay: `${index * 60}ms`, borderLeftColor: "#24c16c" }}
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-[#0d3c9b] transition group-hover:bg-[#0d3c9b]/10 group-hover:text-[#0d3c9b]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0e3ba1]">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white px-6 py-12 text-[#0c2560] shadow-xl shadow-[#c7cfeb]" data-observe>
          <h2 className="mb-4 text-center text-3xl font-semibold text-[#0d3c9b]">User Roles &amp; Responsibilities</h2>
          <p className="mb-10 text-center text-base text-slate-500">
            Clear role definitions ensure secure access and streamlined operations.
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {ROLES.map((role, index) => (
              <div
                key={role.title}
                className="rounded-2xl border border-transparent bg-white shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
                data-observe
                style={{ transitionDelay: `${index * 120}ms` }}
              >
                <div
                  className={`flex items-center gap-3 rounded-t-2xl px-4 py-3 text-white ${
                    role.title === "Super Admin" ? "bg-[#0d3c9b]" : "bg-[#1faa3f]"
                  }`}
                >
                  {role.title === "Super Admin" ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : (
                    <Users className="h-5 w-5" />
                  )}
                  <h3 className="text-xl font-semibold">{role.title}</h3>
                </div>
                <div className="p-6">
                  <ul className="space-y-3 text-sm text-slate-600">
                  {role.responsibilities.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-[#1faa3f]">✔</span>
                        <span>{item}</span>
                    </li>
                  ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      <footer className="bg-[#0b3fa1] px-4 py-10 text-center text-sm text-white shadow-inner shadow-[#081c44]" data-observe>
        <p>&copy; 2024 Delhi Metro Rail Corporation. All rights reserved.</p>
        <p className="mt-1 italic text-blue-100">This is an academic project for demonstration purposes.</p>
      </footer>
    </main>
  );
}
