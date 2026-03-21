import { type CSSProperties, type FC, useEffect, useState } from "react";

export interface StatCalloutProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  animateCountUp?: boolean;
  animationDuration?: number;
}

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export const StatCallout: FC<StatCalloutProps> = ({
  value,
  label,
  prefix = "",
  suffix = "",
  primaryColor = "#0f0f23",
  secondaryColor = "#00d4ff",
  fontFamily = "Inter, Helvetica, Arial, sans-serif",
  animateCountUp = false,
  animationDuration = 2000,
}) => {
  const [displayValue, setDisplayValue] = useState(animateCountUp ? 0 : value);

  useEffect(() => {
    if (!animateCountUp) {
      setDisplayValue(value);
      return;
    }

    setDisplayValue(0);
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      const eased = 1 - (1 - progress) ** 3; // easeOutCubic
      setDisplayValue(Math.round(eased * value));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [value, animateCountUp, animationDuration]);

  return (
    <div
      style={{
        position: "relative",
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: primaryColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${secondaryColor}22 0%, transparent 70%)`,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Stat number */}
      <div
        style={{
          position: "relative",
          color: secondaryColor,
          fontSize: 180,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {prefix}
        {displayValue.toLocaleString()}
        {suffix}
      </div>

      {/* Divider */}
      <div
        style={{
          width: 120,
          height: 4,
          backgroundColor: secondaryColor,
          borderRadius: 2,
          margin: "32px 0",
          opacity: 0.6,
        }}
      />

      {/* Label */}
      <div
        style={{
          position: "relative",
          color: "#ffffff",
          fontSize: 40,
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          opacity: 0.9,
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const templateConfig = {
  id: "stat-callout",
  name: "Stat Callout",
  category: "data",
  defaultProps: {
    value: 98,
    label: "Customer Satisfaction",
    prefix: "",
    suffix: "%",
    primaryColor: "#0f0f23",
    secondaryColor: "#00d4ff",
    fontFamily: "Inter, Helvetica, Arial, sans-serif",
    animateCountUp: false,
    animationDuration: 2000,
  },
};
