import type { CSSProperties, FC } from "react";

export interface LowerThirdProps {
  name: string;
  title: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  animation?: "none" | "fade" | "slide";
}

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export const LowerThird: FC<LowerThirdProps> = ({
  name,
  title,
  primaryColor = "#1a1a2e",
  secondaryColor = "#e94560",
  fontFamily = "Inter, Helvetica, Arial, sans-serif",
  animation = "none",
}) => {
  const animationStyle: CSSProperties =
    animation === "fade"
      ? { animation: "lowerThirdFadeIn 0.6s ease-out forwards" }
      : animation === "slide"
        ? { animation: "lowerThirdSlideIn 0.5s ease-out forwards" }
        : {};

  return (
    <div
      style={{
        position: "relative",
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        overflow: "hidden",
        fontFamily,
      }}
    >
      {animation !== "none" && (
        <style>
          {`
            @keyframes lowerThirdFadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes lowerThirdSlideIn {
              from { transform: translateX(-100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}
        </style>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 60,
          display: "flex",
          flexDirection: "column",
          ...animationStyle,
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            width: 4,
            height: "100%",
            position: "absolute",
            left: -16,
            top: 0,
            backgroundColor: secondaryColor,
            borderRadius: 2,
          }}
        />

        {/* Name bar */}
        <div
          style={{
            backgroundColor: primaryColor,
            padding: "16px 48px 16px 24px",
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
          }}
        >
          <span
            style={{
              color: "#ffffff",
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: "0.02em",
              lineHeight: 1.2,
            }}
          >
            {name}
          </span>
        </div>

        {/* Title bar */}
        <div
          style={{
            backgroundColor: secondaryColor,
            padding: "10px 48px 10px 24px",
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
          }}
        >
          <span
            style={{
              color: "#ffffff",
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: "0.04em",
              lineHeight: 1.3,
            }}
          >
            {title}
          </span>
        </div>
      </div>
    </div>
  );
};

export const templateConfig = {
  id: "lower-third",
  name: "Lower Third",
  category: "titles",
  defaultProps: {
    name: "John Doe",
    title: "CEO & Founder",
    primaryColor: "#1a1a2e",
    secondaryColor: "#e94560",
    fontFamily: "Inter, Helvetica, Arial, sans-serif",
    animation: "none" as const,
  },
};
