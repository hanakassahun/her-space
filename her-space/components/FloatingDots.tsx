"use client";

const dots = [
  { left: "8%", bottom: "8%", size: 5, delay: "-3s", duration: "17s" },
  { left: "21%", bottom: "18%", size: 7, delay: "-11s", duration: "20s" },
  { left: "35%", bottom: "5%", size: 4, delay: "-7s", duration: "15s" },
  { left: "49%", bottom: "15%", size: 6, delay: "-14s", duration: "22s" },
  { left: "63%", bottom: "6%", size: 8, delay: "-5s", duration: "18s" },
  { left: "76%", bottom: "19%", size: 5, delay: "-16s", duration: "14s" },
  { left: "88%", bottom: "9%", size: 7, delay: "-9s", duration: "21s" },
  { left: "94%", bottom: "23%", size: 4, delay: "-1s", duration: "16s" },
];

export default function FloatingDots() {
  return (
    <span className="floating-dots pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {dots.map((dot, index) => (
        <span
          className={`floating-dot floating-dot-${index % 2}`}
          key={index}
          style={{
            left: dot.left,
            bottom: dot.bottom,
            width: dot.size,
            height: dot.size,
            animationDelay: dot.delay,
            animationDuration: dot.duration,
          }}
        />
      ))}
    </span>
  );
}
