import type { CSSProperties, FC } from "react";

export interface ListOverlayProps {
  title: string;
  items: string[];
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  animateReveal?: boolean;
}

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export const ListOverlay: FC<ListOverlayProps> = ({
  title,
  items,
  primaryColor = "#10b981",
  accentColor = "#6ee7b7",
  backgroundColor = "#022c22",
  textColor = "#ffffff",
  fontFamily = "Inter, Helvetica, Arial, sans-serif",
  animateReveal = false,
}) => {
  return (
    <div
      style={{
        position: "relative",
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px 160px",
        fontFamily,
        overflow: "hidden",
      }}
    >
      {animateReveal && (
        <style>
          {`
            @keyframes listItemReveal {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}
        </style>
      )}

      {/* Decorative background element */}
      <div
        style={{
          position: "absolute",
          top: -200,
          right: -200,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${primaryColor}15 0%, transparent 70%)`,
        }}
      />

      {/* Title */}
      <div
        style={{
          fontSize: 56,
          fontWeight: 800,
          color: textColor,
          marginBottom: 56,
          position: "relative",
        }}
      >
        {title}
        <div
          style={{
            width: 80,
            height: 5,
            backgroundColor: primaryColor,
            borderRadius: 3,
            marginTop: 16,
          }}
        />
      </div>

      {/* List items */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          position: "relative",
        }}
      >
        {items.map((item, index) => {
          const revealStyle: CSSProperties = animateReveal
            ? {
                animation: `listItemReveal 0.4s ease-out ${index * 0.15}s both`,
              }
            : {};

          return (
            <div
              key={`item-${item}`}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 24,
                ...revealStyle,
              }}
            >
              {/* Bullet */}
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  backgroundColor: accentColor,
                  flexShrink: 0,
                  boxShadow: `0 0 12px ${accentColor}66`,
                }}
              />

              {/* Text */}
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 500,
                  color: textColor,
                  lineHeight: 1.4,
                  opacity: 0.95,
                }}
              >
                {item}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const templateConfig = {
  id: "list-overlay",
  name: "List Overlay",
  category: "text",
  defaultProps: {
    title: "Key Takeaways",
    items: [
      "Increased efficiency by 40%",
      "Reduced costs across all departments",
      "Improved customer satisfaction scores",
      "Streamlined onboarding process",
    ],
    primaryColor: "#10b981",
    accentColor: "#6ee7b7",
    backgroundColor: "#022c22",
    textColor: "#ffffff",
    fontFamily: "Inter, Helvetica, Arial, sans-serif",
    animateReveal: false,
  },
};
