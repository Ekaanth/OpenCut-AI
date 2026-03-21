import type { CSSProperties, FC } from "react";

export interface ProgressBarProps {
  label: string;
  percentage: number;
  primaryColor?: string;
  trackColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  animate?: boolean;
  animationDuration?: number;
}

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export const ProgressBar: FC<ProgressBarProps> = ({
  label,
  percentage,
  primaryColor = "#3b82f6",
  trackColor = "#1e3a5f",
  backgroundColor = "#0a1628",
  textColor = "#ffffff",
  fontFamily = "Inter, Helvetica, Arial, sans-serif",
  animate = false,
  animationDuration = 1.5,
}) => {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  const fillStyle: CSSProperties = animate
    ? {
        width: `${clampedPercentage}%`,
        animation: `progressFill ${animationDuration}s ease-out forwards`,
      }
    : {
        width: `${clampedPercentage}%`,
      };

  return (
    <div
      style={{
        position: "relative",
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        overflow: "hidden",
        padding: "0 200px",
      }}
    >
      {animate && (
        <style>
          {`
            @keyframes progressFill {
              from { width: 0%; }
              to { width: ${clampedPercentage}%; }
            }
            @keyframes progressGlow {
              0%, 100% { box-shadow: 0 0 20px ${primaryColor}44; }
              50% { box-shadow: 0 0 40px ${primaryColor}88; }
            }
          `}
        </style>
      )}

      {/* Label row */}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 32,
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: textColor,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: primaryColor,
          }}
        >
          {clampedPercentage}%
        </div>
      </div>

      {/* Track */}
      <div
        style={{
          width: "100%",
          height: 48,
          backgroundColor: trackColor,
          borderRadius: 24,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Fill */}
        <div
          style={{
            height: "100%",
            background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}cc)`,
            borderRadius: 24,
            position: "relative",
            transition: animate ? "none" : "width 0.3s ease",
            ...fillStyle,
          }}
        >
          {/* Shine highlight */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "50%",
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)",
              borderRadius: "24px 24px 0 0",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export const templateConfig = {
  id: "progress-bar",
  name: "Progress Bar",
  category: "data",
  defaultProps: {
    label: "Project Completion",
    percentage: 73,
    primaryColor: "#3b82f6",
    trackColor: "#1e3a5f",
    backgroundColor: "#0a1628",
    textColor: "#ffffff",
    fontFamily: "Inter, Helvetica, Arial, sans-serif",
    animate: false,
    animationDuration: 1.5,
  },
};
