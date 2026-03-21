import type { FC } from "react";

export interface ComparisonItem {
  label: string;
  values: string[];
}

export interface ComparisonProps {
  leftTitle: string;
  rightTitle: string;
  items: ComparisonItem[];
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
}

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export const Comparison: FC<ComparisonProps> = ({
  leftTitle,
  rightTitle,
  items,
  primaryColor = "#4f46e5",
  secondaryColor = "#dc2626",
  accentColor = "#fbbf24",
  backgroundColor = "#0f172a",
  fontFamily = "Inter, Helvetica, Arial, sans-serif",
}) => {
  return (
    <div
      style={{
        position: "relative",
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor,
        display: "flex",
        flexDirection: "row",
        fontFamily,
        overflow: "hidden",
      }}
    >
      {/* Left column */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 40px",
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: primaryColor,
            marginBottom: 48,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {leftTitle}
        </div>
        {items.map((item) => (
          <div
            key={`left-${item.label}`}
            style={{
              width: "100%",
              maxWidth: 600,
              marginBottom: 24,
              padding: "20px 32px",
              backgroundColor: `${primaryColor}18`,
              borderLeft: `4px solid ${primaryColor}`,
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: "#94a3b8",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              {item.values[0] ?? "—"}
            </div>
          </div>
        ))}
      </div>

      {/* VS Divider */}
      <div
        style={{
          width: 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 2,
            background: `linear-gradient(to bottom, transparent, ${accentColor}, transparent)`,
          }}
        />
        <div
          style={{
            position: "relative",
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: accentColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: backgroundColor,
            }}
          >
            VS
          </span>
        </div>
      </div>

      {/* Right column */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 40px",
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: secondaryColor,
            marginBottom: 48,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {rightTitle}
        </div>
        {items.map((item) => (
          <div
            key={`right-${item.label}`}
            style={{
              width: "100%",
              maxWidth: 600,
              marginBottom: 24,
              padding: "20px 32px",
              backgroundColor: `${secondaryColor}18`,
              borderRight: `4px solid ${secondaryColor}`,
              borderRadius: 8,
              textAlign: "right",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: "#94a3b8",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              {item.values[1] ?? "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const templateConfig = {
  id: "comparison",
  name: "Comparison",
  category: "data",
  defaultProps: {
    leftTitle: "Plan A",
    rightTitle: "Plan B",
    items: [
      { label: "Price", values: ["$29/mo", "$59/mo"] },
      { label: "Storage", values: ["50 GB", "200 GB"] },
      { label: "Support", values: ["Email", "24/7 Live"] },
    ],
    primaryColor: "#4f46e5",
    secondaryColor: "#dc2626",
    accentColor: "#fbbf24",
    backgroundColor: "#0f172a",
    fontFamily: "Inter, Helvetica, Arial, sans-serif",
  },
};
